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
