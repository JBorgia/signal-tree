import { mkdir, readFile, realpath, symlink, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source = '/private/tmp/st-installed-review-6wmzqU/consumer/node_modules/@signal-tree/kernel';
const manifest = JSON.parse(await readFile(`${source}/package.json`, 'utf8'));
if (manifest.name !== '@signal-tree/kernel' || manifest.version !== '16.0.0-dev') throw new Error('Unexpected installed artifact');
const parent = fileURLToPath(new URL('node_modules/@signal-tree/', import.meta.url));
const destination = `${parent}kernel`;
await mkdir(parent, { recursive: true });
try {
  await lstat(destination);
  if (await realpath(destination) !== await realpath(source)) throw new Error('Refusing to replace existing package');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await symlink(source, destination, 'dir');
}
console.log(`Using installed public package ${manifest.name}@${manifest.version}: ${await realpath(destination)}`);
