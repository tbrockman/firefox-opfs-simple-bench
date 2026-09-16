// automation/fsinfo.mjs — which filesystem holds a directory, from `mount`.
// Used to record where the throwaway profiles lived (tmpfs vs a real disk
// changes every durability-bound number), so a run explains itself.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Returns { type, mountPoint, device } for the longest mount point that
// prefixes `dir`, or null if `mount` is unavailable. Handles both formats:
//   Linux:  /dev/sda1 on / type ext4 (rw,relatime)
//   macOS:  /dev/disk3s5 on /System/Volumes/Data (apfs, local, journaled)
export function filesystemOf(dir) {
  let table;
  try {
    table = execFileSync('mount', { encoding: 'utf8' });
  } catch {
    return null;
  }
  let target = path.resolve(dir);
  try { target = fs.realpathSync(target); } catch { /* the directory may be gone; use the path as given */ }
  let best = null;
  for (const line of table.split('\n')) {
    const m = /^(\S+) on (.+?) type (\S+) \(/.exec(line) || /^(\S+) on (.+?) \((\w+)[,)]/.exec(line);
    if (!m) continue;
    const [, device, mountPoint, type] = m;
    const prefix = mountPoint.endsWith('/') ? mountPoint : `${mountPoint}/`;
    if (target === mountPoint || target.startsWith(prefix)) {
      if (!best || mountPoint.length > best.mountPoint.length) best = { type, mountPoint, device };
    }
  }
  return best;
}

export const describeFilesystem = (info) => (info ? `${info.type} (${info.mountPoint})` : 'unknown');
