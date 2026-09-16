**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T03:59:10.756Z
- performance.now() resolution in the worker: 5.0 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.0 MB used of 10737 MB
- Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000

Median run of R=5 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 20,000 | 4,096 | 175.4 | 171.5–186.1 | 114,015 | 467.0 | 10.0 | 10.0 | 15.0 | 140.0 | 140.0 |
| small-overwrite | 20,000 | 4,096 | 131.2 | 130.9–149.7 | 152,410 | 624.3 | 5.0 | 10.0 | 10.0 | 45.0 | 20.0 |
| chunked-append (64 KiB) | 1,250 | 65,536 | 23.8 | 22.9–25.4 | 52,543 | 3443.5 | 20.0 | 25.0 | 30.0 | 130.0 | 130.0 |
| chunked-append (1 MiB) | 79 | 1,048,576 | 12.6 | 12.4–13.1 | 6,265 | 6496.4 | 150.0 | 215.0 | 260.0 | 260.0 | 260.0 |
| append+flush | 20,000 | 4,096 | 109080.9 | 107608.6–109541.4 | 183 | 0.8 | 5520.0 | 6735.0 | 7865.0 | 17510.0 | 13755.0 |
| new-file: create+open | 2,000 | – | 749.7 | 722.0–857.8 | 2,668 | – | 365.0 | 415.0 | 465.0 | 9535.0 | 480.0 |
| new-file: first write | 2,000 | 4,096 | 172.0 | 168.5–172.3 | 11,629 | 47.6 | 85.0 | 100.0 | 120.0 | 220.0 | 100.0 |
| new-file: close | 2,000 | – | 169.4 | 168.0–229.1 | 11,808 | – | 80.0 | 95.0 | 110.0 | 4375.0 | 80.0 |
| new-file: delete | 2,000 | – | 294.0 | 288.1–342.9 | 6,803 | – | 145.0 | 165.0 | 185.0 | 285.0 | 175.0 |
| new-file: full cycle | 2,000 | 4,096 | 1386.4 | 1351.5–1523.5 | 1,443 | 5.9 | 680.0 | 755.0 | 830.0 | 9910.0 | 885.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 6.6 µs/call mean, 5.0 µs p50
- Size-growing write (small-append): 8.8 µs/call mean, 10.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 2.2 µs mean, 5.0 µs p50
- Same 82 MB in 1,250 × 64 KiB calls: 23.8 ms (3443 MB/s) vs 175.4 ms for 20,000 × 4 KiB; the small calls are 7.4× slower for the same bytes
- Same 82 MB in 79 × 1 MiB calls: 12.6 ms (6496 MB/s) vs 175.4 ms for 20,000 × 4 KiB; the small calls are 13.9× slower for the same bytes
- flush() after every write adds 5445.3 µs/call on top of small-append (append+flush: 5454.0 µs/call mean)
- small-append: first call into the fresh file 140.0 µs vs p50 10.0 / p99 15.0 µs; across runs 105.0–325.0 µs (far above p99)
- chunked-append (64 KiB): first call into the fresh file 130.0 µs vs p50 20.0 / p99 30.0 µs; across runs 100.0–140.0 µs (far above p99)
- chunked-append (1 MiB): first call into the fresh file 260.0 µs vs p50 150.0 / p99 260.0 µs; across runs 225.0–260.0 µs
- append+flush: first call into the fresh file 13755.0 µs vs p50 5520.0 / p99 7865.0 µs; across runs 5200.0–13755.0 µs
- new-file: 0.7 ms per file (1,443 files/s) = create+open 0.4 + first write 0.1 + close 0.1 + delete 0.1 ms
- new-file without delete (what populating OPFS pays per file): 0.5 ms
- First write into a new file (4 KiB): 86.0 µs vs 8.8 µs per small-append call
