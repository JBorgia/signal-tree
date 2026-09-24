import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Shared by the publisher and gate runner. Include names, bytes and executable
// bits; links and special files cannot supply sealed artifact evidence.
export function buildIntegrity(root, packages) {
  const entries = [];
  const visit = (path, relative) => {
    const stat = lstatSync(path);
    if (stat.isDirectory()) {
      entries.push([relative, 'directory']);
      for (const name of readdirSync(path).sort())
        visit(join(path, name), `${relative}/${name}`);
    } else if (stat.isFile()) {
      entries.push([
        relative,
        'file',
        stat.mode & 0o111,
        createHash('sha256').update(readFileSync(path)).digest('hex'),
      ]);
    } else {
      throw new Error(`Unsupported build artifact: ${relative}`);
    }
  };
  for (const name of packages)
    visit(join(root, 'dist', 'packages', name), name);
  return `sha256-${createHash('sha256')
    .update(JSON.stringify(entries))
    .digest('hex')}`;
}
