# OPFS sync write benchmark: 2026-09-15_19-49-35

Host: Apple M4 Pro (12 threads), 26 GB, darwin 25.6.0 arm64  
Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000  
Browsers: Chrome 153, Firefox 155  
Date: 2026-09-16T02:49:36.329Z

## Comparison (median run, mean time per call)

| Workload | Chrome 153 µs/call | Firefox 155 µs/call | Firefox 155 ÷ Chrome 153 | Chrome 153 total | Firefox 155 total |
|---|---:|---:|---:|---:|---:|
| small-append | 7.5 µs | 35.9 µs | 4.8× | 149.3 ms | 718.2 ms |
| small-overwrite | 2.9 µs | 29.0 µs | 10.1× | 57.4 ms | 580.1 ms |
| chunked-append (64 KiB) | 15.0 µs | 52.7 µs | 3.5× | 18.7 ms | 65.9 ms |
| chunked-append (1 MiB) | 451 µs | 169 µs | 0.4× | 35.7 ms | 13.4 ms |
| append+flush | 231 µs | 66.8 µs | 0.3× | 4.6 s | 1.3 s |
| new-file: create+open | 292 µs | 1636 µs | 5.6× | 584.1 ms | 3.3 s |
| new-file: first write | 57.1 µs | 42.3 µs | 0.7× | 114.2 ms | 84.6 ms |
| new-file: close | 78.7 µs | 764 µs | 9.7× | 157.3 ms | 1.5 s |
| new-file: delete | 134 µs | 1274 µs | 9.5× | 268.6 ms | 2.5 s |
| new-file: full cycle | 562 µs | 3670 µs | 6.5× | 1.1 s | 7.3 s |

## Chrome 153

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36`
- Platform: MacIntel; hardwareConcurrency: 12
- Timestamp: 2026-09-16T02:49:36.329Z
- performance.now() resolution in the worker: 5.0 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.0 MB used of 10737 MB
- Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000

Median run of R=5 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 20,000 | 4,096 | 149.3 | 138.0–153.9 | 133,967 | 548.7 | 5.0 | 10.0 | 20.0 | 4220.0 | 60.0 |
| small-overwrite | 20,000 | 4,096 | 57.4 | 56.4–57.8 | 348,432 | 1427.2 | 5.0 | 5.0 | 10.0 | 60.0 | 5.0 |
| chunked-append (64 KiB) | 1,250 | 65,536 | 18.7 | 18.5–35.1 | 66,827 | 4379.6 | 10.0 | 15.0 | 70.0 | 1025.0 | 85.0 |
| chunked-append (1 MiB) | 79 | 1,048,576 | 35.7 | 18.2–51.0 | 2,216 | 2297.9 | 70.0 | 2480.0 | 4705.0 | 4705.0 | 170.0 |
| append+flush | 20,000 | 4,096 | 4623.7 | 3847.8–6205.0 | 4,326 | 17.7 | 140.0 | 260.0 | 1710.0 | 15705.0 | 610.0 |
| new-file: create+open | 2,000 | – | 584.1 | 547.5–662.4 | 3,424 | – | 280.0 | 345.0 | 480.0 | 1840.0 | 305.0 |
| new-file: first write | 2,000 | 4,096 | 114.2 | 106.0–125.8 | 17,519 | 71.8 | 55.0 | 70.0 | 100.0 | 250.0 | 85.0 |
| new-file: close | 2,000 | – | 157.3 | 150.6–170.6 | 12,713 | – | 75.0 | 95.0 | 150.0 | 315.0 | 75.0 |
| new-file: delete | 2,000 | – | 268.6 | 250.0–327.9 | 7,446 | – | 115.0 | 165.0 | 215.0 | 19425.0 | 130.0 |
| new-file: full cycle | 2,000 | 4,096 | 1123.2 | 1059.9–1270.5 | 1,781 | 7.3 | 545.0 | 670.0 | 860.0 | 2300.0 | 535.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 2.9 µs/call mean, 5.0 µs p50
- Size-growing write (small-append): 7.5 µs/call mean, 5.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 4.6 µs mean, 0.0 µs p50
- Same 82 MB in 1,250 × 64 KiB calls: 18.7 ms (4380 MB/s) vs 149.3 ms for 20,000 × 4 KiB; the small calls are 8.0× slower for the same bytes
- Same 82 MB in 79 × 1 MiB calls: 35.7 ms (2298 MB/s) vs 149.3 ms for 20,000 × 4 KiB; the small calls are 4.2× slower for the same bytes
- flush() after every write adds 223.7 µs/call on top of small-append (append+flush: 231.2 µs/call mean)
- small-append: first call into the fresh file 60.0 µs vs p50 5.0 / p99 20.0 µs; across runs 60.0–145.0 µs (far above p99)
- chunked-append (64 KiB): first call into the fresh file 85.0 µs vs p50 10.0 / p99 70.0 µs; across runs 60.0–85.0 µs
- chunked-append (1 MiB): first call into the fresh file 170.0 µs vs p50 70.0 / p99 4705.0 µs; across runs 135.0–170.0 µs
- append+flush: first call into the fresh file 610.0 µs vs p50 140.0 / p99 1710.0 µs; across runs 555.0–720.0 µs
- new-file: 0.6 ms per file (1,781 files/s) = create+open 0.3 + first write 0.1 + close 0.1 + delete 0.1 ms
- new-file without delete (what populating OPFS pays per file): 0.4 ms
- First write into a new file (4 KiB): 57.1 µs vs 7.5 µs per small-append call

## Firefox 155

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:155.0) Gecko/20100101 Firefox/155.0`
- Platform: MacIntel; hardwareConcurrency: 12
- Timestamp: 2026-09-16T02:50:16.416Z
- performance.now() resolution in the worker: 20 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.5 MB used of 10737 MB
- Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000

Median run of R=5 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 20,000 | 4,096 | 718.2 | 654.3–743.9 | 27,847 | 114.1 | 40.0 | 40.0 | 60.0 | 6820.0 | 40.0 |
| small-overwrite | 20,000 | 4,096 | 580.1 | 478.6–604.5 | 34,477 | 141.2 | 20.0 | 40.0 | 60.0 | 780.0 | 20.0 |
| chunked-append (64 KiB) | 1,250 | 65,536 | 65.9 | 54.9–142.8 | 18,974 | 1243.5 | 40.0 | 40.0 | 80.0 | 4460.0 | 40.0 |
| chunked-append (1 MiB) | 79 | 1,048,576 | 13.4 | 10.7–28.9 | 5,904 | 6122.6 | 100.0 | 400.0 | 2280.0 | 2280.0 | 100.0 |
| append+flush | 20,000 | 4,096 | 1335.6 | 1283.1–1484.4 | 14,974 | 61.3 | 60.0 | 80.0 | 100.0 | 2020.0 | 100.0 |
| new-file: create+open | 2,000 | – | 3271.2 | 3158.6–3865.9 | 611 | – | 1040.0 | 1300.0 | 16620.0 | 64260.0 | 15400.0 |
| new-file: first write | 2,000 | 4,096 | 84.6 | 83.1–91.2 | 23,646 | 96.9 | 40.0 | 60.0 | 100.0 | 380.0 | 80.0 |
| new-file: close | 2,000 | – | 1528.5 | 1498.5–1737.3 | 1,308 | – | 520.0 | 660.0 | 7920.0 | 50000.0 | 540.0 |
| new-file: delete | 2,000 | – | 2549.0 | 2402.3–2927.6 | 785 | – | 820.0 | 980.0 | 14060.0 | 88040.0 | 700.0 |
| new-file: full cycle | 2,000 | 4,096 | 7339.6 | 7177.0–8624.0 | 272 | 1.1 | 2440.0 | 2880.0 | 23820.0 | 248040.0 | 2380.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 29.0 µs/call mean, 20.0 µs p50
- Size-growing write (small-append): 35.9 µs/call mean, 40.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 6.9 µs mean, 20.0 µs p50
- Same 82 MB in 1,250 × 64 KiB calls: 65.9 ms (1243 MB/s) vs 718.2 ms for 20,000 × 4 KiB; the small calls are 10.9× slower for the same bytes
- Same 82 MB in 79 × 1 MiB calls: 13.4 ms (6123 MB/s) vs 718.2 ms for 20,000 × 4 KiB; the small calls are 53.7× slower for the same bytes
- flush() after every write adds 30.9 µs/call on top of small-append (append+flush: 66.8 µs/call mean)
- small-append: first call into the fresh file 40.0 µs vs p50 40.0 / p99 60.0 µs; across runs 40.0–160.0 µs
- chunked-append (64 KiB): first call into the fresh file 40.0 µs vs p50 40.0 / p99 80.0 µs; across runs 40.0–60.0 µs
- chunked-append (1 MiB): first call into the fresh file 100.0 µs vs p50 100.0 / p99 2280.0 µs; across runs 100.0–120.0 µs
- append+flush: first call into the fresh file 100.0 µs vs p50 60.0 / p99 100.0 µs; across runs 80.0–180.0 µs
- new-file: 3.7 ms per file (272 files/s) = create+open 1.6 + first write 0.0 + close 0.8 + delete 1.3 ms
- new-file without delete (what populating OPFS pays per file): 2.4 ms
- First write into a new file (4 KiB): 42.3 µs vs 35.9 µs per small-append call

