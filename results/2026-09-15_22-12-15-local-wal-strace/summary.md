# OPFS sync write benchmark: 2026-09-15_22-12-15-local-wal-strace

Host: AMD Ryzen 7 7800X3D 8-Core Processor (16 threads), 65 GB, linux 7.0.0-31-generic x64  
Config: preset=quick+overrides, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=1, M=200  
Browsers: Firefox 158  
Profiles on: ext4 (/)  
Single-browser run (firefox): no cross-browser comparison.  
Local build: Firefox 158 from /home/theo/dev/firefox/obj-opt/dist/bin/firefox.  
Note: Local mozilla-central build 8d76a2ba4c (Firefox 158.0a1, plain opt build) with patches/0001-opfs-metadata-wal.patch (PRAGMA journal_mode = WAL)  
Traced with strace: durability syscalls are counted below; ptrace overhead applies to those calls only.  
Date: 2026-09-16T05:12:17.762Z

## Per-file cost (median run, mean time per call)

| Workload | Firefox 158 µs/call | Firefox 158 total |
|---|---:|---:|
| new-file: create+open | 1325 µs | 265.0 ms |
| new-file: first write | 474 µs | 94.9 ms |
| new-file: close | 828 µs | 165.5 ms |
| new-file: delete | 896 µs | 179.2 ms |
| new-file: full cycle | 3525 µs | 705.0 ms |

## Durability syscalls per call (strace)

Counted with strace (fsync,fdatasync,syncfs,sync_file_range), attributed to workloads by wall-clock window; "per call" divides by calls × passes (warm-up included).

| Workload | Firefox 158 syncs/call | Firefox 158 ms in sync/call | Firefox 158 outside loop, per pass |
|---|---:|---:|---:|
| new-file | 0.12 | 0.78 | 0.00 |

"Outside the loop" is the per-pass file creation and deletion that workloads 1–4 do around their timed loop; new-file times those steps inside the loop.

Firefox 158: 442 calls, 3.2 s inside them, 395 outside any workload. Most-synced files:
- `profile`: 51 calls, 0.38 s
- `profile/datareporting/glean/db/glean.sqlite-wal`: 48 calls, 0.33 s
- `profile/storage/permanent/chrome/idb`: 28 calls, 0.23 s
- `profile/datareporting/glean/db/glean.sqlite`: 25 calls, 0.16 s
- `profile/storage/default/http+++127.0.0.1+41387/fs/metadata.sqlite-wal`: 22 calls, 0.17 s
- `profile/storage.sqlite-journal`: 20 calls, 0.12 s
- `profile/favicons.sqlite-wal`: 12 calls, 0.10 s
- `profile/storage/default/http+++127.0.0.1+41387/fs/metadata.sqlite`: 12 calls, 0.06 s

## Firefox 158

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T05:12:17.762Z
- performance.now() resolution in the worker: 20 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 2.0 MB used of 10737 MB
- Config: preset=quick+overrides, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=1, M=200

Median run of R=1 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| new-file: create+open | 200 | – | 265.0 | 265.0–265.0 | 755 | – | 1200.0 | 1340.0 | 8360.0 | 8600.0 | 1380.0 |
| new-file: first write | 200 | 4,096 | 94.9 | 94.9–94.9 | 2,108 | 8.6 | 500.0 | 560.0 | 800.0 | 1280.0 | 820.0 |
| new-file: close | 200 | – | 165.5 | 165.5–165.5 | 1,208 | – | 580.0 | 660.0 | 900.0 | 24840.0 | 820.0 |
| new-file: delete | 200 | – | 179.2 | 179.2–179.2 | 1,116 | – | 600.0 | 700.0 | 16080.0 | 25840.0 | 660.0 |
| new-file: full cycle | 200 | 4,096 | 705.0 | 705.0–705.0 | 284 | 1.2 | 2880.0 | 3160.0 | 25460.0 | 28040.0 | 3680.0 |

Derived:
- new-file: 3.5 ms per file (284 files/s) = create+open 1.3 + first write 0.5 + close 0.8 + delete 0.9 ms
- new-file without delete (what populating OPFS pays per file): 2.6 ms

