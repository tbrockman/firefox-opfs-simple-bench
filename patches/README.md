# Firefox patches

Experimental patches against mozilla-central for the OPFS metadata database
(`storage/default/<origin>/fs/metadata.sqlite`), produced and measured with
the benchmark in this repository. They apply to
`dom/fs/parent/datamodel/FileSystemDataManager.cpp`, function
`GetStorageConnection`, which opens the database with mozStorage defaults
(rollback journal, `synchronous = NORMAL`).

| Patch | Change | Durability |
|---|---|---|
| `0001-opfs-metadata-wal.patch` | `PRAGMA journal_mode = WAL` | a committed transaction survives a process crash; after power loss the database rolls back to the last checkpoint |
| `0002-opfs-metadata-wal-synchronous-full.patch` | WAL plus `PRAGMA synchronous = FULL` | every transaction durable, as today, but at one fsync of the WAL instead of three (journal, directory, database) |

## Why

Traced with `--strace-fsync`, an unpatched Firefox performs 21 fsyncs per
create, write, close, delete cycle on a file: seven metadata transactions,
each syncing the rollback journal, the `fs` directory (the journal is a new
file every time) and the database. On a Linux ext4 volume where an fsync is
a real cache flush that is about 75 ms per file; Chrome does none and costs
about 0.6 ms per file. See the main README for the workloads.

## Building and measuring

```sh
git clone --depth 1 --branch main https://github.com/mozilla-firefox/firefox.git ~/dev/firefox
cat > ~/dev/firefox-mozconfig <<'MOZ'
ac_add_options --enable-bootstrap
ac_add_options --enable-optimize
ac_add_options --disable-debug
ac_add_options --disable-debug-symbols
ac_add_options --disable-tests
ac_add_options --enable-linker=lld
ac_add_options --without-wasm-sandboxed-libraries
mk_add_options MOZ_OBJDIR=@TOPSRCDIR@/obj-opt
MOZ
cd ~/dev/firefox && export MOZCONFIG=~/dev/firefox-mozconfig
./mach --no-interactive bootstrap --application-choice browser --no-system-changes
./mach --no-interactive build                      # ~14 min on a Ryzen 7 7800X3D
cd <this repo>/automation
node run.mjs --preset quick --browsers firefox --firefox-path ~/dev/firefox/obj-opt/dist/bin/firefox --label local-baseline
cd ~/dev/firefox && git apply <this repo>/patches/0001-opfs-metadata-wal.patch && ./mach build   # incremental: seconds
cd <this repo>/automation
node run.mjs --preset quick --browsers firefox --firefox-path ~/dev/firefox/obj-opt/dist/bin/firefox --label local-wal
node run.mjs --preset quick --browsers firefox --firefox-path ~/dev/firefox/obj-opt/dist/bin/firefox --workloads new-file --m 200 --runs 1 --strace-fsync --label local-wal-strace
```

The unpatched local build (Firefox 158.0a1, commit 8d76a2ba4c, plain opt
build) reproduces the release numbers, so before/after comparisons within
the tree are representative.

## Results

Quick preset (M = 200 files, 3 runs), host: Ryzen 7 7800X3D, ext4 on LVM
on dm-crypt, Samsung 990 PRO; fsync costs 5.4 ms on this volume. Per file,
median run, mean:

| Build | create+open | first write | close | delete | full cycle | syncs per cycle |
|---|---:|---:|---:|---:|---:|---:|
| Firefox 158 unpatched | 32.4 ms | 0.11 ms | 21.0 ms | 21.7 ms | 75.2 ms | 21.1 |
| Firefox 158 + 0001 (WAL) | 0.73 ms | 0.07 ms | 0.52 ms | 0.67 ms | 1.91 ms | 0.12 |
| Firefox 158 + 0002 (WAL, FULL) | 16.2 ms | 0.11 ms | 10.7 ms | 10.8 ms | 37.8 ms | 7.1 |
| Firefox 155 on tmpfs (no fsync at all) | 0.59 ms | 0.06 ms | 0.24 ms | 0.45 ms | 1.34 ms | 0 |
| Chrome 152 | 0.31 ms | 0.07 ms | 0.08 ms | 0.11 ms | 0.57 ms | 0 |

With 0001 the remaining syncs are checkpoints only (20 on the WAL and 10 on
the database across 400 file cycles). With 0002 every one of the seven
transactions per cycle still fsyncs once, so the per-file cost is seven
fsyncs at this volume's 5.4 ms.

The write workloads (small-append, small-overwrite, chunked-append,
append+flush) are unchanged by either patch, as expected: they never touch
the metadata database inside the timed loop.

## What a real patch would still need

Beyond the pragma: count `metadata.sqlite-wal` and `-shm` in origin usage
(IndexedDB has the precedent), bound the WAL with `journal_size_limit` or
`wal_autocheckpoint`, consider `locking_mode = EXCLUSIVE` to avoid the
`-shm` mapping since there is one connection per origin, a pref for
rollout, and a test for the crash-consistency story, which
`RescanTrackedUsages` already partly covers. Reducing the seven
transactions per file cycle is the complementary fix; the tmpfs row is the
floor that batching would move.
