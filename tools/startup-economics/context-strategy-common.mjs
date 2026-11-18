import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
export function inventory(root) {
  const output = {};
  const walk = (directory, prefix = '') => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), `Unexpected package/source alias: ${entry.name}`);
      const relative = prefix + entry.name, path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path, relative + '/');
      else { assert(entry.isFile()); output[relative] = sha(path); }
    }
  };
  walk(root); return Object.fromEntries(Object.entries(output).sort(([a], [b]) => a.localeCompare(b)));
}
