**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64; rv:155.0) Gecko/20100101 Firefox/155.0`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T04:10:20.382Z
- performance.now() resolution in the worker: 20 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.5 MB used of 10737 MB
- Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000

Median run of R=5 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 20,000 | 4,096 | 748.2 | 746.2–769.0 | 26,731 | 109.5 | 40.0 | 40.0 | 60.0 | 1040.0 | 100.0 |
| small-overwrite | 20,000 | 4,096 | 709.0 | 698.6–720.2 | 28,208 | 115.5 | 40.0 | 40.0 | 40.0 | 100.0 | 60.0 |
| chunked-append (64 KiB) | 1,250 | 65,536 | 58.5 | 57.7–59.5 | 21,375 | 1400.8 | 40.0 | 60.0 | 60.0 | 120.0 | 120.0 |
| chunked-append (1 MiB) | 79 | 1,048,576 | 16.3 | 15.3–16.5 | 4,859 | 5038.1 | 200.0 | 220.0 | 240.0 | 240.0 | 220.0 |
| append+flush | 20,000 | 4,096 | 111589.1 | 109605.6–122659.3 | 179 | 0.7 | 5600.0 | 6800.0 | 7860.0 | 17220.0 | 4500.0 |
| new-file: create+open | 2,000 | – | 68034.8 | 66606.8–68188.3 | 29 | – | 31500.0 | 39740.0 | 46620.0 | 79320.0 | 38480.0 |
| new-file: first write | 2,000 | 4,096 | 200.2 | 198.3–202.3 | 9,990 | 40.9 | 100.0 | 120.0 | 140.0 | 260.0 | 100.0 |
| new-file: close | 2,000 | – | 44372.6 | 43396.7–44558.5 | 45 | – | 20520.0 | 26080.0 | 29920.0 | 64420.0 | 27160.0 |
| new-file: delete | 2,000 | – | 45730.0 | 44864.4–45786.5 | 44 | – | 21240.0 | 26640.0 | 28480.0 | 63840.0 | 26400.0 |
| new-file: full cycle | 2,000 | 4,096 | 158400.2 | 155075.9–158715.4 | 13 | 0.1 | 73460.0 | 92660.0 | 99780.0 | 181960.0 | 97600.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 35.5 µs/call mean, 40.0 µs p50
- Size-growing write (small-append): 37.4 µs/call mean, 40.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 2.0 µs mean, 0.0 µs p50
- Same 82 MB in 1,250 × 64 KiB calls: 58.5 ms (1401 MB/s) vs 748.2 ms for 20,000 × 4 KiB; the small calls are 12.8× slower for the same bytes
- Same 82 MB in 79 × 1 MiB calls: 16.3 ms (5038 MB/s) vs 748.2 ms for 20,000 × 4 KiB; the small calls are 46.0× slower for the same bytes
- flush() after every write adds 5542.0 µs/call on top of small-append (append+flush: 5579.5 µs/call mean)
- small-append: first call into the fresh file 100.0 µs vs p50 40.0 / p99 60.0 µs; across runs 80.0–100.0 µs
- chunked-append (64 KiB): first call into the fresh file 120.0 µs vs p50 40.0 / p99 60.0 µs; across runs 80.0–140.0 µs
- chunked-append (1 MiB): first call into the fresh file 220.0 µs vs p50 200.0 / p99 240.0 µs; across runs 200.0–220.0 µs
- append+flush: first call into the fresh file 4500.0 µs vs p50 5600.0 / p99 7860.0 µs; across runs 4440.0–5680.0 µs
- new-file: 79.2 ms per file (13 files/s) = create+open 34.0 + first write 0.1 + close 22.2 + delete 22.9 ms
- new-file without delete (what populating OPFS pays per file): 56.3 ms
- First write into a new file (4 KiB): 100.1 µs vs 37.4 µs per small-append call
