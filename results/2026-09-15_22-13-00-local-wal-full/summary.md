# OPFS sync write benchmark: 2026-09-15_22-13-00-local-wal-full

Host: AMD Ryzen 7 7800X3D 8-Core Processor (16 threads), 65 GB, linux 7.0.0-31-generic x64  
Config: preset=quick, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=3, M=200  
Browsers: Firefox 158  
Profiles on: ext4 (/)  
Single-browser run (firefox): no cross-browser comparison.  
Local build: Firefox 158 from /home/theo/dev/firefox/obj-opt/dist/bin/firefox.  
Note: Local mozilla-central build 8d76a2ba4c (Firefox 158.0a1, plain opt build) with patches/0002-opfs-metadata-wal-synchronous-full.patch (PRAGMA journal_mode = WAL plus synchronous = FULL)  
Date: 2026-09-16T05:13:01.982Z

## Per-call write cost (median run, mean time per call)

| Workload | Firefox 158 µs/call | Firefox 158 total |
|---|---:|---:|
| small-append | 40.0 µs | 80.1 ms |
| small-overwrite | 37.5 µs | 74.9 ms |
| chunked-append (64 KiB) | 51.8 µs | 6.5 ms |
| chunked-append (1 MiB) | 183 µs | 1.5 ms |
| append+flush | 5271 µs | 10.5 s |

## Per-file cost (median run, mean time per call)

| Workload | Firefox 158 µs/call | Firefox 158 total |
|---|---:|---:|
| new-file: create+open | 16.2 ms | 3.2 s |
| new-file: first write | 111 µs | 22.1 ms |
| new-file: close | 10.7 ms | 2.1 s |
| new-file: delete | 10.8 ms | 2.2 s |
| new-file: full cycle | 37.8 ms | 7.6 s |

## Firefox 158

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64; rv:158.0) Gecko/20100101 Firefox/158.0`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T05:13:01.982Z
- performance.now() resolution in the worker: 20 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 2.0 MB used of 10737 MB
- Config: preset=quick, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=3, M=200

Median run of R=3 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 2,000 | 4,096 | 80.1 | 80.0–82.2 | 24,981 | 102.3 | 40.0 | 40.0 | 60.0 | 120.0 | 120.0 |
| small-overwrite | 2,000 | 4,096 | 74.9 | 72.5–75.3 | 26,695 | 109.3 | 40.0 | 40.0 | 60.0 | 80.0 | 80.0 |
| chunked-append (64 KiB) | 125 | 65,536 | 6.5 | 6.4–6.7 | 19,290 | 1264.2 | 60.0 | 60.0 | 80.0 | 120.0 | 120.0 |
| chunked-append (1 MiB) | 8 | 1,048,576 | 1.5 | 1.3–1.6 | 5,479 | 5611.0 | 180.0 | 220.0 | 220.0 | 220.0 | 180.0 |
| append+flush | 2,000 | 4,096 | 10542.1 | 10473.3–10616.2 | 190 | 0.8 | 5560.0 | 5760.0 | 7420.0 | 15180.0 | 5580.0 |
| new-file: create+open | 200 | – | 3230.1 | 3192.1–3325.3 | 62 | – | 16180.0 | 16600.0 | 23240.0 | 24500.0 | 16420.0 |
| new-file: first write | 200 | 4,096 | 22.1 | 21.6–22.6 | 9,042 | 37.0 | 100.0 | 140.0 | 160.0 | 220.0 | 100.0 |
| new-file: close | 200 | – | 2130.3 | 2119.8–2131.6 | 94 | – | 10300.0 | 10480.0 | 23720.0 | 30160.0 | 10220.0 |
| new-file: delete | 200 | – | 2167.9 | 2163.7–2212.5 | 92 | – | 10700.0 | 11000.0 | 15660.0 | 17060.0 | 10660.0 |
| new-file: full cycle | 200 | 4,096 | 7551.4 | 7497.9–7692.5 | 26 | 0.1 | 37240.0 | 38200.0 | 51020.0 | 56220.0 | 37400.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 37.5 µs/call mean, 40.0 µs p50
- Size-growing write (small-append): 40.0 µs/call mean, 40.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 2.6 µs mean, 0.0 µs p50
- Same 8.2 MB in 125 × 64 KiB calls: 6.5 ms (1264 MB/s) vs 80.1 ms for 2,000 × 4 KiB; the small calls are 12.4× slower for the same bytes
- Same 8.2 MB in 8 × 1 MiB calls: 1.5 ms (5611 MB/s) vs 80.1 ms for 2,000 × 4 KiB; the small calls are 54.8× slower for the same bytes
- flush() after every write adds 5231.0 µs/call on top of small-append (append+flush: 5271.0 µs/call mean)
- small-append: first call into the fresh file 120.0 µs vs p50 40.0 / p99 60.0 µs; across runs 120.0–120.0 µs
- chunked-append (64 KiB): first call into the fresh file 120.0 µs vs p50 60.0 / p99 80.0 µs; across runs 100.0–120.0 µs
- chunked-append (1 MiB): first call into the fresh file 180.0 µs vs p50 180.0 / p99 220.0 µs; across runs 180.0–240.0 µs
- append+flush: first call into the fresh file 5580.0 µs vs p50 5560.0 / p99 7420.0 µs; across runs 4660.0–5660.0 µs
- new-file: 37.8 ms per file (26 files/s) = create+open 16.2 + first write 0.1 + close 10.7 + delete 10.8 ms
- new-file without delete (what populating OPFS pays per file): 26.9 ms
- First write into a new file (4 KiB): 110.6 µs vs 40.0 µs per small-append call

