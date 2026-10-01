import { createHash } from 'node:crypto';
import {
  existsSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';

export const sha256 = (bytes) =>
  createHash('sha256').update(bytes).digest('hex');

/** Package mode excludes dependencies; installed-tree mode follows/deduplicates pnpm links. */
export function fileManifest(
  root,
  { installedTree = false, ignoreRoot = [] } = {}
) {
  if (!existsSync(root)) return null;
  const files = [];
  const seen = new Set();
  const walk = (dir, prefix = '') => {
    const real = realpathSync(dir);
    if (seen.has(real)) return;
    seen.add(real);
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    )) {
      if (
        (!installedTree && entry.name === 'node_modules') ||
        (installedTree && entry.name === '.cache') ||
        (!prefix && ignoreRoot.includes(entry.name))
      )
        continue;
      const path = prefix + entry.name;
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink() && installedTree) {
        files.push({ path, target: realpathSync(full) });
        if (statSync(full).isDirectory()) walk(full, path + '/');
        else
          files.push({
            path: path + '#content',
            sha256: sha256(readFileSync(full)),
          });
      } else if (entry.isDirectory()) walk(full, path + '/');
      else if (entry.isFile()) {
        const bytes = readFileSync(full);
        files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
      } else throw new Error(`Cannot fingerprint non-regular file: ${full}`);
    }
  };
  walk(root);
  return {
    root: realpathSync(root),
    sha256: sha256(JSON.stringify(files)),
    files,
  };
}
