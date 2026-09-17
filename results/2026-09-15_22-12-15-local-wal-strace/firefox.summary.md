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
