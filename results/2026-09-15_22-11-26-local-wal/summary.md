# OPFS sync write benchmark: 2026-09-15_22-11-26-local-wal

Host: AMD Ryzen 7 7800X3D 8-Core Processor (16 threads), 65 GB, linux 7.0.0-31-generic x64  
Config: preset=quick, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=3, M=200  
Browsers: Firefox 158  
Profiles on: ext4 (/)  
Date: 2026-09-16T05:11:28.540Z

## Per-call write cost (median run, mean time per call)

| Workload | Firefox 158 µs/call | Firefox 158 total |
|---|---:|---:|
| small-append | 42.1 µs | 84.1 ms |
| small-overwrite | 38.0 µs | 75.9 ms |
| chunked-append (64 KiB) | 47.2 µs | 5.9 ms |
| chunked-append (1 MiB) | 195 µs | 1.6 ms |
| append+flush | 5204 µs | 10.4 s |

## Per-file cost (median run, mean time per call)

| Workload | Firefox 158 µs/call | Firefox 158 total |
|---|---:|---:|
| new-file: create+open | 734 µs | 146.7 ms |
| new-file: first write | 70.5 µs | 14.1 ms |
| new-file: close | 518 µs | 103.6 ms |
| new-file: delete | 671 µs | 134.3 ms |
| new-file: full cycle | 1908 µs | 381.5 ms |

## Firefox 158

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T05:11:28.540Z
- performance.now() resolution in the worker: 20 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 2.0 MB used of 10737 MB
- Config: preset=quick, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=3, M=200

Median run of R=3 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 2,000 | 4,096 | 84.1 | 78.0–84.6 | 23,776 | 97.4 | 40.0 | 60.0 | 60.0 | 100.0 | 80.0 |
| small-overwrite | 2,000 | 4,096 | 75.9 | 75.1–80.3 | 26,344 | 107.9 | 40.0 | 40.0 | 60.0 | 80.0 | 80.0 |
| chunked-append (64 KiB) | 125 | 65,536 | 5.9 | 5.9–6.1 | 21,186 | 1388.5 | 40.0 | 60.0 | 80.0 | 80.0 | 80.0 |
| chunked-append (1 MiB) | 8 | 1,048,576 | 1.6 | 1.4–1.6 | 5,128 | 5251.3 | 200.0 | 220.0 | 220.0 | 220.0 | 220.0 |
| append+flush | 2,000 | 4,096 | 10408.9 | 10335.6–10413.9 | 192 | 0.8 | 5500.0 | 5700.0 | 6720.0 | 18100.0 | 5660.0 |
| new-file: create+open | 200 | – | 146.7 | 132.4–148.2 | 1,363 | – | 600.0 | 640.0 | 7900.0 | 13000.0 | 620.0 |
| new-file: first write | 200 | 4,096 | 14.1 | 13.6–14.6 | 14,184 | 58.1 | 60.0 | 80.0 | 100.0 | 120.0 | 80.0 |
| new-file: close | 200 | – | 103.6 | 83.1–105.1 | 1,930 | – | 180.0 | 200.0 | 22620.0 | 23720.0 | 180.0 |
| new-file: delete | 200 | – | 134.3 | 117.1–135.9 | 1,489 | – | 440.0 | 460.0 | 15940.0 | 16660.0 | 540.0 |
| new-file: full cycle | 200 | 4,096 | 381.5 | 366.9–401.1 | 524 | 2.1 | 1320.0 | 1420.0 | 17320.0 | 24780.0 | 1360.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 38.0 µs/call mean, 40.0 µs p50
- Size-growing write (small-append): 42.1 µs/call mean, 40.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 4.1 µs mean, 0.0 µs p50
- Same 8.2 MB in 125 × 64 KiB calls: 5.9 ms (1388 MB/s) vs 84.1 ms for 2,000 × 4 KiB; the small calls are 14.3× slower for the same bytes
- Same 8.2 MB in 8 × 1 MiB calls: 1.6 ms (5251 MB/s) vs 84.1 ms for 2,000 × 4 KiB; the small calls are 53.9× slower for the same bytes
- flush() after every write adds 5162.4 µs/call on top of small-append (append+flush: 5204.5 µs/call mean)
- small-append: first call into the fresh file 80.0 µs vs p50 40.0 / p99 60.0 µs; across runs 60.0–80.0 µs
- chunked-append (64 KiB): first call into the fresh file 80.0 µs vs p50 40.0 / p99 80.0 µs; across runs 80.0–120.0 µs
- chunked-append (1 MiB): first call into the fresh file 220.0 µs vs p50 200.0 / p99 220.0 µs; across runs 220.0–280.0 µs
- append+flush: first call into the fresh file 5660.0 µs vs p50 5500.0 / p99 6720.0 µs; across runs 4560.0–5760.0 µs
- new-file: 1.9 ms per file (524 files/s) = create+open 0.7 + first write 0.1 + close 0.5 + delete 0.7 ms
- new-file without delete (what populating OPFS pays per file): 1.3 ms
- First write into a new file (4 KiB): 70.5 µs vs 42.1 µs per small-append call

