# OPFS sync write benchmark: 2026-09-15_20-17-46-tmpfs

Host: AMD Ryzen 7 7800X3D 8-Core Processor (16 threads), 65 GB, linux 7.0.0-31-generic x64  
Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000  
Browsers: Chrome 152, Firefox 155  
Profiles on: tmpfs (/tmp)  
Date: 2026-09-16T03:17:46.590Z

## Per-call write cost (median run, mean time per call)

| Workload | Chrome 152 µs/call | Firefox 155 µs/call | Firefox 155 ÷ Chrome 152 | Chrome 152 total | Firefox 155 total |
|---|---:|---:|---:|---:|---:|
| small-append | 5.5 µs | 33.6 µs | 6.2× | 109.2 ms | 672.7 ms |
| small-overwrite | 4.2 µs | 32.4 µs | 7.7× | 84.1 ms | 647.2 ms |
| chunked-append (64 KiB) | 22.1 µs | 51.1 µs | 2.3× | 27.6 ms | 63.8 ms |
| chunked-append (1 MiB) | 283 µs | 315 µs | 1.1× | 22.4 ms | 24.9 ms |
| append+flush | 5.9 µs | 42.3 µs | 7.2× | 117.3 ms | 846.3 ms |

## Per-file cost (median run, mean time per call)

| Workload | Chrome 152 µs/call | Firefox 155 µs/call | Firefox 155 ÷ Chrome 152 | Chrome 152 total | Firefox 155 total |
|---|---:|---:|---:|---:|---:|
| new-file: create+open | 309 µs | 592 µs | 1.9× | 618.3 ms | 1.2 s |
| new-file: first write | 73.7 µs | 55.7 µs | 0.8× | 147.4 ms | 111.3 ms |
| new-file: close | 78.7 µs | 236 µs | 3.0× | 157.4 ms | 472.6 ms |
| new-file: delete | 112 µs | 449 µs | 4.0× | 224.2 ms | 898.2 ms |
| new-file: full cycle | 573 µs | 1337 µs | 2.3× | 1.1 s | 2.7 s |

## Chrome 152

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T03:17:46.590Z
- performance.now() resolution in the worker: 5.0 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.0 MB used of 10737 MB
- Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000

Median run of R=5 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 20,000 | 4,096 | 109.2 | 108.3–112.2 | 183,184 | 750.3 | 5.0 | 10.0 | 10.0 | 110.0 | 100.0 |
| small-overwrite | 20,000 | 4,096 | 84.1 | 83.8–84.4 | 237,699 | 973.6 | 5.0 | 5.0 | 10.0 | 85.0 | 5.0 |
| chunked-append (64 KiB) | 1,250 | 65,536 | 27.6 | 27.0–29.6 | 45,339 | 2971.3 | 20.0 | 25.0 | 65.0 | 145.0 | 145.0 |
| chunked-append (1 MiB) | 79 | 1,048,576 | 22.4 | 21.9–22.9 | 3,528 | 3658.8 | 275.0 | 345.0 | 455.0 | 455.0 | 455.0 |
| append+flush | 20,000 | 4,096 | 117.3 | 116.9–119.2 | 170,503 | 698.4 | 5.0 | 10.0 | 10.0 | 105.0 | 100.0 |
| new-file: create+open | 2,000 | – | 618.3 | 608.5–691.3 | 3,235 | – | 305.0 | 340.0 | 395.0 | 1135.0 | 415.0 |
| new-file: first write | 2,000 | 4,096 | 147.4 | 145.5–154.6 | 13,564 | 55.6 | 70.0 | 85.0 | 110.0 | 140.0 | 100.0 |
| new-file: close | 2,000 | – | 157.4 | 153.4–161.0 | 12,705 | – | 75.0 | 90.0 | 110.0 | 140.0 | 80.0 |
| new-file: delete | 2,000 | – | 224.2 | 216.1–233.3 | 8,921 | – | 105.0 | 120.0 | 145.0 | 9355.0 | 140.0 |
| new-file: full cycle | 2,000 | 4,096 | 1145.1 | 1124.9–1236.1 | 1,747 | 7.2 | 560.0 | 615.0 | 710.0 | 9810.0 | 750.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 4.2 µs/call mean, 5.0 µs p50
- Size-growing write (small-append): 5.5 µs/call mean, 5.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 1.3 µs mean, 0.0 µs p50
- Same 82 MB in 1,250 × 64 KiB calls: 27.6 ms (2971 MB/s) vs 109.2 ms for 20,000 × 4 KiB; the small calls are 4.0× slower for the same bytes
- Same 82 MB in 79 × 1 MiB calls: 22.4 ms (3659 MB/s) vs 109.2 ms for 20,000 × 4 KiB; the small calls are 4.9× slower for the same bytes
- flush() after every write adds 0.4 µs/call on top of small-append (append+flush: 5.9 µs/call mean)
- small-append: first call into the fresh file 100.0 µs vs p50 5.0 / p99 10.0 µs; across runs 90.0–140.0 µs (far above p99)
- chunked-append (64 KiB): first call into the fresh file 145.0 µs vs p50 20.0 / p99 65.0 µs; across runs 105.0–160.0 µs
- chunked-append (1 MiB): first call into the fresh file 455.0 µs vs p50 275.0 / p99 455.0 µs; across runs 400.0–485.0 µs
- append+flush: first call into the fresh file 100.0 µs vs p50 5.0 / p99 10.0 µs; across runs 75.0–150.0 µs (far above p99)
- new-file: 0.6 ms per file (1,747 files/s) = create+open 0.3 + first write 0.1 + close 0.1 + delete 0.1 ms
- new-file without delete (what populating OPFS pays per file): 0.5 ms
- First write into a new file (4 KiB): 73.7 µs vs 5.5 µs per small-append call

## Firefox 155

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64; rv:155.0) Gecko/20100101 Firefox/155.0`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T03:17:59.132Z
- performance.now() resolution in the worker: 20 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.5 MB used of 3269 MB
- Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000

Median run of R=5 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 20,000 | 4,096 | 672.7 | 671.8–694.8 | 29,732 | 121.8 | 40.0 | 40.0 | 40.0 | 1100.0 | 60.0 |
| small-overwrite | 20,000 | 4,096 | 647.2 | 634.3–654.2 | 30,903 | 126.6 | 40.0 | 40.0 | 40.0 | 80.0 | 40.0 |
| chunked-append (64 KiB) | 1,250 | 65,536 | 63.8 | 62.2–66.0 | 19,580 | 1283.2 | 60.0 | 60.0 | 80.0 | 100.0 | 80.0 |
| chunked-append (1 MiB) | 79 | 1,048,576 | 24.9 | 23.3–26.3 | 3,170 | 3287.3 | 320.0 | 340.0 | 440.0 | 440.0 | 440.0 |
| append+flush | 20,000 | 4,096 | 846.3 | 844.9–859.1 | 23,632 | 96.8 | 40.0 | 60.0 | 60.0 | 100.0 | 80.0 |
| new-file: create+open | 2,000 | – | 1184.0 | 1169.9–1240.8 | 1,689 | – | 580.0 | 680.0 | 760.0 | 840.0 | 620.0 |
| new-file: first write | 2,000 | 4,096 | 111.3 | 110.1–117.8 | 17,963 | 73.6 | 60.0 | 60.0 | 80.0 | 180.0 | 80.0 |
| new-file: close | 2,000 | – | 472.6 | 471.4–486.1 | 4,232 | – | 220.0 | 280.0 | 320.0 | 380.0 | 340.0 |
| new-file: delete | 2,000 | – | 898.2 | 891.3–929.7 | 2,227 | – | 420.0 | 540.0 | 600.0 | 680.0 | 460.0 |
| new-file: full cycle | 2,000 | 4,096 | 2674.2 | 2650.9–2776.2 | 748 | 3.1 | 1280.0 | 1460.0 | 1660.0 | 28220.0 | 1420.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 32.4 µs/call mean, 40.0 µs p50
- Size-growing write (small-append): 33.6 µs/call mean, 40.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 1.3 µs mean, 0.0 µs p50
- Same 82 MB in 1,250 × 64 KiB calls: 63.8 ms (1283 MB/s) vs 672.7 ms for 20,000 × 4 KiB; the small calls are 10.5× slower for the same bytes
- Same 82 MB in 79 × 1 MiB calls: 24.9 ms (3287 MB/s) vs 672.7 ms for 20,000 × 4 KiB; the small calls are 27.0× slower for the same bytes
- flush() after every write adds 8.7 µs/call on top of small-append (append+flush: 42.3 µs/call mean)
- small-append: first call into the fresh file 60.0 µs vs p50 40.0 / p99 40.0 µs; across runs 60.0–100.0 µs
- chunked-append (64 KiB): first call into the fresh file 80.0 µs vs p50 60.0 / p99 80.0 µs; across runs 80.0–100.0 µs
- chunked-append (1 MiB): first call into the fresh file 440.0 µs vs p50 320.0 / p99 440.0 µs; across runs 320.0–440.0 µs
- append+flush: first call into the fresh file 80.0 µs vs p50 40.0 / p99 60.0 µs; across runs 80.0–100.0 µs
- new-file: 1.3 ms per file (748 files/s) = create+open 0.6 + first write 0.1 + close 0.2 + delete 0.4 ms
- new-file without delete (what populating OPFS pays per file): 0.9 ms
- First write into a new file (4 KiB): 55.7 µs vs 33.6 µs per small-append call

