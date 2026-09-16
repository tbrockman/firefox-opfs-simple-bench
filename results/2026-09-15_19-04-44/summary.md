# OPFS sync write benchmark: 2026-09-15_19-04-44

Host: AMD Ryzen 7 7800X3D 8-Core Processor (16 threads), 65 GB, linux 7.0.0-31-generic x64  
Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000  
Browsers: Chrome 152, Firefox 155  
Date: 2026-09-16T02:04:44.902Z

## Comparison (median run, mean time per call)

| Workload | Chrome 152 µs/call | Firefox 155 µs/call | Firefox 155 ÷ Chrome 152 | Chrome 152 total | Firefox 155 total |
|---|---:|---:|---:|---:|---:|
| small-append | 8.4 µs | 37.8 µs | 4.5× | 168.8 ms | 755.8 ms |
| small-overwrite | 6.8 µs | 35.1 µs | 5.2× | 135.6 ms | 702.2 ms |
| chunked-append (64 KiB) | 18.8 µs | 49.6 µs | 2.6× | 23.5 ms | 62.0 ms |
| chunked-append (1 MiB) | 167 µs | 199 µs | 1.2× | 13.2 ms | 15.7 ms |
| append+flush | 5206 µs | 5303 µs | 1.0× | 104.1 s | 106.1 s |
| new-file: create+open | 364 µs | 32.5 ms | 89.3× | 728.1 ms | 65.0 s |
| new-file: first write | 83.5 µs | 99.3 µs | 1.2× | 167.0 ms | 198.7 ms |
| new-file: close | 82.3 µs | 21.2 ms | 257× | 164.6 ms | 42.3 s |
| new-file: delete | 149 µs | 21.9 ms | 147× | 297.7 ms | 43.8 s |
| new-file: full cycle | 690 µs | 75.7 ms | 110× | 1.4 s | 151.3 s |

## Chrome 152

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T02:04:44.902Z
- performance.now() resolution in the worker: 5.0 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.0 MB used of 10737 MB
- Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000

Median run of R=5 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 20,000 | 4,096 | 168.8 | 167.3–177.5 | 118,476 | 485.3 | 10.0 | 10.0 | 15.0 | 100.0 | 100.0 |
| small-overwrite | 20,000 | 4,096 | 135.6 | 135.1–144.2 | 147,504 | 604.2 | 5.0 | 10.0 | 15.0 | 20.0 | 20.0 |
| chunked-append (64 KiB) | 1,250 | 65,536 | 23.5 | 22.2–24.2 | 53,135 | 3482.3 | 20.0 | 25.0 | 30.0 | 125.0 | 125.0 |
| chunked-append (1 MiB) | 79 | 1,048,576 | 13.2 | 12.6–13.5 | 5,998 | 6220.2 | 160.0 | 215.0 | 275.0 | 275.0 | 275.0 |
| append+flush | 20,000 | 4,096 | 104129.4 | 103250.2–104907.2 | 192 | 0.8 | 5495.0 | 5720.0 | 7595.0 | 15660.0 | 5465.0 |
| new-file: create+open | 2,000 | – | 728.1 | 710.8–772.3 | 2,747 | – | 360.0 | 405.0 | 460.0 | 725.0 | 720.0 |
| new-file: first write | 2,000 | 4,096 | 167.0 | 164.3–172.0 | 11,975 | 49.0 | 80.0 | 90.0 | 110.0 | 185.0 | 185.0 |
| new-file: close | 2,000 | – | 164.6 | 161.8–277.9 | 12,151 | – | 80.0 | 95.0 | 105.0 | 145.0 | 145.0 |
| new-file: delete | 2,000 | – | 297.7 | 282.7–342.4 | 6,718 | – | 145.0 | 165.0 | 190.0 | 3295.0 | 155.0 |
| new-file: full cycle | 2,000 | 4,096 | 1380.4 | 1323.7–1521.8 | 1,449 | 5.9 | 645.0 | 730.0 | 835.0 | 59665.0 | 1270.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 6.8 µs/call mean, 5.0 µs p50
- Size-growing write (small-append): 8.4 µs/call mean, 10.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 1.7 µs mean, 5.0 µs p50
- Same 82 MB in 1,250 × 64 KiB calls: 23.5 ms (3482 MB/s) vs 168.8 ms for 20,000 × 4 KiB; the small calls are 7.2× slower for the same bytes
- Same 82 MB in 79 × 1 MiB calls: 13.2 ms (6220 MB/s) vs 168.8 ms for 20,000 × 4 KiB; the small calls are 12.8× slower for the same bytes
- flush() after every write adds 5198.0 µs/call on top of small-append (append+flush: 5206.5 µs/call mean)
- small-append: first call into the fresh file 100.0 µs vs p50 10.0 / p99 15.0 µs; across runs 100.0–290.0 µs (far above p99)
- chunked-append (64 KiB): first call into the fresh file 125.0 µs vs p50 20.0 / p99 30.0 µs; across runs 115.0–125.0 µs (far above p99)
- chunked-append (1 MiB): first call into the fresh file 275.0 µs vs p50 160.0 / p99 275.0 µs; across runs 215.0–275.0 µs
- append+flush: first call into the fresh file 5465.0 µs vs p50 5495.0 / p99 7595.0 µs; across runs 4595.0–5720.0 µs
- new-file: 0.7 ms per file (1,449 files/s) = create+open 0.4 + first write 0.1 + close 0.1 + delete 0.1 ms
- new-file without delete (what populating OPFS pays per file): 0.5 ms
- First write into a new file (4 KiB): 83.5 µs vs 8.4 µs per small-append call

## Firefox 155

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64; rv:155.0) Gecko/20100101 Firefox/155.0`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T02:15:21.517Z
- performance.now() resolution in the worker: 20 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.5 MB used of 10737 MB
- Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000

Median run of R=5 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 20,000 | 4,096 | 755.8 | 744.7–759.7 | 26,463 | 108.4 | 40.0 | 40.0 | 60.0 | 380.0 | 100.0 |
| small-overwrite | 20,000 | 4,096 | 702.2 | 698.0–714.6 | 28,482 | 116.7 | 40.0 | 40.0 | 40.0 | 660.0 | 60.0 |
| chunked-append (64 KiB) | 1,250 | 65,536 | 62.0 | 59.2–64.0 | 20,174 | 1322.1 | 40.0 | 60.0 | 60.0 | 120.0 | 120.0 |
| chunked-append (1 MiB) | 79 | 1,048,576 | 15.7 | 15.2–17.0 | 5,032 | 5217.8 | 200.0 | 220.0 | 280.0 | 280.0 | 280.0 |
| append+flush | 20,000 | 4,096 | 106058.7 | 104835.8–107575.6 | 189 | 0.8 | 5560.0 | 5840.0 | 7720.0 | 15940.0 | 5500.0 |
| new-file: create+open | 2,000 | – | 64995.7 | 64234.7–66101.4 | 31 | – | 31240.0 | 36520.0 | 42040.0 | 91960.0 | 30720.0 |
| new-file: first write | 2,000 | 4,096 | 198.7 | 197.3–201.0 | 10,066 | 41.2 | 100.0 | 120.0 | 140.0 | 200.0 | 100.0 |
| new-file: close | 2,000 | – | 42328.8 | 41802.6–43128.2 | 47 | – | 20360.0 | 24100.0 | 27440.0 | 39400.0 | 20160.0 |
| new-file: delete | 2,000 | – | 43784.9 | 43168.0–44366.1 | 46 | – | 21040.0 | 25320.0 | 28280.0 | 61320.0 | 20780.0 |
| new-file: full cycle | 2,000 | 4,096 | 151318.4 | 149410.0–153804.8 | 13 | 0.1 | 72820.0 | 84000.0 | 96560.0 | 135040.0 | 71760.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 35.1 µs/call mean, 40.0 µs p50
- Size-growing write (small-append): 37.8 µs/call mean, 40.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 2.7 µs mean, 0.0 µs p50
- Same 82 MB in 1,250 × 64 KiB calls: 62.0 ms (1322 MB/s) vs 755.8 ms for 20,000 × 4 KiB; the small calls are 12.2× slower for the same bytes
- Same 82 MB in 79 × 1 MiB calls: 15.7 ms (5218 MB/s) vs 755.8 ms for 20,000 × 4 KiB; the small calls are 48.1× slower for the same bytes
- flush() after every write adds 5265.1 µs/call on top of small-append (append+flush: 5302.9 µs/call mean)
- small-append: first call into the fresh file 100.0 µs vs p50 40.0 / p99 60.0 µs; across runs 80.0–100.0 µs
- chunked-append (64 KiB): first call into the fresh file 120.0 µs vs p50 40.0 / p99 60.0 µs; across runs 100.0–120.0 µs
- chunked-append (1 MiB): first call into the fresh file 280.0 µs vs p50 200.0 / p99 280.0 µs; across runs 200.0–280.0 µs
- append+flush: first call into the fresh file 5500.0 µs vs p50 5560.0 / p99 7720.0 µs; across runs 4460.0–7200.0 µs
- new-file: 75.7 ms per file (13 files/s) = create+open 32.5 + first write 0.1 + close 21.2 + delete 21.9 ms
- new-file without delete (what populating OPFS pays per file): 53.8 ms
- First write into a new file (4 KiB): 99.3 µs vs 37.8 µs per small-append call

