#!/usr/bin/env node
// automation/report.mjs — turn the per-browser JSON files in a run directory
// into summary.md (Markdown, ready for a ticket) and report.html (standalone,
// no dependencies: a comparison chart, the table behind it, environment
// details and each browser's Bugzilla summary).
//
//   node report.mjs <run-dir>        rebuild the report for an existing run
//
// run.mjs calls buildReport() itself after the browsers have finished.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BROWSER_ORDER = ['chrome', 'firefox', 'safari'];

// Fixed colour per browser (categorical slots 1–4 of the reference palette,
// validated for light and dark surfaces). A browser keeps its colour no matter
// which others ran alongside it.
const SERIES = {
  chrome:  { light: '#2a78d6', dark: '#3987e5' },
  firefox: { light: '#eb6834', dark: '#d95926' },
  safari:  { light: '#1baf7a', dark: '#199e70' },
  other:   { light: '#eda100', dark: '#c98500' },
};

export async function buildReport(dir) {
  const runs = await loadRuns(dir);
  const okRuns = runs.filter((r) => r.data.workloads?.length);
  const rows = collectRows(okRuns);
  const md = renderMarkdown(dir, runs, okRuns, rows);
  const html = renderHtml(runs, okRuns, rows);
  await fs.writeFile(path.join(dir, 'summary.md'), md.text);
  await fs.writeFile(path.join(dir, 'report.html'), html);
  return { table: md.table, runs: runs.length, rows: rows.length };
}

// --- data ---------------------------------------------------------------------------

async function loadRuns(dir) {
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json') && f !== 'run.json').sort();
  const runs = [];
  for (const file of files) {
    const data = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
    const name = data.automation?.browser || path.basename(file, '.json');
    let summary = null;
    try { summary = await fs.readFile(path.join(dir, `${path.basename(file, '.json')}.summary.md`), 'utf8'); } catch {}
    runs.push({ name, file, data, summary, label: browserLabel(name, data) });
  }
  runs.sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name));
  return runs;
}

const rank = (name) => { const i = BROWSER_ORDER.indexOf(name); return i === -1 ? BROWSER_ORDER.length : i; };

function browserLabel(name, data) {
  const ua = data.env?.userAgent || '';
  let m;
  if ((m = ua.match(/Firefox\/(\d+)/))) return `Firefox ${m[1]}`;
  if ((m = ua.match(/Edg\/(\d+)/))) return `Edge ${m[1]}`;
  if ((m = ua.match(/Chrome\/(\d+)/))) return `Chrome ${m[1]}`;
  if ((m = ua.match(/Version\/(\d+)[^ ]* .*Safari/))) return `Safari ${m[1]}`;
  return name;
}

// One row per workload id, in the order the first browser produced them; each
// row carries every browser's median-run stats for that id.
function collectRows(okRuns) {
  const rows = new Map();
  for (const run of okRuns) {
    for (const w of run.data.workloads) {
      if (!rows.has(w.id)) rows.set(w.id, { id: w.id, label: w.label, description: w.description, isolates: w.isolates, by: {} });
      rows.get(w.id).by[run.name] = w;
    }
  }
  return [...rows.values()];
}

// --- formatting ------------------------------------------------------------------

const usOf = (w) => w.median.meanMs * 1000;
const fmtUs = (v) => (v >= 10000 ? `${(v / 1000).toFixed(1)} ms` : v >= 100 ? `${v.toFixed(0)} µs` : `${v.toFixed(1)} µs`);
const fmtMs = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v.toFixed(1)} ms`);
const fmtRatio = (v) => (v >= 100 ? `${v.toFixed(0)}×` : `${v.toFixed(1)}×`);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function configText(data) {
  const c = data.config;
  if (!c) return '';
  const chunks = (c.chunkSizes || []).map((n) => (n % 1048576 === 0 ? `${n / 1048576} MiB` : n % 1024 === 0 ? `${n / 1024} KiB` : `${n} B`)).join(' / ');
  return `preset=${c.preset}, N=${c.n}, S=${c.s} B, chunks=${chunks}, R=${c.runs}, M=${c.m}`;
}

function hostText(runs) {
  const h = runs.find((r) => r.data.automation?.host)?.data.automation.host;
  if (!h) return '';
  return `${h.cpu} (${h.cores} threads), ${h.memoryGB} GB, ${h.platform} ${h.release} ${h.arch}`;
}

// --- Markdown ----------------------------------------------------------------------

function renderMarkdown(dir, runs, okRuns, rows) {
  const out = [];
  const when = runs[0]?.data.env?.timestamp || new Date().toISOString();
  out.push(`# OPFS sync write benchmark: ${path.basename(dir)}`, '');
  const host = hostText(runs);
  if (host) out.push(`Host: ${host}  `);
  if (okRuns[0]) out.push(`Config: ${configText(okRuns[0].data)}  `);
  out.push(`Browsers: ${runs.map((r) => `${r.label}${r.data.automation?.headless === false ? ' (headed)' : ''}`).join(', ')}  `);
  out.push(`Date: ${when}`, '');

  let table = '';
  if (okRuns.length) {
    const base = okRuns[0];
    const others = okRuns.slice(1);
    const header = ['Workload', ...okRuns.map((r) => `${r.label} µs/call`), ...others.map((r) => `${r.label} ÷ ${base.label}`), ...okRuns.map((r) => `${r.label} total`)];
    const lines = [`| ${header.join(' | ')} |`, `|---|${header.slice(1).map(() => '---:').join('|')}|`];
    for (const row of rows) {
      const cells = [row.label];
      for (const r of okRuns) cells.push(row.by[r.name] ? fmtUs(usOf(row.by[r.name])) : '–');
      for (const r of others) cells.push(row.by[r.name] && row.by[base.name] ? fmtRatio(usOf(row.by[r.name]) / usOf(row.by[base.name])) : '–');
      for (const r of okRuns) cells.push(row.by[r.name] ? fmtMs(row.by[r.name].median.totalMs) : '–');
      lines.push(`| ${cells.join(' | ')} |`);
    }
    table = lines.join('\n');
    out.push('## Comparison (median run, mean time per call)', '', table, '');
  }
  for (const r of runs) {
    out.push(`## ${r.label}`, '');
    if (r.summary) out.push(r.summary.trim(), '');
    else out.push(`Did not complete: ${r.data.error?.message || r.data.support?.reason || 'unknown error'}`, '');
  }
  return { text: `${out.join('\n')}\n`, table };
}

// --- HTML ------------------------------------------------------------------------------

function renderHtml(runs, okRuns, rows) {
  const title = `OPFS sync write benchmark`;
  const when = runs[0]?.data.env?.timestamp || '';
  const chart = okRuns.length ? renderChart(okRuns, rows) : '<p class="muted">No completed runs to chart.</p>';
  const seriesCss = (mode) => Object.entries(SERIES).map(([k, v]) => `--series-${k}: ${v[mode]};`).join(' ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} ${esc(when.slice(0, 10))}</title>
<style>
:root {
  color-scheme: light dark;
  --surface: #fcfcfb; --page: #f9f9f7; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --axis: #c3c2b7; --border: rgba(11,11,11,0.10);
  ${seriesCss('light')}
}
@media (prefers-color-scheme: dark) {
  :root {
    --surface: #1a1a19; --page: #0d0d0d; --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --border: rgba(255,255,255,0.10);
    ${seriesCss('dark')}
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 1080px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 1.4rem; margin: 0 0 4px; }
h2 { font-size: 1.05rem; margin: 24px 0 8px; }
p { margin: 0 0 8px; }
.muted { color: var(--muted); }
.sub { color: var(--ink-2); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin: 12px 0; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 4px 0 8px; color: var(--ink-2); }
.legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; background: var(--swatch); }
.chart-wrap { overflow-x: auto; }
svg text { font: 12px system-ui, -apple-system, "Segoe UI", sans-serif; fill: var(--ink); }
svg .tick { fill: var(--muted); font-size: 11px; }
svg .ratio { fill: var(--ink-2); font-variant-numeric: tabular-nums; }
svg .grid { stroke: var(--grid); stroke-width: 1; }
svg .axis { stroke: var(--axis); stroke-width: 1; }
svg .link { stroke: var(--axis); stroke-width: 2; stroke-linecap: round; }
svg .dot { stroke: var(--surface); stroke-width: 2; }
svg .hit { fill: transparent; }
svg .hit:hover + .dot, svg .dot:hover { r: 7; }
.table-wrap { overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 0.92em; }
th, td { padding: 6px 8px; border-bottom: 1px solid var(--grid); text-align: left; vertical-align: top; }
th { color: var(--ink-2); font-weight: 600; white-space: nowrap; }
th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.wl { font-weight: 600; }
td .desc { color: var(--muted); font-size: 0.88em; font-weight: 400; }
details { margin: 8px 0; }
summary { cursor: pointer; color: var(--ink-2); }
pre { background: var(--page); border: 1px solid var(--border); border-radius: 6px; padding: 10px; overflow: auto; font-size: 0.85em; white-space: pre-wrap; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 0.92em; }
</style>
</head>
<body>
<main>
  <h1>${esc(title)}</h1>
  <p class="sub">${esc(when)} · ${esc(hostText(runs))}</p>
  ${okRuns[0] ? `<p class="sub">Config: ${esc(configText(okRuns[0].data))}</p>` : ''}

  <section class="card">
    <h2 style="margin-top:0">Mean time per call, median run</h2>
    <p class="muted">Log scale. Each row is one workload; the distance between the two marks is the ratio between browsers, printed on the right. Hover a mark for p50 and p99. The table below has every number.</p>
    <div class="legend">${okRuns.map((r) => `<span style="--swatch: var(--series-${seriesKey(r.name)})">${esc(r.label)}${r.data.automation?.headless === false ? ' (headed)' : ''}</span>`).join('')}</div>
    <div class="chart-wrap">${chart}</div>
  </section>

  <section class="card">
    <h2 style="margin-top:0">Table</h2>
    <div class="table-wrap">${renderTable(okRuns, rows)}</div>
  </section>

  <section class="card">
    <h2 style="margin-top:0">Environment</h2>
    ${renderEnvironment(runs)}
  </section>

  ${runs.map((r) => `<details class="card"><summary>${esc(r.label)}: Bugzilla summary</summary><pre>${esc(r.summary || `Did not complete: ${r.data.error?.message || r.data.support?.reason || 'unknown error'}`)}</pre></details>`).join('\n  ')}
</main>
</body>
</html>
`;
}

const seriesKey = (name) => (SERIES[name] ? name : 'other');

// Dot plot on a log axis: one row per workload, one marker per browser, a
// connector between the extremes, ratio at the right. Marks are >= 10 px with
// a 2 px surface ring; hit targets are 24 px.
function renderChart(okRuns, rows) {
  const left = 230, right = 180, top = 34, rowH = 30, plotW = 600;
  const width = left + plotW + right;
  const height = top + rows.length * rowH + 16;
  const values = rows.flatMap((row) => okRuns.map((r) => row.by[r.name]).filter(Boolean).map(usOf));
  const lo = Math.floor(Math.log10(Math.max(0.1, Math.min(...values))));
  const hi = Math.ceil(Math.log10(Math.max(...values) * 1.05));
  const x = (v) => left + ((Math.log10(Math.max(v, 10 ** lo)) - lo) / (hi - lo)) * plotW;
  const tickLabel = (p) => (p >= 3 ? `${10 ** (p - 3)} ms` : `${10 ** p} µs`);
  const parts = [];
  for (let p = lo; p <= hi; p++) {
    parts.push(`<line class="grid" x1="${x(10 ** p)}" x2="${x(10 ** p)}" y1="${top - 6}" y2="${height - 16}"/>`);
    parts.push(`<text class="tick" x="${x(10 ** p)}" y="${top - 12}" text-anchor="middle">${tickLabel(p)}</text>`);
  }
  parts.push(`<line class="axis" x1="${left}" x2="${left + plotW}" y1="${height - 16}" y2="${height - 16}"/>`);
  const base = okRuns[0];
  rows.forEach((row, i) => {
    const y = top + i * rowH + rowH / 2;
    const present = okRuns.filter((r) => row.by[r.name]);
    const xs = present.map((r) => x(usOf(row.by[r.name])));
    parts.push(`<text x="${left - 12}" y="${y + 4}" text-anchor="end">${esc(row.label)}</text>`);
    if (xs.length > 1) parts.push(`<line class="link" x1="${Math.min(...xs)}" x2="${Math.max(...xs)}" y1="${y}" y2="${y}"/>`);
    for (const r of present) {
      const w = row.by[r.name];
      const m = w.median;
      const tip = `${r.label} — ${row.label}: mean ${fmtUs(usOf(w))}/call, p50 ${fmtUs(m.p50Ms * 1000)}, p99 ${fmtUs(m.p99Ms * 1000)}, total ${fmtMs(m.totalMs)}`;
      parts.push(`<circle class="hit" cx="${x(usOf(w))}" cy="${y}" r="12"><title>${esc(tip)}</title></circle>`);
      parts.push(`<circle class="dot" cx="${x(usOf(w))}" cy="${y}" r="5" fill="var(--series-${seriesKey(r.name)})"><title>${esc(tip)}</title></circle>`);
    }
    if (okRuns.length === 2 && row.by[base.name] && row.by[okRuns[1].name]) {
      const ratio = usOf(row.by[okRuns[1].name]) / usOf(row.by[base.name]);
      parts.push(`<text class="ratio" x="${left + plotW + 48}" y="${y + 4}">${fmtRatio(ratio)}</text>`);
    }
  });
  if (okRuns.length === 2) {
    parts.push(`<text class="tick" x="${width - 6}" y="${top - 12}" text-anchor="end">${esc(okRuns[1].label)} ÷ ${esc(base.label)}</text>`);
  }
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mean time per call for each workload and browser, log scale">${parts.join('')}</svg>`;
}

function renderTable(okRuns, rows) {
  const base = okRuns[0];
  const others = okRuns.slice(1);
  const head = ['<th>Workload</th>'];
  for (const r of okRuns) head.push(`<th class="num">${esc(r.label)} µs/call</th><th class="num">p50 / p99 (µs)</th><th class="num">total</th>`);
  for (const r of others) head.push(`<th class="num">${esc(r.label)} ÷ ${esc(base.label)}</th>`);
  const body = rows.map((row) => {
    const cells = [`<td class="wl">${esc(row.label)}<div class="desc">${esc(row.description || '')}</div></td>`];
    for (const r of okRuns) {
      const w = row.by[r.name];
      if (!w) { cells.push('<td class="num">–</td><td class="num">–</td><td class="num">–</td>'); continue; }
      cells.push(`<td class="num">${fmtUs(usOf(w))}</td><td class="num">${(w.median.p50Ms * 1000).toFixed(0)} / ${(w.median.p99Ms * 1000).toFixed(0)}</td><td class="num">${fmtMs(w.median.totalMs)}</td>`);
    }
    for (const r of others) {
      cells.push(`<td class="num">${row.by[r.name] && row.by[base.name] ? fmtRatio(usOf(row.by[r.name]) / usOf(row.by[base.name])) : '–'}</td>`);
    }
    return `<tr>${cells.join('')}</tr>`;
  });
  return `<table><thead><tr>${head.join('')}</tr></thead><tbody>${body.join('')}</tbody></table>`;
}

function renderEnvironment(runs) {
  const rowsHtml = runs.map((r) => {
    const a = r.data.automation || {};
    const s = r.data.support || {};
    const res = s.timerResolutionMs != null ? `${(s.timerResolutionMs * 1000).toFixed(0)} µs` : '–';
    return `<tr><td class="wl">${esc(r.label)}</td><td>${esc(a.version || '–')}</td><td>${a.headless === false ? 'headed' : 'headless'}</td><td class="num">${res}</td><td>${s.crossOriginIsolated ? 'yes' : 'no'}</td><td><code>${esc(a.executablePath || '–')}</code></td><td><code>${esc(r.data.env?.userAgent || '–')}</code></td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table><thead><tr><th>Browser</th><th>Version</th><th>Mode</th><th class="num">performance.now() step</th><th>Isolated</th><th>Executable</th><th>User agent</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

// --- CLI -----------------------------------------------------------------------------------

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node report.mjs <run-dir>');
    process.exit(2);
  }
  buildReport(path.resolve(dir)).then((r) => {
    console.log(`${r.runs} browser file(s), ${r.rows} workload row(s)`);
    if (r.table) console.log(`\n${r.table}`);
    console.log(`\nWrote ${path.join(path.resolve(dir), 'summary.md')} and report.html`);
  }).catch((err) => {
    console.error(err.stack || err);
    process.exit(1);
  });
}
