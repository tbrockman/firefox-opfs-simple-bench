#!/usr/bin/env node
// automation/run.mjs — run the OPFS benchmark in isolated Chrome and Firefox
// instances, one after the other, collect the results and build a report.
// Run with --help for the options.
//
// What happens for each browser, in order:
//   1. a brand-new profile directory is created (so a brand-new, empty OPFS);
//   2. the browser is launched with it (Puppeteer: CDP for Chrome, WebDriver
//      BiDi for Firefox) and pointed at index.html, served from this
//      repository by a small in-process server that sends the COOP/COEP
//      headers (microsecond performance.now());
//   3. the page runs with ?autorun=<preset> and any parameter overrides; this
//      script polls window.__opfsBench until the page reports done;
//   4. the page's results JSON and Bugzilla summary are written to the run
//      directory; the browser is closed and the profile deleted.
// Afterwards report.mjs turns the per-browser JSON into summary.md and
// report.html. Results land in <out>/<timestamp>[-label]/.

import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReport } from './report.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');

const USAGE = `Usage: node run.mjs [options]

  --browsers chrome,firefox   browsers to run, in this order (default: chrome,firefox)
  --preset quick|full         benchmark preset (default: quick)
  --n N  --s BYTES  --runs R  --m M  --chunks 65536,1048576  --workloads a,b
                              override individual benchmark parameters, e.g.
                              --workloads small-append,new-file --m 500
  --headed                    show the browser window (default: headless)
  --no-sandbox                start Chrome with --no-sandbox from the outset (the driver
                              retries with it automatically when Chrome's sandbox cannot start)
  --chrome-path PATH          use this Chrome/Chromium binary instead of Puppeteer's
  --firefox-path PATH         use this Firefox binary instead of Puppeteer's
  --out DIR                   where run directories are created (default: ../results)
  --label NAME                suffix for the run directory name
  --profiles-dir DIR          where throwaway profiles are created (default: ./.profiles;
                              keep it on a real disk, not tmpfs, so flush() costs are real)
  --keep-profiles             do not delete the throwaway profiles afterwards
  --timeout-min N             give up on a browser after N minutes (default: 120)
  --verbose                   echo everything the page logs to the console
  --help                      this text
`;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
};

// --- options -----------------------------------------------------------------

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`unexpected argument: ${arg}`);
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    let value = eq === -1 ? undefined : arg.slice(eq + 1);
    if (value === undefined && i + 1 < argv.length && !argv[i + 1].startsWith('--')) value = argv[++i];
    out[key] = value === undefined ? true : value;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}

const OVERRIDE_KEYS = ['n', 's', 'runs', 'm', 'chunks', 'workloads'];
const opts = {
  browsers: String(args.browsers || 'chrome,firefox').split(',').map((b) => b.trim()).filter(Boolean),
  preset: String(args.preset || 'quick'),
  headed: args.headed === true,
  noSandbox: args['no-sandbox'] === true,
  chromePath: args['chrome-path'] ? path.resolve(String(args['chrome-path'])) : undefined,
  firefoxPath: args['firefox-path'] ? path.resolve(String(args['firefox-path'])) : undefined,
  out: path.resolve(String(args.out || path.join(SITE, 'results'))),
  label: args.label ? String(args.label).replace(/[^\w.-]+/g, '-') : '',
  profilesDir: path.resolve(String(args['profiles-dir'] || path.join(HERE, '.profiles'))),
  keepProfiles: args['keep-profiles'] === true,
  timeoutMin: Number(args['timeout-min'] || 120),
  verbose: args.verbose === true,
  overrides: Object.fromEntries(OVERRIDE_KEYS.filter((k) => args[k] !== undefined).map((k) => [k, String(args[k])])),
};
if (!['quick', 'full'].includes(opts.preset)) throw new Error(`--preset must be quick or full, got "${opts.preset}"`);
for (const b of opts.browsers) {
  if (!['chrome', 'firefox'].includes(b)) throw new Error(`unknown browser "${b}" (use chrome or firefox)`);
}

// --- static server with COOP/COEP ------------------------------------------------

function serve(root) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(root, `.${rel}`);
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
      let stat;
      try { stat = await fs.stat(file); } catch { res.writeHead(404); res.end('not found'); return; }
      if (!stat.isFile()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') { res.end(); return; }
      createReadStream(file).pipe(res);
    });
    server.on('error', reject);
    // 127.0.0.1 rather than "localhost" so an IPv6-first resolver cannot send
    // the browser to ::1 where nothing listens. Loopback is a secure context.
    server.listen(0, '127.0.0.1', () => resolve({
      url: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((r) => server.close(r)),
    }));
  });
}

// --- browsers -----------------------------------------------------------------------

let lastLaunchArgs = [];

async function launchBrowser(name, profileDir, log) {
  const common = {
    headless: !opts.headed,
    userDataDir: profileDir,
    timeout: 90_000,
    protocolTimeout: 10 * 60_000,
  };
  if (name === 'chrome') {
    const args = ['--no-first-run', '--no-default-browser-check'];
    if (opts.noSandbox) args.push('--no-sandbox');
    lastLaunchArgs = args;
    try {
      return await puppeteer.launch({ ...common, browser: 'chrome', executablePath: opts.chromePath, args });
    } catch (err) {
      if (args.includes('--no-sandbox') || !/No usable sandbox|--no-sandbox/.test(err.message)) throw err;
      // Puppeteer's Chrome for Testing has no AppArmor profile, and Ubuntu
      // 23.10+ denies unprivileged user namespaces to unconfined binaries, so
      // Chrome's own sandbox cannot start. Retry without it: that changes
      // Chrome's process isolation, not anything the benchmark measures.
      // --chrome-path /usr/bin/google-chrome (packaged, with a profile) avoids it.
      log('Chrome could not start its sandbox (user-namespace restriction); retrying with --no-sandbox');
      args.push('--no-sandbox');
      return puppeteer.launch({ ...common, browser: 'chrome', executablePath: opts.chromePath, args });
    }
  }
  lastLaunchArgs = [];
  return puppeteer.launch({
    ...common,
    browser: 'firefox',
    executablePath: opts.firefoxPath,
    extraPrefsFirefox: {
      'browser.shell.checkDefaultBrowser': false,
      'app.update.enabled': false,
    },
  });
}

function hostInfo() {
  const cpus = os.cpus();
  return {
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu: cpus[0]?.model || 'unknown',
    cores: cpus.length,
    memoryGB: Math.round(os.totalmem() / 1e9),
    node: process.version,
    puppeteer: puppeteerVersion(),
  };
}

function puppeteerVersion() {
  try {
    return createRequire(import.meta.url)('puppeteer/package.json').version;
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let aborted = false;
let currentBrowser = null;
process.on('SIGINT', () => {
  if (aborted) process.exit(130);
  aborted = true;
  console.log('\nInterrupted; closing the browser and writing what we have…');
  currentBrowser?.close().catch(() => {});
});

// Runs one browser end to end. Never throws: returns { browser, ok, ... } and
// always closes the browser and removes the profile in its finally block.
async function runBrowser(name, runDir, serverUrl) {
  const startedAt = new Date();
  await fs.mkdir(opts.profilesDir, { recursive: true });
  const profileDir = await fs.mkdtemp(path.join(opts.profilesDir, `${name}-`));
  const logLines = [];
  const log = (line) => {
    logLines.push(`[${new Date().toISOString()}] ${line}`);
    console.log(`  ${name}: ${line}`);
  };
  const record = { browser: name, ok: false };
  let browser = null;
  try {
    browser = currentBrowser = await launchBrowser(name, profileDir, log);
    record.version = await browser.version();
    log(`launched ${record.version}; profile ${profileDir}`);

    const page = await browser.newPage();
    page.on('console', (m) => {
      const text = m.text();
      if (opts.verbose || m.type() === 'error' || m.type() === 'warn') {
        log(`console.${m.type()}: ${text.length > 400 ? `${text.slice(0, 400)}…` : text}`);
      }
    });
    page.on('pageerror', (err) => log(`page error: ${err.message}`));

    const query = new URLSearchParams({ autorun: opts.preset, ...opts.overrides });
    const url = `${serverUrl}/?${query}`;
    await page.goto(url, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForFunction(() => window.__opfsBench && window.__opfsBench.ready, { timeout: 60_000, polling: 250 });

    const support = JSON.parse(await page.evaluate(() => JSON.stringify(window.__opfsBench.support)));
    record.support = support;
    if (!support.ok) {
      log(`OPFS sync access handles unsupported: ${support.reason}`);
      record.error = support.reason;
      return record;
    }
    log(`ready: performance.now() resolution ${(support.timerResolutionMs * 1000).toFixed(0)} µs, ` +
        `crossOriginIsolated=${support.crossOriginIsolated}`);

    // Poll the page until it reports done; the page's own timer keeps running
    // untouched. Progress lines are printed when the workload/phase changes.
    const deadline = Date.now() + opts.timeoutMin * 60_000;
    let lastProgress = '';
    for (;;) {
      const state = JSON.parse(await page.evaluate(() => JSON.stringify({
        done: window.__opfsBench.done,
        progress: window.__opfsBench.progress,
        status: window.__opfsBench.status,
      })));
      if (state.progress !== lastProgress) {
        log(state.status || state.progress);
        lastProgress = state.progress;
      }
      if (state.done) break;
      if (aborted) throw new Error('interrupted');
      if (Date.now() > deadline) throw new Error(`timed out after ${opts.timeoutMin} min (${state.status})`);
      await sleep(2000);
    }

    // JSON round-trip: keeps the transfer identical over CDP and WebDriver BiDi.
    const results = JSON.parse(await page.evaluate(() => JSON.stringify(window.__opfsBench.results)));
    const summary = await page.evaluate(() => window.__opfsBench.summary);
    results.automation = {
      browser: name,
      version: record.version,
      executablePath: browser.process()?.spawnfile ?? null,
      launchArgs: lastLaunchArgs,
      headless: !opts.headed,
      profileDir,
      url,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      host: hostInfo(),
    };
    await fs.writeFile(path.join(runDir, `${name}.json`), JSON.stringify(results, null, 2));
    await fs.writeFile(path.join(runDir, `${name}.summary.md`), `${summary}\n`);
    record.ok = !results.error;
    if (results.error) record.error = `${results.error.name}: ${results.error.message}`;
    log(`saved ${name}.json, ${results.workloads.length} rows in ${(results.durationMs / 1000).toFixed(0)} s` +
        (results.error ? `; run ended with ${record.error}` : ''));
    return record;
  } catch (err) {
    record.error = err.message || String(err);
    log(`failed: ${err.stack || err}`);
    return record;
  } finally {
    currentBrowser = null;
    if (browser) {
      try { await browser.close(); } catch (err) { log(`close failed: ${err.message}`); }
    }
    if (opts.keepProfiles) {
      log(`profile kept at ${profileDir}`);
    } else {
      await fs.rm(profileDir, { recursive: true, force: true, maxRetries: 5 });
    }
    await fs.writeFile(path.join(runDir, `${name}.log`), `${logLines.join('\n')}\n`);
  }
}

// --- main ---------------------------------------------------------------------------

async function main() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  const runDir = path.join(opts.out, opts.label ? `${stamp}-${opts.label}` : stamp);
  await fs.mkdir(runDir, { recursive: true });

  const server = await serve(SITE);
  const overrideText = Object.keys(opts.overrides).length
    ? ` with ${Object.entries(opts.overrides).map(([k, v]) => `${k}=${v}`).join(' ')}`
    : '';
  console.log(`Serving ${SITE} at ${server.url} (COOP/COEP)`);
  console.log(`Run directory: ${runDir}`);
  console.log(`Browsers: ${opts.browsers.join(', then ')}; preset ${opts.preset}${overrideText}; ${opts.headed ? 'headed' : 'headless'}`);

  const records = [];
  try {
    for (const name of opts.browsers) {
      if (aborted) break;
      console.log(`\n▶ ${name}`);
      records.push(await runBrowser(name, runDir, server.url));
    }
  } finally {
    await server.close();
  }

  await fs.writeFile(path.join(runDir, 'run.json'), JSON.stringify({ options: opts, records }, null, 2));

  const report = await buildReport(runDir);
  if (report.table) console.log(`\n${report.table}`);
  console.log(`\nReport:  ${path.join(runDir, 'report.html')}`);
  console.log(`Summary: ${path.join(runDir, 'summary.md')}`);
  const failed = records.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`\n${failed.length} browser(s) did not complete: ${failed.map((r) => `${r.browser} (${r.error})`).join('; ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
