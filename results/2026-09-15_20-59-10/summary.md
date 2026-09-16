# OPFS sync write benchmark: 2026-09-15_20-59-10

Host: AMD Ryzen 7 7800X3D 8-Core Processor (16 threads), 65 GB, linux 7.0.0-31-generic x64  
Config: preset=full, N=20000, S=4096 B, chunks=64 KiB / 1 MiB, R=5, M=2000  
Browsers: Chrome 152, Firefox 155  
Profiles on: ext4 (/)  
Date: 2026-09-16T03:59:10.756Z

## Per-call write cost (median run, mean time per call)

| Workload | Chrome 152 µs/call | Firefox 155 µs/call | Firefox 155 ÷ Chrome 152 | Chrome 152 total | Firefox 155 total |
|---|---:|---:|---:|---:|---:|
| small-append | 8.8 µs | 37.4 µs | 4.3× | 175.4 ms | 748.2 ms |
| small-overwrite | 6.6 µs | 35.5 µs | 5.4× | 131.2 ms | 709.0 ms |
| chunked-append (64 KiB) | 19.0 µs | 46.8 µs | 2.5× | 23.8 ms | 58.5 ms |
| chunked-append (1 MiB) | 160 µs | 206 µs | 1.3× | 12.6 ms | 16.3 ms |
| append+flush | 5454 µs | 5579 µs | 1.0× | 109.1 s | 111.6 s |

## Per-file cost (median run, mean time per call)

| Workload | Chrome 152 µs/call | Firefox 155 µs/call | Firefox 155 ÷ Chrome 152 | Chrome 152 total | Firefox 155 total |
|---|---:|---:|---:|---:|---:|
| new-file: create+open | 375 µs | 34.0 ms | 90.7× | 749.7 ms | 68.0 s |
| new-file: first write | 86.0 µs | 100 µs | 1.2× | 172.0 ms | 200.2 ms |
| new-file: close | 84.7 µs | 22.2 ms | 262× | 169.4 ms | 44.4 s |
| new-file: delete | 147 µs | 22.9 ms | 156× | 294.0 ms | 45.7 s |
| new-file: full cycle | 693 µs | 79.2 ms | 114× | 1.4 s | 158.4 s |

## Chrome 152

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

## Firefox 155

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

