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
