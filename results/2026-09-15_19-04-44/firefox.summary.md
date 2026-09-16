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
