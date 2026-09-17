# OPFS sync write benchmark: 2026-09-17_00-07-25

Host: Apple M4 Pro (12 threads), 26 GB, darwin 25.6.0 arm64  
Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000  
Browsers: Chrome 153, Firefox 155  
Profiles on: apfs (/)  
Date: 2026-09-17T07:07:26.121Z

## Per-call write cost (median run, mean time per call)

| Workload | Chrome 153 µs/call | Firefox 155 µs/call | Firefox 155 ÷ Chrome 153 | Chrome 153 total | Firefox 155 total |
|---|---:|---:|---:|---:|---:|
| small-append | 5.3 µs | 34.0 µs | 6.5× | 105.0 ms | 680.8 ms |
| small-overwrite | 2.3 µs | 30.2 µs | 13.0× | 46.6 ms | 604.7 ms |
| chunked-append (64 KiB) | 10.1 µs | 30.5 µs | 3.0× | 12.7 ms | 38.1 ms |
| chunked-append (1 MiB) | 95.9 µs | 96.7 µs | 1.0× | 7.6 ms | 7.6 ms |
| append+flush | 205 µs | 62.9 µs | 0.3× | 4.1 s | 1.3 s |

## Per-file cost (median run, mean time per call)

| Workload | Chrome 153 µs/call | Firefox 155 µs/call | Firefox 155 ÷ Chrome 153 | Chrome 153 total | Firefox 155 total |
|---|---:|---:|---:|---:|---:|
| new-file: create+open | 262 µs | 931 µs | 3.5× | 525.0 ms | 1.9 s |
| new-file: first write | 59.4 µs | 39.9 µs | 0.7× | 118.8 ms | 79.9 ms |
| new-file: close | 82.1 µs | 466 µs | 5.7× | 164.2 ms | 932.3 ms |
| new-file: delete | 112 µs | 708 µs | 6.3× | 223.7 ms | 1.4 s |
| new-file: full cycle | 514 µs | 2135 µs | 4.2× | 1.0 s | 4.3 s |

## Chrome 153

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/153.0.0.0 Safari/537.36`
- Platform: MacIntel; hardwareConcurrency: 12
- Timestamp: 2026-09-17T07:07:26.121Z
- performance.now() resolution in the worker: 5.0 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.0 MB used of 10737 MB
- Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000

Median run of R=5 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 20,000 | 4,096 | 105.0 | 103.0–105.7 | 190,440 | 780.0 | 5.0 | 10.0 | 10.0 | 735.0 | 85.0 |
| small-overwrite | 20,000 | 4,096 | 46.6 | 45.7–47.0 | 429,185 | 1757.9 | 0.0 | 5.0 | 10.0 | 20.0 | 5.0 |
| chunked-append (64 KiB) | 1,250 | 65,536 | 12.7 | 12.3–12.8 | 98,542 | 6458.0 | 10.0 | 15.0 | 50.0 | 215.0 | 60.0 |
| chunked-append (1 MiB) | 79 | 1,048,576 | 7.6 | 7.5–15.8 | 10,422 | 10807.4 | 65.0 | 285.0 | 350.0 | 350.0 | 195.0 |
| append+flush | 20,000 | 4,096 | 4090.8 | 4000.4–6629.7 | 4,889 | 20.0 | 190.0 | 290.0 | 335.0 | 7675.0 | 595.0 |
| new-file: create+open | 2,000 | – | 525.0 | 490.1–571.3 | 3,810 | – | 240.0 | 290.0 | 360.0 | 20285.0 | 410.0 |
| new-file: first write | 2,000 | 4,096 | 118.8 | 102.1–142.5 | 16,829 | 68.9 | 50.0 | 60.0 | 80.0 | 12580.0 | 70.0 |
| new-file: close | 2,000 | – | 164.2 | 143.4–195.2 | 12,183 | – | 80.0 | 95.0 | 145.0 | 255.0 | 90.0 |
| new-file: delete | 2,000 | – | 223.7 | 202.2–249.0 | 8,943 | – | 100.0 | 110.0 | 180.0 | 17650.0 | 115.0 |
| new-file: full cycle | 2,000 | 4,096 | 1028.5 | 938.2–1112.0 | 1,945 | 8.0 | 455.0 | 520.0 | 680.0 | 57520.0 | 670.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 2.3 µs/call mean, 0.0 µs p50
- Size-growing write (small-append): 5.3 µs/call mean, 5.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 2.9 µs mean, 5.0 µs p50
- Same 82 MB in 1,250 × 64 KiB calls: 12.7 ms (6458 MB/s) vs 105.0 ms for 20,000 × 4 KiB; the small calls are 8.3× slower for the same bytes
- Same 82 MB in 79 × 1 MiB calls: 7.6 ms (10807 MB/s) vs 105.0 ms for 20,000 × 4 KiB; the small calls are 13.9× slower for the same bytes
- flush() after every write adds 199.3 µs/call on top of small-append (append+flush: 204.5 µs/call mean)
- small-append: first call into the fresh file 85.0 µs vs p50 5.0 / p99 10.0 µs; across runs 60.0–135.0 µs (far above p99)
- chunked-append (64 KiB): first call into the fresh file 60.0 µs vs p50 10.0 / p99 50.0 µs; across runs 55.0–100.0 µs
- chunked-append (1 MiB): first call into the fresh file 195.0 µs vs p50 65.0 / p99 350.0 µs; across runs 120.0–195.0 µs
- append+flush: first call into the fresh file 595.0 µs vs p50 190.0 / p99 335.0 µs; across runs 595.0–775.0 µs
- new-file: 0.5 ms per file (1,945 files/s) = create+open 0.3 + first write 0.1 + close 0.1 + delete 0.1 ms
- new-file without delete (what populating OPFS pays per file): 0.4 ms
- First write into a new file (4 KiB): 59.4 µs vs 5.3 µs per small-append call

## Firefox 155

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:155.0) Gecko/20100101 Firefox/155.0`
- Platform: MacIntel; hardwareConcurrency: 12
- Timestamp: 2026-09-17T07:08:04.832Z
- performance.now() resolution in the worker: 20 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.5 MB used of 10737 MB
- Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000

Median run of R=5 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 20,000 | 4,096 | 680.8 | 665.0–682.7 | 29,376 | 120.3 | 40.0 | 40.0 | 40.0 | 4520.0 | 40.0 |
| small-overwrite | 20,000 | 4,096 | 604.7 | 597.7–620.4 | 33,073 | 135.5 | 20.0 | 40.0 | 40.0 | 160.0 | 20.0 |
| chunked-append (64 KiB) | 1,250 | 65,536 | 38.1 | 37.6–41.6 | 32,774 | 2147.9 | 20.0 | 40.0 | 60.0 | 180.0 | 40.0 |
| chunked-append (1 MiB) | 79 | 1,048,576 | 7.6 | 7.6–7.8 | 10,340 | 10722.5 | 80.0 | 200.0 | 260.0 | 260.0 | 100.0 |
| append+flush | 20,000 | 4,096 | 1258.8 | 1206.5–1397.1 | 15,888 | 65.1 | 60.0 | 80.0 | 100.0 | 5060.0 | 140.0 |
| new-file: create+open | 2,000 | – | 1862.2 | 1798.3–4966.7 | 1,074 | – | 880.0 | 1000.0 | 1180.0 | 24020.0 | 1100.0 |
| new-file: first write | 2,000 | 4,096 | 79.9 | 78.7–85.0 | 25,038 | 102.6 | 40.0 | 40.0 | 80.0 | 220.0 | 60.0 |
| new-file: close | 2,000 | – | 932.3 | 923.5–4260.5 | 2,145 | – | 440.0 | 500.0 | 600.0 | 28440.0 | 420.0 |
| new-file: delete | 2,000 | – | 1416.6 | 1393.5–3855.7 | 1,412 | – | 660.0 | 760.0 | 860.0 | 29580.0 | 720.0 |
| new-file: full cycle | 2,000 | 4,096 | 4270.7 | 4227.5–13170.1 | 468 | 1.9 | 2040.0 | 2280.0 | 2640.0 | 25540.0 | 2540.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 30.2 µs/call mean, 20.0 µs p50
- Size-growing write (small-append): 34.0 µs/call mean, 40.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 3.8 µs mean, 20.0 µs p50
- Same 82 MB in 1,250 × 64 KiB calls: 38.1 ms (2148 MB/s) vs 680.8 ms for 20,000 × 4 KiB; the small calls are 17.9× slower for the same bytes
- Same 82 MB in 79 × 1 MiB calls: 7.6 ms (10723 MB/s) vs 680.8 ms for 20,000 × 4 KiB; the small calls are 89.1× slower for the same bytes
- flush() after every write adds 28.9 µs/call on top of small-append (append+flush: 62.9 µs/call mean)
- small-append: first call into the fresh file 40.0 µs vs p50 40.0 / p99 40.0 µs; across runs 40.0–60.0 µs
- chunked-append (64 KiB): first call into the fresh file 40.0 µs vs p50 20.0 / p99 60.0 µs; across runs 40.0–60.0 µs
- chunked-append (1 MiB): first call into the fresh file 100.0 µs vs p50 80.0 / p99 260.0 µs; across runs 100.0–160.0 µs
- append+flush: first call into the fresh file 140.0 µs vs p50 60.0 / p99 100.0 µs; across runs 100.0–140.0 µs
- new-file: 2.1 ms per file (468 files/s) = create+open 0.9 + first write 0.0 + close 0.5 + delete 0.7 ms
- new-file without delete (what populating OPFS pays per file): 1.4 ms
- First write into a new file (4 KiB): 39.9 µs vs 34.0 µs per small-append call

