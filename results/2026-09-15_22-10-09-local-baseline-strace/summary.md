# OPFS sync write benchmark: 2026-09-15_22-10-09-local-baseline-strace

Host: AMD Ryzen 7 7800X3D 8-Core Processor (16 threads), 65 GB, linux 7.0.0-31-generic x64  
Config: preset=quick+overrides, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=1, M=200  
Browsers: Firefox 158  
Profiles on: ext4 (/)  
Traced with strace: fsync counts below; ptrace overhead applies to those calls only.  
Date: 2026-09-16T05:10:12.315Z

## Per-file cost (median run, mean time per call)

| Workload | Firefox 158 µs/call | Firefox 158 total |
|---|---:|---:|
| new-file: create+open | 48.6 ms | 9.7 s |
| new-file: first write | 614 µs | 122.7 ms |
| new-file: close | 31.6 ms | 6.3 s |
| new-file: delete | 32.3 ms | 6.5 s |
| new-file: full cycle | 113.1 ms | 22.6 s |

## Durability syscalls per call (strace)

Counted with strace (fsync,fdatasync,syncfs,sync_file_range), attributed to workloads by wall-clock window; "per call" divides by calls × passes (warm-up included).

| Workload | Firefox 158 syncs/call | Firefox 158 ms in sync/call | Firefox 158 outside loop, per pass |
|---|---:|---:|---:|
| new-file | 21 | 107.29 | 0.00 |

"Outside the loop" is the per-pass file creation and deletion that workloads 1–4 do around their timed loop; new-file times those steps inside the loop.

Firefox 158: 8862 calls, 46.2 s inside them, 421 outside any workload. Most-synced files:
- `profile/storage/default/http+++127.0.0.1+42247/fs/metadata.sqlite-journal`: 2810 calls, 14.30 s
- `profile/storage/default/http+++127.0.0.1+42247/fs`: 2810 calls, 14.19 s
- `profile/storage/default/http+++127.0.0.1+42247/fs/metadata.sqlite`: 2810 calls, 14.19 s
- `profile/datareporting/glean/db/glean.sqlite-wal`: 64 calls, 0.50 s
- `profile`: 51 calls, 0.42 s
- `profile/datareporting/glean/db/glean.sqlite`: 33 calls, 0.24 s
- `profile/storage/permanent/chrome/idb`: 29 calls, 0.26 s
- `profile/storage.sqlite-journal`: 20 calls, 0.13 s

## Firefox 158

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T05:10:12.315Z
- performance.now() resolution in the worker: 20 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.5 MB used of 10737 MB
- Config: preset=quick+overrides, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=1, M=200

Median run of R=1 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| new-file: create+open | 200 | – | 9729.5 | 9729.5–9729.5 | 21 | – | 47960.0 | 50880.0 | 56280.0 | 90540.0 | 52980.0 |
| new-file: first write | 200 | 4,096 | 122.7 | 122.7–122.7 | 1,629 | 6.7 | 580.0 | 660.0 | 940.0 | 3320.0 | 600.0 |
| new-file: close | 200 | – | 6321.0 | 6321.0–6321.0 | 32 | – | 31280.0 | 32680.0 | 35060.0 | 35460.0 | 35460.0 |
| new-file: delete | 200 | – | 6454.3 | 6454.3–6454.3 | 31 | – | 31740.0 | 33560.0 | 38240.0 | 41260.0 | 33560.0 |
| new-file: full cycle | 200 | 4,096 | 22628.2 | 22628.2–22628.2 | 9 | 0.0 | 111660.0 | 117840.0 | 122600.0 | 156640.0 | 122600.0 |

Derived:
- new-file: 113.1 ms per file (9 files/s) = create+open 48.6 + first write 0.6 + close 31.6 + delete 32.3 ms
- new-file without delete (what populating OPFS pays per file): 80.9 ms

