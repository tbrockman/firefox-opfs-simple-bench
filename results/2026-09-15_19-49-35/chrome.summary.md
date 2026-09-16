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
