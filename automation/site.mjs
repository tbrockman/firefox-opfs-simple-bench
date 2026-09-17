#!/usr/bin/env node
// automation/site.mjs — assemble the GitHub Pages site from committed results.
//
//   node site.mjs [results-dir] [out-dir]     defaults: ../results  ../_site
//
// Output:
//   index.html        the newest cross-browser run's report.html. Runs sort
//                     by directory name, which starts with the run's local
//                     timestamp. Experiments (a single browser, a local
//                     browser build, a --note, or strace tracing with its
//                     inflated timings) are listed separately and never
//                     promoted to the front page.
//   runs/<run>/       every run directory as committed (report.html,
//                     summary.md, per-browser JSON, logs)
//   runs/index.html   comparisons and experiments, newest first
//
// No dependencies; the workflow in .github/workflows/pages.yml runs this and
// uploads the output. Nothing is benchmarked in CI: what gets published is
// whatever results/ directories have been committed.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.resolve(process.argv[2] || path.join(HERE, '..', 'results'));
const outDir = path.resolve(process.argv[3] || path.join(HERE, '..', '_site'));

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function listRuns() {
  let entries = [];
  try { entries = await fs.readdir(resultsDir, { withFileTypes: true }); } catch { return []; }
  const runs = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(resultsDir, e.name);
    try { await fs.access(path.join(dir, 'report.html')); } catch { continue; }
    let browsers = [];
    let date = '';
    // report.html carries meta tags describing the run; older reports and
    // directories committed without JSON fall back to file names.
    const meta = {};
    try {
      const html = await fs.readFile(path.join(dir, 'report.html'), 'utf8');
      for (const m of html.matchAll(/<meta name="opfs-bench-([a-z-]+)" content="([^"]*)">/g)) meta[m[1]] = unescapeHtml(m[2]);
    } catch {}
    const files = await fs.readdir(dir);
    const summaryBrowsers = files.filter((f) => f.endsWith('.summary.md')).map((f) => f.replace('.summary.md', ''));
    const traced = meta.traced === 'true';
    const metaBrowsers = meta.browsers ? meta.browsers.split(',').filter(Boolean) : [];
    const customBuild = meta['custom-build'] !== undefined ? meta['custom-build'] === 'true' : /local/i.test(e.name);
    const note = meta.note || '';
    try {
      const run = JSON.parse(await fs.readFile(path.join(dir, 'run.json'), 'utf8'));
      browsers = (run.records || []).map((r) => `${r.browser}${r.ok ? '' : ' (failed)'}`);
    } catch {}
    if (!browsers.length) browsers = metaBrowsers.length ? metaBrowsers : summaryBrowsers;
    for (const f of files) {
      if (f.endsWith('.json') && f !== 'run.json') {
        try {
          const data = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
          if (data.env?.timestamp) { date = data.env.timestamp; break; }
        } catch {}
      }
    }
    const okBrowsers = browsers.filter((b) => !b.includes('failed'));
    const experiment = traced || customBuild || !!note || okBrowsers.length < 2;
    runs.push({ name: e.name, dir, browsers, date, traced, customBuild, note, experiment });
  }
  runs.sort((a, b) => b.name.localeCompare(a.name));
  return runs;
}

const unescapeHtml = (t) => t.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function badges(r) {
  const b = [];
  if (r.customBuild) b.push('local build');
  if (r.browsers.filter((x) => !x.includes('failed')).length < 2) b.push('single browser');
  if (r.traced) b.push('traced with strace, timings inflated');
  return b.map((t) => `<span class="badge">${esc(t)}</span>`).join(' ');
}

function runItem(r) {
  return `<li><a href="${esc(r.name)}/report.html">${esc(r.name)}</a> ${badges(r)}` +
    `<div class="muted">${esc(r.browsers.join(', ') || '')}${r.date ? ` · ${esc(r.date)}` : ''}` +
    ` · <a href="${esc(r.name)}/summary.md">summary.md</a></div>` +
    (r.note ? `<div class="note">${esc(r.note)}</div>` : '') + '</li>';
}

function shell(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root { color-scheme: light dark; }
body { margin: 0; padding: 24px 16px 48px; background: #f9f9f7; color: #0b0b0b; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
@media (prefers-color-scheme: dark) { body { background: #0d0d0d; color: #fff; } }
main { max-width: 900px; margin: 0 auto; }
h1 { font-size: 1.4rem; margin: 0 0 12px; }
ul { padding-left: 20px; } li { margin: 10px 0; }
.muted { opacity: 0.7; }
.note { opacity: 0.85; font-style: italic; }
.badge { display: inline-block; font-size: 0.8em; padding: 1px 7px; border-radius: 10px; border: 1px solid currentColor; opacity: 0.8; margin-left: 4px; }
h2 { font-size: 1.1rem; margin: 20px 0 6px; }
</style>
</head>
<body><main>${body}</main></body>
</html>
`;
}

async function main() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(path.join(outDir, 'runs'), { recursive: true });
  await fs.writeFile(path.join(outDir, '.nojekyll'), '');

  const runs = await listRuns();
  for (const run of runs) {
    await fs.cp(run.dir, path.join(outDir, 'runs', run.name), { recursive: true });
  }

  const comparisons = runs.filter((r) => !r.experiment);
  const experiments = runs.filter((r) => r.experiment);
  const list = (items) => `<ul>\n${items.map(runItem).join('\n') || '<li class="muted">none</li>'}\n</ul>`;
  await fs.writeFile(path.join(outDir, 'runs', 'index.html'), shell('OPFS benchmark runs',
    `<h1>OPFS sync write benchmark: all runs</h1>\n<p><a href="../">Latest cross-browser report</a></p>\n` +
    `<h2>Cross-browser comparisons</h2>\n${list(comparisons)}\n` +
    `<h2>Experiments</h2>\n<p class="muted">Single-browser runs, local browser builds (patched or not), fsync-free controls and traced runs. Their timings are not comparable with the runs above unless the note says so.</p>\n${list(experiments)}`));

  if (runs.length) {
    const latest = comparisons[0] || runs.find((r) => !r.traced) || runs[0];
    const report = await fs.readFile(path.join(latest.dir, 'report.html'), 'utf8');
    const nav = `<p class="sub">Run <code>${esc(latest.name)}</code>, the newest cross-browser comparison · <a href="runs/${esc(latest.name)}/summary.md">summary.md</a> · <a href="runs/">all runs and experiments</a></p>\n`;
    // The report is standalone; add one line so the page says which run it is.
    await fs.writeFile(path.join(outDir, 'index.html'), report.includes('</main>') ? report.replace('</main>', `${nav}</main>`) : report + nav);
  } else {
    await fs.writeFile(path.join(outDir, 'index.html'), shell('OPFS benchmark',
      '<h1>OPFS sync write benchmark</h1>\n<p class="muted">No results have been committed yet. Run <code>node automation/run.mjs</code>, commit the <code>results/&lt;run&gt;/</code> directory and push.</p>'));
  }
  const front = comparisons[0] || runs.find((r) => !r.traced) || runs[0];
  console.log(`${runs.length} run(s), ${comparisons.length} comparison(s), ${experiments.length} experiment(s) → ${outDir}${front ? ` (front page: ${front.name})` : ''}`);
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
