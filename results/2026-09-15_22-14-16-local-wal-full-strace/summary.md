# OPFS sync write benchmark: 2026-09-15_22-14-16-local-wal-full-strace

Host: AMD Ryzen 7 7800X3D 8-Core Processor (16 threads), 65 GB, linux 7.0.0-31-generic x64  
Config: preset=quick+overrides, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=1, M=200  
Browsers: Firefox 158  
Profiles on: ext4 (/)  
Single-browser run (firefox): no cross-browser comparison.  
Local build: Firefox 158 from /home/theo/dev/firefox/obj-opt/dist/bin/firefox.  
Note: Local mozilla-central build 8d76a2ba4c (Firefox 158.0a1, plain opt build) with patches/0002-opfs-metadata-wal-synchronous-full.patch (PRAGMA journal_mode = WAL plus synchronous = FULL)  
Traced with strace: durability syscalls are counted below; ptrace overhead applies to those calls only.  
Date: 2026-09-16T05:14:19.235Z

## Per-file cost (median run, mean time per call)

| Workload | Firefox 158 µs/call | Firefox 158 total |
|---|---:|---:|
| new-file: create+open | 17.4 ms | 3.5 s |
| new-file: first write | 417 µs | 83.5 ms |
| new-file: close | 11.1 ms | 2.2 s |
| new-file: delete | 11.3 ms | 2.3 s |
| new-file: full cycle | 40.2 ms | 8.0 s |

## Durability syscalls per call (strace)

Counted with strace (fsync,fdatasync,syncfs,sync_file_range), attributed to workloads by wall-clock window; "per call" divides by calls × passes (warm-up included).

| Workload | Firefox 158 syncs/call | Firefox 158 ms in sync/call | Firefox 158 outside loop, per pass |
|---|---:|---:|---:|
| new-file | 7.1 | 36.25 | 0.00 |

"Outside the loop" is the per-pass file creation and deletion that workloads 1–4 do around their timed loop; new-file times those steps inside the loop.

Firefox 158: 3259 calls, 17.5 s inside them, 409 outside any workload. Most-synced files:
- `profile/storage/default/http+++127.0.0.1+44515/fs/metadata.sqlite-wal`: 2832 calls, 14.31 s
- `profile/datareporting/glean/db/glean.sqlite-wal`: 52 calls, 0.39 s
- `profile`: 51 calls, 0.39 s
- `profile/storage/permanent/chrome/idb`: 29 calls, 0.24 s
- `profile/datareporting/glean/db/glean.sqlite`: 27 calls, 0.18 s
- `profile/storage.sqlite-journal`: 20 calls, 0.12 s
- `profile/favicons.sqlite-wal`: 12 calls, 0.10 s
- `profile/storage/default/http+++127.0.0.1+44515/fs/metadata.sqlite`: 12 calls, 0.06 s

## Firefox 158

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T05:14:19.235Z
- performance.now() resolution in the worker: 20 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 2.0 MB used of 10737 MB
- Config: preset=quick+overrides, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=1, M=200

Median run of R=1 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| new-file: create+open | 200 | – | 3476.7 | 3476.7–3476.7 | 58 | – | 17100.0 | 17680.0 | 30400.0 | 39940.0 | 16360.0 |
| new-file: first write | 200 | 4,096 | 83.5 | 83.5–83.5 | 2,396 | 9.8 | 400.0 | 460.0 | 620.0 | 1160.0 | 380.0 |
| new-file: close | 200 | – | 2214.9 | 2214.9–2214.9 | 90 | – | 10800.0 | 11040.0 | 19640.0 | 29080.0 | 10700.0 |
| new-file: delete | 200 | – | 2255.4 | 2255.4–2255.4 | 89 | – | 11000.0 | 11260.0 | 18600.0 | 19660.0 | 11040.0 |
| new-file: full cycle | 200 | 4,096 | 8031.7 | 8031.7–8031.7 | 25 | 0.1 | 39280.0 | 40320.0 | 69020.0 | 70720.0 | 38480.0 |

Derived:
- new-file: 40.2 ms per file (25 files/s) = create+open 17.4 + first write 0.4 + close 11.1 + delete 11.3 ms
- new-file without delete (what populating OPFS pays per file): 28.9 ms

