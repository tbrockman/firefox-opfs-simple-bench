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
