**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T03:20:09.457Z
- performance.now() resolution in the worker: 5.0 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.0 MB used of 10737 MB
- Config: preset=quick, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=3, M=200

Median run of R=3 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 2,000 | 4,096 | 51.1 | 50.4–53.1 | 39,150 | 160.4 | 10.0 | 10.0 | 15.0 | 15750.0 | 385.0 |
| small-overwrite | 2,000 | 4,096 | 25.3 | 24.0–27.0 | 78,958 | 323.4 | 10.0 | 10.0 | 15.0 | 9140.0 | 15.0 |
| chunked-append (64 KiB) | 125 | 65,536 | 5.9 | 5.7–6.1 | 21,313 | 1396.8 | 20.0 | 25.0 | 900.0 | 1220.0 | 390.0 |
| chunked-append (1 MiB) | 8 | 1,048,576 | 2.9 | 2.6–3.3 | 2,735 | 2800.7 | 160.0 | 670.0 | 670.0 | 670.0 | 635.0 |
| append+flush | 2,000 | 4,096 | 10284.4 | 10250.9–11208.2 | 194 | 0.8 | 5490.0 | 5665.0 | 6290.0 | 10075.0 | 5915.0 |
| new-file: create+open | 200 | – | 338.6 | 338.3–338.8 | 591 | – | 1670.0 | 1800.0 | 1970.0 | 2010.0 | 1955.0 |
| new-file: first write | 200 | 4,096 | 73.0 | 72.6–73.7 | 2,738 | 11.2 | 360.0 | 395.0 | 420.0 | 440.0 | 395.0 |
| new-file: close | 200 | – | 99.2 | 98.5–99.4 | 2,015 | – | 485.0 | 535.0 | 605.0 | 620.0 | 530.0 |
| new-file: delete | 200 | – | 96.0 | 95.4–97.2 | 2,083 | – | 465.0 | 525.0 | 615.0 | 620.0 | 445.0 |
| new-file: full cycle | 200 | 4,096 | 607.1 | 606.2–608.3 | 329 | 1.3 | 3000.0 | 3200.0 | 3405.0 | 3990.0 | 2930.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 12.7 µs/call mean, 10.0 µs p50
- Size-growing write (small-append): 25.5 µs/call mean, 10.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 12.9 µs mean, 0.0 µs p50
- Same 8.2 MB in 125 × 64 KiB calls: 5.9 ms (1397 MB/s) vs 51.1 ms for 2,000 × 4 KiB; the small calls are 8.7× slower for the same bytes
- Same 8.2 MB in 8 × 1 MiB calls: 2.9 ms (2801 MB/s) vs 51.1 ms for 2,000 × 4 KiB; the small calls are 17.5× slower for the same bytes
- flush() after every write adds 5116.7 µs/call on top of small-append (append+flush: 5142.2 µs/call mean)
- small-append: first call into the fresh file 385.0 µs vs p50 10.0 / p99 15.0 µs; across runs 340.0–400.0 µs (far above p99)
- chunked-append (64 KiB): first call into the fresh file 390.0 µs vs p50 20.0 / p99 900.0 µs; across runs 355.0–395.0 µs
- chunked-append (1 MiB): first call into the fresh file 635.0 µs vs p50 160.0 / p99 670.0 µs; across runs 495.0–635.0 µs
- append+flush: first call into the fresh file 5915.0 µs vs p50 5490.0 / p99 6290.0 µs; across runs 4925.0–5915.0 µs
- new-file: 3.0 ms per file (329 files/s) = create+open 1.7 + first write 0.4 + close 0.5 + delete 0.5 ms
- new-file without delete (what populating OPFS pays per file): 2.6 ms
- First write into a new file (4 KiB): 365.2 µs vs 25.5 µs per small-append call
