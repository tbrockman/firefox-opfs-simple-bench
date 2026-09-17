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
