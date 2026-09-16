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
