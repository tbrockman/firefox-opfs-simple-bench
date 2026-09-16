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
