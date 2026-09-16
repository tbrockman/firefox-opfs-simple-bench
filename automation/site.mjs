#!/usr/bin/env node
// automation/site.mjs — assemble the GitHub Pages site from committed results.
//
//   node site.mjs [results-dir] [out-dir]     defaults: ../results  ../_site
//
// Output:
//   index.html        the newest run's report.html (runs sort by directory
//                     name, which starts with the run's local timestamp)
//   runs/<run>/       every run directory as committed (report.html,
//                     summary.md, per-browser JSON, logs)
//   runs/index.html   list of runs, newest first
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
    try {
      const run = JSON.parse(await fs.readFile(path.join(dir, 'run.json'), 'utf8'));
      browsers = (run.records || []).map((r) => `${r.browser}${r.ok ? '' : ' (failed)'}`);
    } catch {}
    for (const f of await fs.readdir(dir)) {
      if (f.endsWith('.json') && f !== 'run.json') {
        try {
          const data = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
          if (data.env?.timestamp) { date = data.env.timestamp; break; }
        } catch {}
      }
    }
    runs.push({ name: e.name, dir, browsers, date });
  }
  runs.sort((a, b) => b.name.localeCompare(a.name));
  return runs;
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
ul { padding-left: 20px; } li { margin: 6px 0; }
.muted { opacity: 0.7; }
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

  const items = runs.map((r) =>
    `<li><a href="${esc(r.name)}/report.html">${esc(r.name)}</a>` +
    ` <span class="muted">${esc(r.browsers.join(', ') || '')}${r.date ? ` · ${esc(r.date)}` : ''}</span>` +
    ` · <a href="${esc(r.name)}/summary.md">summary.md</a></li>`).join('\n');
  await fs.writeFile(path.join(outDir, 'runs', 'index.html'), shell('OPFS benchmark runs',
    `<h1>OPFS sync write benchmark: all runs</h1>\n<p><a href="../">Latest report</a></p>\n<ul>\n${items || '<li class="muted">No runs committed yet.</li>'}\n</ul>`));

  if (runs.length) {
    const latest = runs[0];
    const report = await fs.readFile(path.join(latest.dir, 'report.html'), 'utf8');
    const nav = `<p class="sub">Run <code>${esc(latest.name)}</code> · <a href="runs/${esc(latest.name)}/summary.md">summary.md</a> · <a href="runs/">all runs</a></p>\n`;
    // The report is standalone; add one line so the page says which run it is.
    await fs.writeFile(path.join(outDir, 'index.html'), report.includes('</main>') ? report.replace('</main>', `${nav}</main>`) : report + nav);
  } else {
    await fs.writeFile(path.join(outDir, 'index.html'), shell('OPFS benchmark',
      '<h1>OPFS sync write benchmark</h1>\n<p class="muted">No results have been committed yet. Run <code>node automation/run.mjs</code>, commit the <code>results/&lt;run&gt;/</code> directory and push.</p>'));
  }
  console.log(`${runs.length} run(s) → ${outDir}${runs.length ? ` (latest: ${runs[0].name})` : ''}`);
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
