# OPFS sync write overhead benchmark

A reproducible browser benchmark for `FileSystemSyncAccessHandle.write()`
on the Origin Private File System (OPFS). It separates the **per-call**
cost of synchronous writes from raw disk bandwidth, and the cost of
**creating, opening, closing and deleting files** from the cost of writing
bytes, so that differences between browsers can be attributed to one of
those and attached to a bug report.

**Motivating case.** Populating OPFS from a snapshot, whether as many
individual files under paths or as raw bytes written in chunks into one
file, took about 20× longer in Firefox than in Chrome on the same machine.
The workloads below cover both shapes.

## Files

| File         | Purpose |
|--------------|---------|
| `index.html` | UI: configuration, results table, "Copy Bugzilla summary", JSON download. Plain ES module, no build step, no dependencies. |
| `worker.js`  | All OPFS work. `createSyncAccessHandle()` is only available in dedicated workers. Every workload is commented with what it isolates. |
| `bench.css`  | Styling. |
| `serve.py`   | Optional stdlib server that adds COOP/COEP headers so `performance.now()` gets microsecond resolution (see [Timer resolution](#timer-resolution)). |
| `README.md`  | This file. |
| `patches/` | Experimental mozilla-central patches for the OPFS metadata database, with build recipe and measured results. See [patches/README.md](patches/README.md). |
| `automation/` | Optional Puppeteer driver: isolated Chrome and Firefox runs in series, JSON collection, `summary.md` and `report.html`. See [Automated runs](#automated-runs-puppeteer). |

## Workloads

Every pass runs on its own fresh file, which is deleted afterwards. Each
workload gets one warm-up pass and then R measured runs. The table shows
the run with the median total time, plus the min and max total across runs.

| # | Workload        | What it does                                                          | What it isolates |
|---|-----------------|-----------------------------------------------------------------------|------------------|
| 1 | small-append    | N × `write(S bytes, {at: currentSize})`; the file grows on every call  | Fixed per-call cost plus whatever the engine does when a write grows the file. |
| 2 | small-overwrite | N × `write(S bytes, {at: 0})` into a file pre-sized to S bytes         | Fixed per-call cost only; the size never changes. **1 − 2 is the cost of growing the file.** |
| 3 | chunked-append  | The same total bytes as 1, appended in 64 KiB and 1 MiB calls         | Per-byte cost. If total time collapses here, the overhead is per call, not per byte. |
| 4 | append+flush    | Workload 1 with `flush()` after every write                           | Flush cost. Reported separately because flush semantics and costs legitimately differ between engines. |
| 5 | new-file        | M × create+open → write S bytes → close → delete, **each step timed on its own**, distinct file names | What creating a file costs, step by step, with nothing amortised over a long write loop. Reported as five rows: create+open, first write, close, delete, full cycle. |

Two details about new files, since they are easy to miss:

- Workloads 1, 3 and 4 create a brand-new file for every pass, but creating
  and opening it happens **outside** the timed loop. The first write into
  that empty file is call number 1 of the loop. It is reported on its own
  as the **1st call** column (and, across runs, as `firstCallMsMin/Max` in
  the JSON), so a slow first write cannot hide inside the percentiles.
- Workload 5 is the only one that times `getFileHandle({create: true})`,
  `createSyncAccessHandle()`, `close()` and `removeEntry()`. Populating OPFS
  does not delete, so its per-file cost is create+open plus first write plus
  close; the summary prints that sum.

Defaults (the **Full** preset): N = 20000, S = 4096 bytes (≈ 82 MB per
append pass), R = 5, chunk sizes 64 KiB and 1 MiB, M = 2000. The **Quick**
preset uses N = 2000, R = 3, M = 200. N, S, chunk sizes, R and M are all
editable; a note under the fields shows how much data each pass writes.

Expected duration: workloads 1–3 take seconds. Workload 4 is bound by
`fsync` (a few milliseconds per call on an SSD with write barriers), so the
full preset spends N × a few ms × (R + 1), roughly 10 minutes, there in
every browser. Workload 5 costs M file creations per pass; at tens of
milliseconds per file that is another 10–15 minutes for M = 2000 and R = 5.
The log prints a projection after every warm-up pass. For a first look
untick 4 and 5; every row is independent, so they can be run on their own
later with a smaller N or M.

Measurement details:

- `performance.now()` is called on the worker thread around every call and
  the delta stored in a `Float64Array` allocated before the loop starts. The
  whole loop is timed separately, so total time, ops/s and MB/s
  (MB = 10⁶ bytes) do not depend on the clock's resolution; p50/p90/p99/max
  and the 1st-call column do.
- Access handles are closed and files removed in `finally` blocks. On
  startup the worker deletes any `opfs-bench-*` file left by an aborted run.
- `QuotaExceededError` is caught and reported with the pass size, so you can
  lower N or S.

## Running it

### 1. Serve the directory

```sh
cd firefox-opfs
python3 -m http.server 8000
```

Open <http://localhost:8000/>. `localhost` is a secure context, which OPFS
requires. For microsecond-resolution latency percentiles use the bundled
server instead (same directory, stdlib only, adds COOP/COEP headers):

```sh
python3 serve.py 8000
```

### 2. Firefox

1. Use a normal window. OPFS is not available in private browsing; the page
   detects this and says so.
2. Close other tabs on the same origin. Sync access handles take an
   exclusive lock; a stale handle in another tab shows up as
   `NoModificationAllowedError`.
3. Open <http://localhost:8000/>, pick **Quick** to check that everything
   works, then **Full**, and click **Run benchmark**.
4. When it finishes, click **Copy Bugzilla summary** (Markdown table plus
   environment) and **Download JSON** (raw numbers for every run).

If the support banner reports a coarse timer (1 ms), either serve with
`serve.py` or set `privacy.reduceTimerPrecision` to `false` in
`about:config` and reload. The banner and the summary always state the
resolution that was actually measured.

### 3. Chrome / Chromium

Same steps. The benchmark opens handles with plain
`createSyncAccessHandle()`; it does not use `mode: "readwrite-unsafe"` or
any other Chromium-only option. Without `serve.py` Chrome's clock is 100 µs.

### 4. Safari

Safari 17 or later (macOS 14+): all `FileSystemSyncAccessHandle` methods are
synchronous there. Copy this directory to the Mac, run
`python3 -m http.server 8000` (or `serve.py`) and open
<http://localhost:8000/> in Safari. Earlier Safari versions expose
Promise-returning `read`/`write`; the page probes for that and reports the
API as unsupported. The author had no macOS host, so Safari is untested.

### Headless / scripted runs

`?autorun=quick` or `?autorun=full` starts the benchmark as soon as support
detection finishes and prints one line, `OPFS_BENCH_JSON {...}`, to the
console (or `OPFS_BENCH_ERROR {...}`).

Firefox, with a throwaway profile whose `user.js` contains
`user_pref("devtools.console.stdout.content", true);`:

```sh
firefox --headless --no-remote --profile /path/to/profile \
  'http://localhost:8000/?autorun=quick' 2>&1 | grep -m1 OPFS_BENCH_
```

Chrome:

```sh
google-chrome --headless=new --user-data-dir="$HOME/.cache/opfs-bench-chrome" \
  --enable-logging=stderr --v=0 'http://localhost:8000/?autorun=quick' 2>&1 | grep -m1 OPFS_BENCH_
```

Neither browser exits on its own; kill it once the line has appeared. Keep
throwaway profiles on the same filesystem as a normal profile: on Ubuntu
`/tmp` is tmpfs, where `flush()` costs microseconds instead of the
milliseconds an `fsync` costs on disk, which would misrepresent workload 4.
Firefox installed as a snap can only see profiles under your home directory.

### Automated runs (Puppeteer)

`automation/` holds a small Node driver that does the whole loop
unattended: it serves this directory with COOP/COEP headers, launches each
browser in series with a brand-new profile (so a brand-new, empty OPFS),
waits for the page to finish, saves the JSON and the Bugzilla summary,
closes the browser, deletes the profile, and finally builds a comparison
report. The benchmark page itself stays dependency-free; only the driver
needs npm.

```sh
cd automation
npm install                              # Puppeteer + Chrome for Testing
npx puppeteer browsers install firefox   # Firefox stable, pinned by Puppeteer
node run.mjs --preset quick              # Chrome, then Firefox
node run.mjs --preset full --browsers firefox,chrome --label ticket
node run.mjs --preset quick --workloads small-append,new-file --m 500
node run.mjs --preset quick --chrome-path /usr/bin/google-chrome --firefox-path /usr/bin/firefox
node run.mjs --preset full --strace-fsync --label strace          # Linux: count fsyncs per call
node run.mjs --preset full --profiles-dir /tmp/opfs-tmpfs --label tmpfs   # fsync-free control
node report.mjs ../results/<run-dir>     # rebuild summary.md and report.html from saved JSON
```

Each run writes `results/<timestamp>[-label]/` containing, per browser,
`<browser>.json` (the page's results plus an `automation` block with the
browser version, executable, mode and host details), `<browser>.summary.md`
and `<browser>.log`, plus `summary.md` (comparison table followed by each
Bugzilla summary) and `report.html` (standalone: a log-scale dot plot of
mean time per call per workload, the table behind it, environment details,
and the summaries). The report and `summary.md` are grouped into two
sections, per-call write cost (workloads 1–4) and per-file cost (workload
5), so each can be cited on its own. `node run.mjs --help` lists every
option, including `--headed`, `--n/--s/--runs/--m/--chunks/--workloads`
overrides, `--keep-profiles` and `--timeout-min`.

`--strace-fsync` (Linux) launches each browser under `strace`, following
every child process, and counts `fsync`, `fdatasync`, `syncfs` and
`sync_file_range` calls. The worker stamps each workload with its wall-clock
window, so the driver attributes every call to a workload and reports
syncs per call (calls × passes, warm-up included) and the most-synced files,
in a third report section and in the JSON under `automation.strace`. The raw
log is kept as `<browser>.strace.log.gz`. strace's seccomp filter leaves
untraced syscalls at native speed, so only the traced calls carry ptrace
overhead; still, label such runs and do not mix their timings with clean
ones.

The fsync-free control is a run whose profiles live on tmpfs
(`--profiles-dir /tmp/...` on Linux): whatever cost survives there is CPU
and IPC, whatever disappears was durable writes.

Notes:

- Throwaway profiles are created under `automation/.profiles/` (gitignored)
  so they sit on the same disk as the repository. Pass `--profiles-dir` if
  the repository lives on tmpfs, otherwise `flush()` costs vanish.
- `--firefox-path` and `--chrome-path` point the driver at system browsers.
  A snap-packaged Firefox can only read profiles under your home directory,
  so keep `--profiles-dir` there.
- Puppeteer's Chrome for Testing has no AppArmor profile, and Ubuntu 23.10+
  denies unprivileged user namespaces to unconfined binaries, so its sandbox
  cannot start. The driver notices and retries with `--no-sandbox` (noted
  in `chrome.log` and in the JSON's `automation.launchArgs`); that changes
  Chrome's process isolation, not what the benchmark measures. To avoid it
  entirely use the packaged browser: `--chrome-path /usr/bin/google-chrome`.
- The page exposes `window.__opfsBench` (`ready`, `support`, `progress`,
  `done`, `results`, `summary`) for the driver; it is also handy from the
  devtools console.

## Reading the results

Run the same preset in each browser on the same machine, then compare row by
row. The "Derived" block in the summary prints these for you:

- **Fixed per-call floor** = small-overwrite mean µs/call. What a call costs
  when nothing about the file changes.
- **Cost of growing the file** = small-append − small-overwrite, per call.
- **Per call or per byte?** The same bytes written as 1 MiB chunks should be
  an order of magnitude faster than as 4 KiB calls if the overhead is per
  call. The summary prints the ratio.
- **First write into a fresh file**: the 1st-call column of small-append,
  chunked-append and append+flush, against that row's p50 and p99. The
  summary flags it when it is at least 3× p99.
- **Per-file cost**: the new-file rows. The full-cycle row is what a
  create/write/close/delete loop costs; the summary also prints the sum
  without delete, which is what populating OPFS pays per file, and compares
  the first write into a new file with a small-append call.
- **append+flush** is a control: both browsers flush per call, so this row
  shows what one durable flush costs on this machine and that the disk
  treats both browsers alike. Do not subtract it from anything.
- **Syncs per call** (traced runs): how many durability syscalls each
  workload issues per call, and which files they hit. Expect about 1 for
  append+flush and 0 for the other write workloads; anything above 0 in the
  per-file rows is metadata being committed synchronously. Compare with a
  tmpfs run: the per-file cost that remains on tmpfs is the CPU/IPC floor,
  the rest is syncs × the platform's fsync cost (real cache flush on Linux,
  cheap on macOS, where `fsync()` does not flush the drive).

## Capturing a Firefox Profiler recording with IPC markers

A profile taken while workload 1 runs shows what the worker thread does per
`write()` call, including any IPC round-trips, without guessing.

1. Go to <https://profiler.firefox.com/> and click **Enable Firefox Profiler
   menu button**. A profiler button appears in the toolbar.
2. Click the profiler button, then **Edit Settings…** (this opens
   `about:profiling`).
3. Choose the **Custom** preset and set:
   - **Interval**: 1 ms (0.5 ms if you want denser samples).
   - **Buffer size**: 256 MB or more.
   - **Threads**: keep the defaults and add `DOM Worker` (the thread the
     benchmark runs on) and `StreamTrans` (the StreamTransportService pool:
     the access handle dispatches every read and write to a task queue on
     that pool and blocks the worker until it completes, so per-write
     activity, including any IPC, appears on a `StreamTrans #N` thread and
     not on the worker). To also see the parent-process side of any IPC add
     `IPDL Background` and `QuotaManager IO`.
   - **Features**: tick **IPC Messages**. Leave **Native Stacks** on so C++
     frames appear in the call tree.
4. In the benchmark page select the **Quick** preset and untick every
   workload except **1 small-append**, so the profile contains nothing else.
   (Repeat with only **5 new-file** ticked for a profile of file creation.)
5. Start recording (profiler button → **Start Recording**, or
   Ctrl+Shift+1), click **Run benchmark**, wait for "Done", then **Capture**
   (Ctrl+Shift+2).
6. In the profiler UI, find the content process for `localhost`. If tracks
   are hidden, right-click the track list and choose **Show all tracks**,
   or use the track search. The **DOM Worker** track shows only the
   per-open messages (`Msg_GetFileHandle`, `Msg_GetAccessHandle`,
   `Msg_Close`, `Msg_RemoveEntry`); its call tree shows `ReadOrWrite`
   waiting in a sync loop. Select the **StreamTrans #N** track that is busy
   during the run and open its **Marker Table**, filtered on `IPC`: whatever
   message repeats once per `write()` is what the ticket should name, with
   its per-message duration. That thread's **Call Tree** shows the C++ frames
   under the stream's `Write` the time goes to.
7. Click **Upload Local Profile**, keep hidden threads included, copy the
   permalink and paste it into the bug. Release and Nightly builds
   symbolicate automatically from Mozilla's symbol server.

## Publishing results (GitHub Pages)

`.github/workflows/pages.yml` publishes the committed results on every push
to `main`. Nothing is benchmarked in CI; the workflow runs
`node automation/site.mjs`, which copies every `results/<run>/` directory to
`runs/<run>/` on the site, generates `runs/index.html`, and uses the newest
clean run's `report.html` as the site's front page (runs traced with
`--strace-fsync` carry inflated timings, so they are listed but never
promoted). So the loop is: run the benchmark, commit the new
`results/<run>/` directory, push.

What to commit from a run directory: `chrome.summary.md`,
`firefox.summary.md`, `summary.md` and `report.html`. The per-browser JSON,
the browser logs and `run.json` contain absolute paths from your machine,
and `*.strace.log.gz` is ignored by git; keep those local and attach them to
the bug directly when they are needed as evidence. Each report records
which filesystem held the browser profiles, so a tmpfs control run says so
on its own page.

One-time setup: in the repository settings, under **Pages**, set **Source**
to **GitHub Actions**. To preview locally:

```sh
node automation/site.mjs && python3 -m http.server 8000 -d _site
```

## Caveats

- <a id="timer-resolution"></a>**Timer resolution.** Firefox clamps
  `performance.now()` to 1 ms unless the page is cross-origin isolated
  (then 20 µs); Chromium clamps to 100 µs (5 µs when isolated). `serve.py`
  sends `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` to get the finer clock. The
  page measures the real step and prints it in the banner and the summary.
  Coarse timers only blur the percentiles and the 1st-call column; totals,
  ops/s and MB/s are taken over the whole loop.
- **Page cache.** With ≈ 82 MB per pass everything fits in the OS page
  cache, so workloads 1–3 measure the browser, not the disk. Workload 4 is
  the one that reaches the disk on every call, and workload 5 may, depending
  on how the engine persists file metadata.
- **Quota.** The default full run writes ≈ 82 MB per pass and deletes the
  file between passes. If you raise N or S and hit `QuotaExceededError`,
  the page says which workload failed and how much a pass writes.
- **Stop** terminates the worker mid-loop. A new worker is started
  immediately and deletes the leftover file; if the browser has not released
  the lock yet you will see a log line about it and the file is removed on
  the next start.
- Keep the machine otherwise idle and run each browser several times; the
  min–max column tells you how stable a workload was.
