# OPFS sync write benchmark: 2026-09-15_20-20-08-strace

Host: AMD Ryzen 7 7800X3D 8-Core Processor (16 threads), 65 GB, linux 7.0.0-31-generic x64  
Config: preset=quick, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=3, M=200  
Browsers: Chrome 152, Firefox 155  
Profiles on: ext4 (/)  
Traced with strace: fsync counts below; ptrace overhead applies to those calls only.  
Date: 2026-09-16T03:20:09.457Z

## Per-call write cost (median run, mean time per call)

| Workload | Chrome 152 µs/call | Firefox 155 µs/call | Firefox 155 ÷ Chrome 152 | Chrome 152 total | Firefox 155 total |
|---|---:|---:|---:|---:|---:|
| small-append | 25.5 µs | 287 µs | 11.2× | 51.1 ms | 573.5 ms |
| small-overwrite | 12.7 µs | 283 µs | 22.4× | 25.3 ms | 566.9 ms |
| chunked-append (64 KiB) | 46.9 µs | 293 µs | 6.3× | 5.9 ms | 36.7 ms |
| chunked-append (1 MiB) | 366 µs | 438 µs | 1.2× | 2.9 ms | 3.5 ms |
| append+flush | 5142 µs | 5949 µs | 1.2× | 10.3 s | 11.9 s |

## Per-file cost (median run, mean time per call)

| Workload | Chrome 152 µs/call | Firefox 155 µs/call | Firefox 155 ÷ Chrome 152 | Chrome 152 total | Firefox 155 total |
|---|---:|---:|---:|---:|---:|
| new-file: create+open | 1693 µs | 49.1 ms | 29.0× | 338.6 ms | 9.8 s |
| new-file: first write | 365 µs | 587 µs | 1.6× | 73.0 ms | 117.3 ms |
| new-file: close | 496 µs | 31.9 ms | 64.2× | 99.2 ms | 6.4 s |
| new-file: delete | 480 µs | 32.3 ms | 67.4× | 96.0 ms | 6.5 s |
| new-file: full cycle | 3035 µs | 113.9 ms | 37.5× | 607.1 ms | 22.8 s |

## Durability syscalls per call (strace)

Counted with strace (fsync,fdatasync,syncfs,sync_file_range), attributed to workloads by wall-clock window; "per call" divides by calls × passes (warm-up included).

| Workload | Chrome 152 syncs/call | Chrome 152 ms in sync/call | Chrome 152 outside loop, per pass | Firefox 155 syncs/call | Firefox 155 ms in sync/call | Firefox 155 outside loop, per pass |
|---|---:|---:|---:|---:|---:|---:|
| small-append | 0.00 | 0.00 | 0.00 | 0.01 | 0.09 | 26 |
| small-overwrite | 0.00 | 0.00 | 0.25 | 0.00 | 0.01 | 21 |
| chunked-append (64 KiB) | 0.00 | 0.01 | 0.50 | 0.00 | 0.00 | 21 |
| chunked-append (1 MiB) | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 21 |
| append+flush | 1.0 | 5.34 | 1.0 | 1.0 | 5.55 | 22 |
| new-file | 0.00 | 0.00 | 0.00 | 21 | 111.43 | 0.00 |

"Outside the loop" is the per-pass file creation and deletion that workloads 1–4 do around their timed loop; new-file times those steps inside the loop.

Chrome 152: 8351 calls, 44.6 s inside them, 233 outside any workload. Most-synced files:
- `profile/Default/File System/000/t/00/00000017`: 2000 calls, 10.47 s
- `profile/Default/File System/000/t/00/00000018`: 2000 calls, 10.12 s
- `profile/Default/File System/000/t/00/00000019`: 2000 calls, 11.07 s
- `profile/Default/File System/000/t/00/00000020`: 2000 calls, 10.15 s
- `profile/Default`: 25 calls, 0.25 s
- `profile/Default/Web Data-journal`: 24 calls, 0.18 s
- `profile/Default/Affiliation Database-journal`: 16 calls, 0.11 s
- `profile/Default/Reporting and NEL-journal`: 15 calls, 0.11 s

Firefox 155: 25759 calls, 138.7 s inside them, 311 outside any workload. Most-synced files:
- `profile/storage/default/http+++127.0.0.1+44213/fs/metadata.sqlite-journal`: 5750 calls, 30.57 s
- `profile/storage/default/http+++127.0.0.1+44213/fs`: 5750 calls, 30.65 s
- `profile/storage/default/http+++127.0.0.1+44213/fs/metadata.sqlite`: 5750 calls, 30.30 s
- `profile/storage/default/http+++127.0.0.1+44213/fs/YI/YIN2PGVCO5HGFBMXRITH2SCSESIMWVF4RA66LSEJ7G2ZJQFTJTCA`: 2000 calls, 11.53 s
- `profile/storage/default/http+++127.0.0.1+44213/fs/OM/OMKL7A62YKIR5FNZXR7KVKRGZHWFNYQ5FRWJV5XJL5F36NM4BEVA`: 2000 calls, 10.85 s
- `profile/storage/default/http+++127.0.0.1+44213/fs/OQ/OQVEJJKZOJMSZVZ4PLVBOJ6VJAO4ECYRNVJNSBXM3Q3K6E5XWRXQ`: 2000 calls, 10.19 s
- `profile/storage/default/http+++127.0.0.1+44213/fs/R5/R5M7P3S25NWISAUGKKSO22Y7JW6U2Z54GO6QRKU32TCX7JAYZBWA`: 2000 calls, 11.21 s
- `profile/storage/permanent/chrome/idb/3870112724rsegmnoittet-es.sqlite-wal`: 52 calls, 0.39 s

## Chrome 152

**OPFS `FileSystemSyncAccessHandle.write()` per-call overhead benchmark**

Environment:
- User agent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/152.0.0.0 Safari/537.36`
- Platform: Linux x86_64; hardwareConcurrency: 16
- Timestamp: 2026-09-16T03:20:09.457Z
- performance.now() resolution in the worker: 5.0 µs (crossOriginIsolated: true)
- navigator.storage.estimate(): 0.0 MB used of 10737 MB
- Config: preset=quick, N=2000, S=4096 B, chunks=64 KiB / 1 MiB, R=3, M=200

Median run of R=3 (by total time) after one warm-up pass; latency percentiles are per call; "1st call" is call number 1 of that run (for the append workloads, the first write into the freshly created file):

| Workload | Calls | Bytes/call | Total (ms) | Total min–max (ms) | ops/s | MB/s | p50 (µs) | p90 (µs) | p99 (µs) | max (µs) | 1st call (µs) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| small-append | 2,000 | 4,096 | 51.1 | 50.4–53.1 | 39,150 | 160.4 | 10.0 | 10.0 | 15.0 | 15750.0 | 385.0 |
| small-overwrite | 2,000 | 4,096 | 25.3 | 24.0–27.0 | 78,958 | 323.4 | 10.0 | 10.0 | 15.0 | 9140.0 | 15.0 |
| chunked-append (64 KiB) | 125 | 65,536 | 5.9 | 5.7–6.1 | 21,313 | 1396.8 | 20.0 | 25.0 | 900.0 | 1220.0 | 390.0 |
| chunked-append (1 MiB) | 8 | 1,048,576 | 2.9 | 2.6–3.3 | 2,735 | 2800.7 | 160.0 | 670.0 | 670.0 | 670.0 | 635.0 |
| append+flush | 2,000 | 4,096 | 10284.4 | 10250.9–11208.2 | 194 | 0.8 | 5490.0 | 5665.0 | 6290.0 | 10075.0 | 5915.0 |
| new-file: create+open | 200 | – | 338.6 | 338.3–338.8 | 591 | – | 1670.0 | 1800.0 | 1970.0 | 2010.0 | 1955.0 |
| new-file: first write | 200 | 4,096 | 73.0 | 72.6–73.7 | 2,738 | 11.2 | 360.0 | 395.0 | 420.0 | 440.0 | 395.0 |
| new-file: close | 200 | – | 99.2 | 98.5–99.4 | 2,015 | – | 485.0 | 535.0 | 605.0 | 620.0 | 530.0 |
| new-file: delete | 200 | – | 96.0 | 95.4–97.2 | 2,083 | – | 465.0 | 525.0 | 615.0 | 620.0 | 445.0 |
| new-file: full cycle | 200 | 4,096 | 607.1 | 606.2–608.3 | 329 | 1.3 | 3000.0 | 3200.0 | 3405.0 | 3990.0 | 2930.0 |

Derived:
- Fixed per-call floor (small-overwrite, size never changes): 12.7 µs/call mean, 10.0 µs p50
- Size-growing write (small-append): 25.5 µs/call mean, 10.0 µs p50
- Extra cost per call when the write grows the file (append − overwrite): 12.9 µs mean, 0.0 µs p50
- Same 8.2 MB in 125 × 64 KiB calls: 5.9 ms (1397 MB/s) vs 51.1 ms for 2,000 × 4 KiB; the small calls are 8.7× slower for the same bytes
- Same 8.2 MB in 8 × 1 MiB calls: 2.9 ms (2801 MB/s) vs 51.1 ms for 2,000 × 4 KiB; the small calls are 17.5× slower for the same bytes
- flush() after every write adds 5116.7 µs/call on top of small-append (append+flush: 5142.2 µs/call mean)
- small-append: first call into the fresh file 385.0 µs vs p50 10.0 / p99 15.0 µs; across runs 340.0–400.0 µs (far above p99)
- chunked-append (64 KiB): first call into the fresh file 390.0 µs vs p50 20.0 / p99 900.0 µs; across runs 355.0–395.0 µs
- chunked-append (1 MiB): first call into the fresh file 635.0 µs vs p50 160.0 / p99 670.0 µs; across runs 495.0–635.0 µs
- append+flush: first call into the fresh file 5915.0 µs vs p50 5490.0 / p99 6290.0 µs; across runs 4925.0–5915.0 µs
- new-file: 3.0 ms per file (329 files/s) = create+open 1.7 + first write 0.4 + close 0.5 + delete 0.5 ms
- new-file without delete (what populating OPFS pays per file): 2.6 ms
- First write into a new file (4 KiB): 365.2 µs vs 25.5 µs per small-append call

## Firefox 155

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

