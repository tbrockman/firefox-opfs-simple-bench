// worker.js — OPFS FileSystemSyncAccessHandle.write() per-call overhead benchmark
//
// All Origin Private File System work lives in this dedicated worker because
// FileSystemFileHandle.createSyncAccessHandle() is only exposed to dedicated
// workers. index.html only renders what this worker posts back.
//
// Protocol, main -> worker
//   { type: 'init' }            feature-detect, delete leftover files, reply 'ready'
//   { type: 'run', config }     config = { n, s, chunkSizes, runs, m, workloads }
//
// Protocol, worker -> main
//   { type: 'ready', support }  { ok, reason, crossOriginIsolated, timerResolutionMs,
//                                 estimate, removedLeftovers }
//   { type: 'log', text }
//   { type: 'progress', jobId, label, phase, run, runs, jobIndex, jobCount }
//   { type: 'result', result }  one finished result row, see summarizeSeries()
//   { type: 'done' }
//   { type: 'error', error }    { name, message, stack, jobId, quotaExceeded }
//
// Timing. Everything is measured with performance.now() on this thread. Each
// call is bracketed by two performance.now() calls and the delta goes into a
// Float64Array preallocated before the timed loop starts. The whole loop is
// bracketed too, so total time, ops/s and MB/s do not depend on the clock's
// resolution. The percentiles do: Firefox clamps performance.now() to 1 ms
// unless the page is cross-origin isolated (then 20 µs); Chromium clamps to
// 100 µs (5 µs when isolated). init() measures the real resolution and
// reports it (serve.py sends the COOP/COEP headers that make the page
// cross-origin isolated).
//
// Files. Everything this worker creates is named "opfs-bench-*" in the OPFS
// root so an aborted run can be cleaned up on the next start. Every pass
// (warm-up or measured) gets a brand-new file that is deleted in a finally
// block, so no workload ever sees another workload's file. Creating and
// opening that file is outside the timed region for workloads 1–4; the first
// write into it is call number 1 of the loop and is reported separately as
// "first call". Workload 5 (new-file) times create/open, first write, close
// and delete each on their own.

const FILE_PREFIX = 'opfs-bench-';

let root = null;          // OPFS root directory handle, set by init()
let currentJobId = null;  // workload in flight, for error reports

self.onmessage = async (event) => {
  const msg = event.data;
  try {
    if (msg.type === 'init') {
      self.postMessage({ type: 'ready', support: await init() });
    } else if (msg.type === 'run') {
      if (!root) throw new Error('worker not initialised (init failed?)');
      await runAll(msg.config);
      self.postMessage({ type: 'done' });
    }
  } catch (err) {
    self.postMessage({ type: 'error', error: describeError(err) });
  } finally {
    currentJobId = null;
  }
};

function log(text) {
  self.postMessage({ type: 'log', text });
}

function describeError(err) {
  const name = (err && err.name) || 'Error';
  return {
    name,
    message: (err && err.message) || String(err),
    stack: (err && err.stack) || null,
    jobId: currentJobId,
    quotaExceeded: name === 'QuotaExceededError',
  };
}

// ---------------------------------------------------------------------------
// Startup: feature detection, leftover cleanup, clock resolution
// ---------------------------------------------------------------------------

async function init() {
  const support = {
    ok: false,
    reason: null,
    crossOriginIsolated: !!self.crossOriginIsolated,
    timerResolutionMs: measureTimerResolution(),
    estimate: null,
    removedLeftovers: 0,
  };

  if (!navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
    support.reason = 'navigator.storage.getDirectory() is not available in this worker (no OPFS).';
    return support;
  }
  if (typeof FileSystemFileHandle === 'undefined' ||
      typeof FileSystemFileHandle.prototype.createSyncAccessHandle !== 'function') {
    support.reason = 'FileSystemFileHandle.prototype.createSyncAccessHandle is missing; ' +
      'this browser has no synchronous OPFS access handles.';
    return support;
  }
  try {
    root = await navigator.storage.getDirectory();
  } catch (err) {
    support.reason = `navigator.storage.getDirectory() failed: ${err.name}: ${err.message}` +
      (err.name === 'SecurityError'
        ? ' (Firefox does not expose OPFS in private browsing windows; use a normal window.)'
        : '');
    return support;
  }

  support.removedLeftovers = await removeLeftovers();

  const probeProblem = await probeSyncAccessHandle();
  if (probeProblem) {
    support.reason = probeProblem;
    return support;
  }

  try {
    const est = await navigator.storage.estimate();
    support.estimate = { usage: est.usage, quota: est.quota };
  } catch {
    // estimate() is informational only
  }

  support.ok = true;
  return support;
}

// Best effort: delete anything named opfs-bench-* left behind by an aborted
// run (e.g. the user pressed Stop, which terminates the worker mid-loop).
async function removeLeftovers() {
  const names = [];
  try {
    for await (const name of root.keys()) {
      if (name.startsWith(FILE_PREFIX)) names.push(name);
    }
  } catch (err) {
    log(`Could not list the OPFS root for cleanup: ${err.name}: ${err.message}`);
    return 0;
  }
  let removed = 0;
  for (const name of names) {
    try {
      await root.removeEntry(name, { recursive: true });
      removed++;
    } catch (err) {
      log(`Could not remove leftover ${name}: ${err.name}: ${err.message}`);
    }
  }
  if (removed) log(`Removed ${removed} leftover benchmark file(s) from an earlier run.`);
  return removed;
}

// Open a real sync access handle once and make sure the methods are actually
// synchronous. Safari < 17 exposed createSyncAccessHandle() with
// Promise-returning read/write/getSize/close; that variant would silently
// measure nothing useful, so we refuse it.
async function probeSyncAccessHandle() {
  const name = `${FILE_PREFIX}probe`;
  try {
    const fileHandle = await root.getFileHandle(name, { create: true });
    const handle = await fileHandle.createSyncAccessHandle();
    try {
      const written = handle.write(new Uint8Array([1]), { at: 0 });
      if (typeof written !== 'number') {
        return 'createSyncAccessHandle() exists but write() returned a Promise instead of a byte ' +
          'count. This benchmark needs the synchronous API (Firefox 111+, Chrome 108+, Safari 17+).';
      }
      handle.flush();
      if (typeof handle.getSize() !== 'number') {
        return 'getSize() is not synchronous in this browser; the synchronous OPFS API is required.';
      }
      handle.truncate(0);
    } finally {
      handle.close();
    }
    return null;
  } catch (err) {
    const hint = err.name === 'NoModificationAllowedError'
      ? ' (another tab or a terminated worker may still hold the file lock; reload or close other tabs)'
      : '';
    return `Opening a sync access handle failed: ${err.name}: ${err.message}${hint}`;
  } finally {
    await root.removeEntry(name).catch(() => {});
  }
}

// Smallest positive step between two distinct performance.now() readings,
// sampled for ~30 ms. This is what the per-call latencies are quantised to.
function measureTimerResolution() {
  let min = Infinity;
  let prev = performance.now();
  const end = prev + 30;
  for (;;) {
    const t = performance.now();
    if (t > prev) {
      min = Math.min(min, t - prev);
      prev = t;
    }
    if (t >= end) break;
  }
  return min === Infinity ? null : min;
}

// ---------------------------------------------------------------------------
// Workloads
//
// Workloads 1–4 get an open FileSystemSyncAccessHandle on a fresh, empty file,
// the job descriptor and the preallocated latency array, and return
// { calls, bytes, totalMs }. Only the write loop is timed: creating, opening,
// closing and deleting the file happen outside the measured region.
// Workload 5 manages its own files and returns several series, one per step.
// ---------------------------------------------------------------------------

const KINDS = {
  'small-append': {
    run: smallAppend,
    isolates: 'Fixed per-call cost plus whatever the engine does when a write grows the file. ' +
      'Call number 1 is the first write into a file that has never been written; it is reported ' +
      'separately as "first call".',
  },
  'small-overwrite': {
    run: smallOverwrite,
    isolates: 'Fixed per-call cost only: the same call count and payload as small-append, but the ' +
      'file size never changes. small-append minus small-overwrite is the cost attributable to ' +
      'growing the file.',
  },
  'chunked-append': {
    run: chunkedAppend,
    isolates: 'Per-byte cost: the same total bytes as small-append written in far fewer, larger ' +
      'calls. If total time collapses here, the overhead is per call, not per byte.',
  },
  'append-flush': {
    run: appendFlush,
    isolates: 'small-append plus flush() after every write. Reported separately because flush ' +
      'semantics and costs legitimately differ between engines.',
  },
  'new-file': {
    run: newFile,
    ownFiles: true,
    phases: 5,
    isolates: 'What creating a file costs, step by step, with nothing amortised over a long write loop.',
  },
};

// Non-zero, non-uniform payload so no engine can special-case zero pages.
function payload(length) {
  const buf = new Uint8Array(length);
  for (let i = 0; i < length; i++) buf[i] = (i * 31 + 7) & 0xff;
  return buf;
}

// Workload 1 — small-append
// N writes of S bytes, each at offset == current file size, so every call
// extends the file. The offset is tracked from write()'s return value rather
// than via getSize() so nothing but write() is inside the timed region.
function smallAppend(handle, job, lat) {
  const buf = payload(job.bytesPerCall);
  let offset = 0;
  const t0 = performance.now();
  for (let i = 0; i < job.calls; i++) {
    const a = performance.now();
    offset += handle.write(buf, { at: offset });
    lat[i] = performance.now() - a;
  }
  return { calls: job.calls, bytes: offset, totalMs: performance.now() - t0 };
}

// Workload 2 — small-overwrite
// The file is pre-sized to S bytes (untimed), then N writes of S bytes land
// at offset 0. The file size never changes. Same N, S and payload as
// workload 1: the delta between the two is the cost of growing the file.
function smallOverwrite(handle, job, lat) {
  const buf = payload(job.bytesPerCall);
  handle.write(buf, { at: 0 });
  handle.flush();
  let bytes = 0;
  const t0 = performance.now();
  for (let i = 0; i < job.calls; i++) {
    const a = performance.now();
    bytes += handle.write(buf, { at: 0 });
    lat[i] = performance.now() - a;
  }
  return { calls: job.calls, bytes, totalMs: performance.now() - t0 };
}

// Workload 3 — chunked-append
// Same total bytes as workload 1, appended in chunks of job.chunkBytes
// (64 KiB and 1 MiB by default). Per-call latencies are recorded too; there
// are just far fewer of them.
function chunkedAppend(handle, job, lat) {
  const buf = payload(job.chunkBytes);
  let offset = 0;
  let calls = 0;
  const t0 = performance.now();
  while (offset < job.totalBytes) {
    const len = Math.min(buf.length, job.totalBytes - offset);
    const view = len === buf.length ? buf : buf.subarray(0, len);
    const a = performance.now();
    const written = handle.write(view, { at: offset });
    lat[calls++] = performance.now() - a;
    if (!(written > 0)) throw new Error(`write() returned ${written} at offset ${offset}`);
    offset += written;
  }
  return { calls, bytes: offset, totalMs: performance.now() - t0 };
}

// Workload 4 — append+flush
// Workload 1 with flush() after every write; the recorded latency covers the
// write()+flush() pair.
function appendFlush(handle, job, lat) {
  const buf = payload(job.bytesPerCall);
  let offset = 0;
  const t0 = performance.now();
  for (let i = 0; i < job.calls; i++) {
    const a = performance.now();
    offset += handle.write(buf, { at: offset });
    handle.flush();
    lat[i] = performance.now() - a;
  }
  return { calls: job.calls, bytes: offset, totalMs: performance.now() - t0 };
}

// Workload 5 — new-file
// M × { getFileHandle(create) + createSyncAccessHandle  |  write S bytes at 0
//       |  close  |  removeEntry }, each file under a distinct name and each
// step timed on its own. This is what populating OPFS with many files pays
// per file; a restore does not delete, so its per-file cost is the first
// three steps. Returned as five series: the four steps and the full cycle.
async function newFile(job, phases, passName) {
  const [open, write, close, remove, cycle] = phases;
  const buf = payload(job.bytesPerCall);
  let bytes = 0;
  const t0 = performance.now();
  for (let i = 0; i < job.calls; i++) {
    const name = `${FILE_PREFIX}new-${passName}-${i}`;
    const a0 = performance.now();
    const fileHandle = await root.getFileHandle(name, { create: true });
    const handle = await fileHandle.createSyncAccessHandle();
    const a1 = performance.now();
    let a2;
    try {
      bytes += handle.write(buf, { at: 0 });
      a2 = performance.now();
    } finally {
      handle.close();
    }
    const a3 = performance.now();
    await root.removeEntry(name);
    const a4 = performance.now();
    open[i] = a1 - a0;
    write[i] = a2 - a1;
    close[i] = a3 - a2;
    remove[i] = a4 - a3;
    cycle[i] = a4 - a0;
  }
  const totalMs = performance.now() - t0;
  const sum = (arr) => { let s = 0; for (let i = 0; i < job.calls; i++) s += arr[i]; return s; };
  const s = job.bytesPerCall;
  return [
    { key: 'open', label: 'new-file: create+open', bytesPerCall: 0, bytes: 0,
      description: `getFileHandle({create: true}) + createSyncAccessHandle() on a name that does not exist yet`,
      isolates: 'Bringing a new file into existence and taking its exclusive lock, with no bytes written.',
      calls: job.calls, totalMs: sum(open), latencies: open },
    { key: 'write', label: 'new-file: first write', bytesPerCall: s, bytes,
      description: `first write(${s} B, {at: 0}) into the empty file`,
      isolates: 'The first bytes into a file that has never been written. Compare with small-append\'s per-call cost and its first-call column.',
      calls: job.calls, totalMs: sum(write), latencies: write },
    { key: 'close', label: 'new-file: close', bytesPerCall: 0, bytes: 0,
      description: 'close() on the access handle',
      isolates: 'Releasing the handle and its lock.',
      calls: job.calls, totalMs: sum(close), latencies: close },
    { key: 'delete', label: 'new-file: delete', bytesPerCall: 0, bytes: 0,
      description: 'removeEntry(name)',
      isolates: 'Removing the file.',
      calls: job.calls, totalMs: sum(remove), latencies: remove },
    { key: 'cycle', label: 'new-file: full cycle', bytesPerCall: s, bytes,
      description: `create+open → write ${s} B → close → delete, per file`,
      isolates: 'The sum of the four steps above, measured as one bracket per file.',
      calls: job.calls, totalMs, latencies: cycle },
  ];
}

// ---------------------------------------------------------------------------
// Job list, passes, statistics
// ---------------------------------------------------------------------------

function fmtBytes(n) {
  if (n % 1048576 === 0) return `${n / 1048576} MiB`;
  if (n % 1024 === 0) return `${n / 1024} KiB`;
  return `${n} B`;
}

function buildJobs(config) {
  const { n, s, m } = config;
  const totalBytes = n * s;
  const want = new Set(config.workloads);
  const jobs = [];
  if (want.has('small-append')) {
    jobs.push({
      id: 'small-append', kind: 'small-append', label: 'small-append',
      calls: n, bytesPerCall: s, totalBytes,
      description: `${n} × write(${s} B) at offset = current size; the file grows on every call`,
    });
  }
  if (want.has('small-overwrite')) {
    jobs.push({
      id: 'small-overwrite', kind: 'small-overwrite', label: 'small-overwrite',
      calls: n, bytesPerCall: s, totalBytes: s,
      description: `${n} × write(${s} B) at offset 0 into a file pre-sized to ${s} B; the size never changes`,
    });
  }
  if (want.has('chunked-append')) {
    for (const chunk of config.chunkSizes) {
      const calls = Math.ceil(totalBytes / chunk);
      jobs.push({
        id: `chunked-append-${chunk}`, kind: 'chunked-append',
        label: `chunked-append (${fmtBytes(chunk)})`,
        calls, bytesPerCall: chunk, chunkBytes: chunk, totalBytes,
        description: `${calls} × write(${chunk} B) appending; the same ${totalBytes} B total as small-append`,
      });
    }
  }
  if (want.has('append-flush')) {
    jobs.push({
      id: 'append-flush', kind: 'append-flush', label: 'append+flush',
      calls: n, bytesPerCall: s, totalBytes,
      description: `small-append with flush() after every write (${n} × ${s} B)`,
    });
  }
  if (want.has('new-file')) {
    jobs.push({
      id: 'new-file', kind: 'new-file', label: 'new-file',
      calls: m, bytesPerCall: s, totalBytes: m * s,
      description: `${m} × create+open → write ${s} B → close → delete, each step timed separately`,
    });
  }
  return jobs;
}

async function runAll(config) {
  const jobs = buildJobs(config);
  if (!jobs.length) throw new Error('no workloads selected');

  // One latency buffer sized for the largest job, allocated before any timed
  // loop and reused by every pass of workloads 1–4.
  const scratch = { main: new Float64Array(Math.max(...jobs.map((j) => j.calls))), phases: null };

  for (let jobIndex = 0; jobIndex < jobs.length; jobIndex++) {
    const job = jobs[jobIndex];
    const kind = KINDS[job.kind];
    currentJobId = job.id;
    // Multi-series workloads get one buffer per step, allocated once per job.
    scratch.phases = kind.phases
      ? Array.from({ length: kind.phases }, () => new Float64Array(job.calls))
      : null;
    const progress = (phase, run) => self.postMessage({
      type: 'progress', jobId: job.id, label: job.label, phase, run,
      runs: config.runs, jobIndex, jobCount: jobs.length,
    });

    progress('warmup', 0);
    const warmup = await runPass(job, 'warmup', scratch);
    // flush() and file creation can cost milliseconds per call; tell the user
    // what the measured runs will take so they can Stop if needed.
    const w = warmup[warmup.length - 1].stats;
    log(`${job.label}: warm-up pass took ${(w.totalMs / 1000).toFixed(1)} s ` +
        `(${(w.meanMs * 1000).toFixed(1)} µs/call); ${config.runs} measured run(s) ≈ ` +
        `${(w.totalMs * config.runs / 1000).toFixed(0)} s more.`);

    const runs = [];
    for (let r = 1; r <= config.runs; r++) {
      progress('run', r);
      runs.push(await runPass(job, `run${r}`, scratch));
    }

    for (let k = 0; k < warmup.length; k++) {
      self.postMessage({
        type: 'result',
        result: summarizeSeries(job, warmup[k], runs.map((pass) => pass[k])),
      });
    }
  }
}

// One warm-up or measured pass. Workloads 1–4 run on a brand-new file whose
// handle is closed and which is deleted in finally blocks, so a thrown
// QuotaExceededError (or anything else) never leaves a locked or orphaned
// file behind. Returns one { meta, stats } per series.
async function runPass(job, passName, scratch) {
  const kind = KINDS[job.kind];
  let series;
  if (kind.ownFiles) {
    series = await kind.run(job, scratch.phases, passName);
  } else {
    const name = `${FILE_PREFIX}${job.id}-${passName}.bin`;
    await root.removeEntry(name).catch(() => {});
    const fileHandle = await root.getFileHandle(name, { create: true });
    try {
      const handle = await fileHandle.createSyncAccessHandle();
      try {
        series = [{ ...kind.run(handle, job, scratch.main), latencies: scratch.main }];
      } finally {
        handle.close();
      }
    } finally {
      await root.removeEntry(name).catch(() => {});
    }
  }
  return series.map((s) => ({
    meta: {
      id: s.key ? `${job.id}-${s.key}` : job.id,
      label: s.label || job.label,
      description: s.description || job.description,
      isolates: s.isolates || kind.isolates,
      bytesPerCall: s.bytesPerCall ?? job.bytesPerCall,
    },
    stats: stats(s),
  }));
}

// Percentiles use the nearest-rank method on a sorted copy of the recorded
// latencies. All *Ms fields are milliseconds (performance.now() units).
// firstCallMs is call number 1 of the pass: for the append workloads that is
// the first write into the freshly created file.
function stats({ calls, bytes, totalMs, latencies }) {
  const sorted = latencies.slice(0, calls).sort();
  const q = (p) => sorted[Math.min(calls - 1, Math.max(0, Math.ceil(p * calls) - 1))];
  const seconds = totalMs / 1000;
  return {
    calls,
    bytes,
    totalMs,
    opsPerSec: calls / seconds,
    mbPerSec: bytes / 1e6 / seconds,
    meanMs: totalMs / calls,
    firstCallMs: latencies[0],
    minMs: sorted[0],
    p50Ms: q(0.5),
    p90Ms: q(0.9),
    p99Ms: q(0.99),
    maxMs: sorted[calls - 1],
  };
}

// The reported "median run" is the actual run with the median total time
// (lower-middle for an even R), not an average of runs.
function summarizeSeries(job, warmup, runs) {
  const meta = warmup.meta;
  const runStats = runs.map((r) => r.stats);
  const order = runStats.map((_, i) => i).sort((a, b) => runStats[a].totalMs - runStats[b].totalMs);
  const medianIndex = order[Math.floor((runStats.length - 1) / 2)];
  const firstCalls = runStats.map((r) => r.firstCallMs);
  return {
    id: meta.id,
    kind: job.kind,
    label: meta.label,
    description: meta.description,
    isolates: meta.isolates,
    params: {
      calls: job.calls,
      bytesPerCall: meta.bytesPerCall,
      totalBytes: job.totalBytes,
      flushEveryWrite: job.kind === 'append-flush',
    },
    warmup: warmup.stats,
    runs: runStats,
    medianIndex,
    median: runStats[medianIndex],
    totalMsMin: runStats[order[0]].totalMs,
    totalMsMax: runStats[order[order.length - 1]].totalMs,
    firstCallMsMin: Math.min(...firstCalls),
    firstCallMsMax: Math.max(...firstCalls),
  };
}
