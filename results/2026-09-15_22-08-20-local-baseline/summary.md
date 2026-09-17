# OPFS sync write benchmark: 2026-09-15_22-08-20-local-baseline

Host: AMD Ryzen 7 7800X3D 8-Core Processor (16 threads), 65 GB, linux 7.0.0-31-generic x64  
Config: preset=quick, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=3, M=200  
Browsers: Firefox 158  
Profiles on: ext4 (/)  
Date: 2026-09-16T05:08:22.753Z

## Per-call write cost (median run, mean time per call)

| Workload | Firefox 158 µs/call | Firefox 158 total |
|---|---:|---:|
| small-append | 42.6 µs | 85.1 ms |
| small-overwrite | 39.4 µs | 78.8 ms |
| chunked-append (64 KiB) | 54.7 µs | 6.8 ms |
| chunked-append (1 MiB) | 195 µs | 1.6 ms |
| append+flush | 5310 µs | 10.6 s |

## Per-file cost (median run, mean time per call)

| Workload | Firefox 158 µs/call | Firefox 158 total |
|---|---:|---:|
| new-file: create+open | 32.4 ms | 6.5 s |
| new-file: first write | 109 µs | 21.9 ms |
| new-file: close | 21.0 ms | 4.2 s |
| new-file: delete | 21.7 ms | 4.3 s |
| new-file: full cycle | 75.2 ms | 15.0 s |

## Firefox 158

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T05:08:22.753Z
- performance.now() resolution in the worker: 20 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.5 MB used of 10737 MB
- Config: preset=quick, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=3, M=200

Median run of R=3 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 2,000 | 4,096 | 85.1 | 84.1–88.4 | 23,491 | 96.2 | 40.0 | 60.0 | 80.0 | 840.0 | 120.0 |
| small-overwrite | 2,000 | 4,096 | 78.8 | 77.3–78.9 | 25,374 | 103.9 | 40.0 | 40.0 | 60.0 | 80.0 | 80.0 |
| chunked-append (64 KiB) | 125 | 65,536 | 6.8 | 6.7–6.9 | 18,275 | 1197.7 | 60.0 | 60.0 | 80.0 | 140.0 | 140.0 |
| chunked-append (1 MiB) | 8 | 1,048,576 | 1.6 | 1.5–1.6 | 5,128 | 5251.3 | 180.0 | 240.0 | 240.0 | 240.0 | 240.0 |
| append+flush | 2,000 | 4,096 | 10620.8 | 10426.6–10689.3 | 188 | 0.8 | 5580.0 | 5920.0 | 7520.0 | 15140.0 | 4700.0 |
| new-file: create+open | 200 | – | 6479.3 | 6475.5–6551.8 | 31 | – | 31400.0 | 35760.0 | 42180.0 | 50500.0 | 39940.0 |
| new-file: first write | 200 | 4,096 | 21.9 | 21.8–22.7 | 9,149 | 37.5 | 100.0 | 140.0 | 160.0 | 160.0 | 120.0 |
| new-file: close | 200 | – | 4198.3 | 4185.5–4238.0 | 48 | – | 20360.0 | 22340.0 | 29600.0 | 30340.0 | 22340.0 |
| new-file: delete | 200 | – | 4342.0 | 4321.8–4353.7 | 46 | – | 21120.0 | 23200.0 | 26520.0 | 30160.0 | 20940.0 |
| new-file: full cycle | 200 | 4,096 | 15037.5 | 15023.3–15154.4 | 13 | 0.1 | 72940.0 | 79040.0 | 94940.0 | 120320.0 | 94940.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 39.4 µs/call mean, 40.0 µs p50
- Size-growing write (small-append): 42.6 µs/call mean, 40.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 3.2 µs mean, 0.0 µs p50
- Same 8.2 MB in 125 × 64 KiB calls: 6.8 ms (1198 MB/s) vs 85.1 ms for 2,000 × 4 KiB; the small calls are 12.4× slower for the same bytes
- Same 8.2 MB in 8 × 1 MiB calls: 1.6 ms (5251 MB/s) vs 85.1 ms for 2,000 × 4 KiB; the small calls are 54.6× slower for the same bytes
- flush() after every write adds 5267.8 µs/call on top of small-append (append+flush: 5310.4 µs/call mean)
- small-append: first call into the fresh file 120.0 µs vs p50 40.0 / p99 80.0 µs; across runs 80.0–140.0 µs
- chunked-append (64 KiB): first call into the fresh file 140.0 µs vs p50 60.0 / p99 80.0 µs; across runs 120.0–160.0 µs
- chunked-append (1 MiB): first call into the fresh file 240.0 µs vs p50 180.0 / p99 240.0 µs; across runs 220.0–280.0 µs
- append+flush: first call into the fresh file 4700.0 µs vs p50 5580.0 / p99 7520.0 µs; across runs 4700.0–5680.0 µs
- new-file: 75.2 ms per file (13 files/s) = create+open 32.4 + first write 0.1 + close 21.0 + delete 21.7 ms
- new-file without delete (what populating OPFS pays per file): 53.5 ms
- First write into a new file (4 KiB): 109.3 µs vs 42.6 µs per small-append call

