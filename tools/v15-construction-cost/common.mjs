import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, lstatSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, relative, join, sep, dirname } from 'node:path';

export const read = path => JSON.parse(readFileSync(path, 'utf8'));
export const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export function inventory(root) {
  const files = {};
  function walk(path) {
    for (const name of readdirSync(path).sort()) {
      const next = join(path, name), stat = lstatSync(next);
      assert(!stat.isSymbolicLink(), `Unbound symlink: ${next}`);
      if (stat.isDirectory()) walk(next);
      else { assert(stat.isFile()); files[relative(root, next).split(sep).join('/')] = sha(next); }
    }
  }
  walk(root); return files;
}
export const verify = bindings => { for (const [path, hash] of Object.entries(bindings)) assert.equal(sha(path), hash, `Input drift: ${path}`); };
export function fresh(path, protectedPaths = []) {
  path = resolve(path);
  for (const protectedPath of protectedPaths.map(value => resolve(value)))
    assert(path !== protectedPath && !path.startsWith(protectedPath + sep) && !protectedPath.startsWith(path + sep), `Output overlaps input: ${path}`);
  assert(!existsSync(path), 'Preserve previous attempts'); mkdirSync(path, { recursive: true }); return path;
}
export function admit(manifestPath, hash) {
  manifestPath = resolve(manifestPath); assert.equal(sha(manifestPath), hash);
  const manifest = read(manifestPath), receipt = read(manifest.buildReceipt);
  assert.equal(manifest.kind, 'identified-built-kernel-v1');
  assert.equal(sha(manifest.buildReceipt), manifest.buildReceiptSha256);
  assert.equal(receipt.exitCode, 0); assert.equal(receipt.sourceUnchanged, true);
  assert.equal(receipt.head, manifest.head);
  assert.deepEqual(receipt.command, ['pnpm', 'nx', 'build', 'kernel', '--skip-nx-cache']);
  assert.deepEqual(inventory(manifest.root), manifest.files);
  assert.equal(read(join(manifest.root, 'package.json')).version.split('.')[0], '15');
  const bindings = { [manifestPath]: hash, [manifest.buildReceipt]: manifest.buildReceiptSha256 };
  for (const [name, value] of Object.entries(manifest.files)) bindings[join(manifest.root, name)] = value;
  for (const [path, value] of Object.entries(receipt.snapshots)) bindings[path] = value;
  const sources = {};
  for (const [original, hash] of Object.entries(receipt.bindings)) {
    const name = relative(receipt.cwd, original);
    assert(name && !name.startsWith('..') && !name.startsWith(sep));
    assert.equal(receipt.snapshots[join(dirname(manifest.buildReceipt), 'source', name)], hash);
    sources[name.split(sep).join('/')] = hash;
  }
  assert.equal(Object.keys(receipt.snapshots).length, Object.keys(receipt.bindings).length);
  for (const [name, value] of [['source.patch', receipt.patchSha256], ['build.log', receipt.logSha256]]) bindings[join(dirname(manifest.buildReceipt), name)] = value;
  verify(bindings); return { manifestPath, manifest, bindings, sources };
}
export const profiles = [
  { id: 'many-tiny', width: 1, trees: 256, writes: 32, mode: 'bare', entry: 'bare' },
  { id: 'ordinary', width: 8, trees: 128, writes: 64, mode: 'bare', entry: 'bare' },
  { id: 'wide', width: 128, trees: 16, writes: 256, mode: 'bare', entry: 'bare' },
  { id: 'ordinary-unrelated', width: 8, trees: 128, writes: 64, mode: 'unrelated', entry: 'loaded' },
  { id: 'late-leaf', width: 8, trees: 64, writes: 64, mode: 'leaf', entry: 'loaded' },
  { id: 'late-root', width: 8, trees: 32, writes: 64, mode: 'root', entry: 'loaded' },
  { id: 'transactions', width: 8, trees: 32, writes: 64, mode: 'transactions', entry: 'loaded' },
];
export const faults = { 'drop-tree': 'tree-count-oracle', 'drop-write': 'steady-state-oracle', 'drop-delivery': 'late-delivery-oracle', 'drop-unrelated': 'unrelated-delivery-oracle' };
export function schedule(kind) {
  const samples = [];
  const arms = ['baseline', 'planning', 'lazy'];
  for (const carrier of ['neutral', 'angular']) {
    if (kind === 'controls') {
      const profile = { id: 'control', width: 4, trees: 2, writes: 8, mode: 'leaf', entry: 'loaded' };
      for (const arm of arms) {
        samples.push({ arm, carrier, profile, kind: 'control' });
        samples.push({ arm, carrier, profile: { ...profile, id: 'unrelated-control', mode: 'unrelated' }, kind: 'control' });
        for (const fault of Object.keys(faults)) samples.push({ arm, carrier, profile: fault === 'drop-unrelated' ? { ...profile, mode: 'unrelated' } : profile, kind: 'control', fault });
        samples.push({ arm, carrier, profile, kind: 'heap-control', pin: true });
      }
      continue;
    }
    assert(['cpu', 'heap'].includes(kind));
    for (const [index, profile] of profiles.entries()) {
      for (let round = 0; round < 5; round++) {
        const offset = (round + index) % 3;
        const order = [...arms.slice(offset), ...arms.slice(0, offset)];
        if (round % 2) order.reverse();
        for (const arm of order) {
          const primary = { arm, carrier, profile, kind, round };
          const control = { ...primary, control: 'AA' };
          if (arm === 'baseline' && round % 2 === 0) samples.push(control);
          samples.push(primary);
          if (arm === 'baseline' && round % 2 !== 0) samples.push(control);
        }
      }
    }
  }
  return samples.map((sample, index) => ({ ...sample, index }));
}
