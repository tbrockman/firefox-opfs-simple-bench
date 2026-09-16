**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64; rv:155.0) Gecko/20100101 Firefox/155.0`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T03:20:58.645Z
- performance.now() resolution in the worker: 20 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.5 MB used of 10737 MB
- Config: preset=quick, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=3, M=200

Median run of R=3 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 2,000 | 4,096 | 573.5 | 545.6–578.2 | 3,487 | 14.3 | 280.0 | 300.0 | 400.0 | 1100.0 | 520.0 |
| small-overwrite | 2,000 | 4,096 | 566.9 | 551.4–606.2 | 3,528 | 14.5 | 280.0 | 300.0 | 340.0 | 780.0 | 340.0 |
| chunked-append (64 KiB) | 125 | 65,536 | 36.7 | 34.9–37.9 | 3,408 | 223.3 | 300.0 | 300.0 | 360.0 | 440.0 | 440.0 |
| chunked-append (1 MiB) | 8 | 1,048,576 | 3.5 | 3.4–3.6 | 2,286 | 2340.6 | 420.0 | 460.0 | 460.0 | 460.0 | 420.0 |
| append+flush | 2,000 | 4,096 | 11898.4 | 11227.0–12248.6 | 168 | 0.7 | 5960.0 | 7160.0 | 10540.0 | 15440.0 | 6960.0 |
| new-file: create+open | 200 | – | 9818.6 | 9639.7–10752.1 | 20 | – | 47720.0 | 50620.0 | 62020.0 | 115080.0 | 58620.0 |
| new-file: first write | 200 | 4,096 | 117.3 | 113.5–117.6 | 1,705 | 7.0 | 580.0 | 640.0 | 760.0 | 1440.0 | 620.0 |
| new-file: close | 200 | – | 6376.7 | 6316.2–7102.7 | 31 | – | 31220.0 | 32560.0 | 40520.0 | 41400.0 | 40800.0 |
| new-file: delete | 200 | – | 6467.9 | 6408.4–7155.2 | 31 | – | 31580.0 | 33040.0 | 40360.0 | 60900.0 | 39860.0 |
| new-file: full cycle | 200 | 4,096 | 22777.8 | 22482.5–25128.6 | 9 | 0.0 | 111100.0 | 117000.0 | 150120.0 | 177800.0 | 139840.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 283.4 µs/call mean, 280.0 µs p50
- Size-growing write (small-append): 286.7 µs/call mean, 280.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 3.3 µs mean, 0.0 µs p50
- Same 8.2 MB in 125 × 64 KiB calls: 36.7 ms (223 MB/s) vs 573.5 ms for 2,000 × 4 KiB; the small calls are 15.6× slower for the same bytes
- Same 8.2 MB in 8 × 1 MiB calls: 3.5 ms (2341 MB/s) vs 573.5 ms for 2,000 × 4 KiB; the small calls are 163.9× slower for the same bytes
- flush() after every write adds 5662.5 µs/call on top of small-append (append+flush: 5949.2 µs/call mean)
- small-append: first call into the fresh file 520.0 µs vs p50 280.0 / p99 400.0 µs; across runs 320.0–520.0 µs
- chunked-append (64 KiB): first call into the fresh file 440.0 µs vs p50 300.0 / p99 360.0 µs; across runs 280.0–440.0 µs
- chunked-append (1 MiB): first call into the fresh file 420.0 µs vs p50 420.0 / p99 460.0 µs; across runs 380.0–420.0 µs
- append+flush: first call into the fresh file 6960.0 µs vs p50 5960.0 / p99 10540.0 µs; across runs 4960.0–6960.0 µs
- new-file: 113.9 ms per file (9 files/s) = create+open 49.1 + first write 0.6 + close 31.9 + delete 32.3 ms
- new-file without delete (what populating OPFS pays per file): 81.6 ms
- First write into a new file (4 KiB): 586.5 µs vs 286.7 µs per small-append call
