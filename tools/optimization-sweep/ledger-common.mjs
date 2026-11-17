import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export const read = path => JSON.parse(readFileSync(path, 'utf8'));
export const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
export const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export const verify = bindings => { for (const [path, hash] of Object.entries(bindings)) assert.equal(sha(path), hash, `Input drift: ${path}`); };
export const arms = ['C1', 'L1', 'L2', 'L3'];
export const profiles = [
  { id: 'quiet', P: 0, H: 0, E: 1, N: 256 },
  { id: 'pending', P: 1, H: 0, E: 1, N: 256 },
  { id: 'pending-long', P: 1, H: 0, E: 1, N: 1024 },
  { id: 'pending-many', P: 32, H: 0, E: 1, N: 256 },
  { id: 'history', P: 0, H: 32, E: 1, N: 256 },
  { id: 'wide', P: 0, H: 0, E: 32, N: 256 },
  { id: 'fractional-history', P: 0, H: 0.5, E: 1, N: 256 },
];
export const heapProfiles = [
  { id: 'pending-wide-confirm', P: 1, H: 0, E: 32, N: 256, settlement: 'confirm' },
  { id: 'pending-wide-rollback', P: 1, H: 0, E: 32, N: 256, settlement: 'rollback' },
  { id: 'history-wide', P: 0, H: 32, E: 32, N: 256, settlement: 'none' },
  { id: 'fractional-history', P: 0, H: 0.5, E: 1, N: 256, settlement: 'none' },
];
export function fileInventory(root) {
  const result = {};
  const walk = path => {
    for (const name of readdirSync(path).sort()) {
      const next = join(path, name), stat = lstatSync(next);
      assert.ok(!stat.isSymbolicLink(), `No unbound symlink: ${next}`);
      if (stat.isDirectory()) walk(next);
      else if (stat.isFile()) result[relative(root, next).split(sep).join('/')] = sha(next);
      else assert.fail(`Unexpected payload: ${next}`);
    }
  };
  walk(root); return result;
}
export function freshOutside(path, protectedRoots) {
  path = resolve(path);
  for (const root of protectedRoots.map(root => resolve(root)))
    assert.ok(path !== root && !path.startsWith(root + sep) && !root.startsWith(path + sep), `Output overlaps input: ${path} / ${root}`);
  assert.ok(!existsSync(path), `Preserve earlier output: ${path}`);
  mkdirSync(path, { recursive: true }); return path;
}
export function admitKernel(item, label) {
  assert.equal(typeof item.manifest, 'string');
  assert.match(item.manifestSha256, /^[a-f0-9]{64}$/);
  assert.match(item.transactionsSourceSha256, /^[a-f0-9]{64}$/);
  const path = resolve(item.manifest), manifest = read(path);
  assert.equal(sha(path), item.manifestSha256, `${label} manifest identity`);
  assert.equal(manifest.kind, 'identified-built-kernel-v1');
  assert.deepEqual(fileInventory(manifest.root), manifest.files, `${label} complete package payload inventory`);
  assert.equal(sha(manifest.buildReceipt), manifest.buildReceiptSha256);
  const receipt = read(manifest.buildReceipt);
  assert.equal(receipt.exitCode, 0); assert.equal(receipt.sourceUnchanged, true);
  assert.equal(receipt.head, manifest.head);
  const bindings = { [path]: sha(path), [manifest.buildReceipt]: sha(manifest.buildReceipt) };
  for (const [name, hash] of Object.entries(manifest.files)) bindings[join(manifest.root, name)] = hash;
  const sources = {};
  for (const [original, hash] of Object.entries(receipt.bindings)) {
    const name = relative(receipt.cwd, original);
    assert.ok(name && !name.startsWith('..') && !name.startsWith(sep));
    const snapshot = join(dirname(manifest.buildReceipt), 'source', name);
    assert.equal(receipt.snapshots[snapshot], hash, `${label} source receipt join`);
    assert.equal(sha(snapshot), hash, `${label} immutable source snapshot`);
    bindings[snapshot] = hash; sources[name.split(sep).join('/')] = hash;
  }
  assert.equal(Object.keys(receipt.snapshots).length, Object.keys(sources).length, 'No unmatched source snapshots');
  const patch = join(dirname(manifest.buildReceipt), 'source.patch'), log = join(dirname(manifest.buildReceipt), 'build.log');
  assert.equal(sha(patch), receipt.patchSha256); assert.equal(sha(log), receipt.logSha256);
  bindings[patch] = sha(patch); bindings[log] = sha(log);
  assert.equal(sources['packages/kernel/src/enhancers/transactions/transactions.ts'], item.transactionsSourceSha256, `${label} exact proposed mechanism source`);
  return { manifestPath: path, manifest, receipt, sources, bindings };
}
export function requireIsolatedSources(admitted) {
  const production = sources => Object.fromEntries(Object.entries(sources).filter(([name]) =>
    !name.endsWith('.spec.ts') && !name.endsWith('.gc.ts') && !name.includes('/tests/') &&
    name !== 'packages/kernel/src/enhancers/transactions/transactions.ts'));
  const baseline = production(admitted.C1.sources);
  for (const arm of arms.slice(1)) assert.deepEqual(production(admitted[arm].sources), baseline, `${arm} must differ only in transactions.ts and test-only files`);
}
export function schedule(kind) {
  const items = [];
  if (kind === 'cpu') {
    profiles.forEach((profile, index) => {
      for (let round = 0; round < 3; round++) {
        const offset = (index + round) % arms.length;
        const order = [...arms.slice(offset), ...arms.slice(0, offset)];
        if (round % 2) order.reverse();
        for (const arm of order) items.push({ kind, arm, profile, round, settlement: 'rollback' });
      }
      if (['pending-long', 'wide'].includes(profile.id)) for (let pair = 0; pair < 2; pair++)
        for (let repeat = 0; repeat < 2; repeat++) items.push({ kind, arm: 'C1', profile, round: pair, repeat, control: 'AA', settlement: 'rollback' });
    });
    assert.equal(items.length, 92);
  } else if (kind === 'heap') {
    heapProfiles.forEach((profile, index) => {
      const order = index % 2 ? [...arms].reverse() : arms;
      for (const arm of order) items.push({ kind, arm, profile, round: 0, settlement: profile.settlement });
    });
    for (let repeat = 0; repeat < 2; repeat++) items.push({ kind, arm: 'C1', profile: heapProfiles[1], round: 0, repeat, control: 'AA', settlement: 'rollback' });
    assert.equal(items.length, 18);
  } else {
    assert.equal(kind, 'controls');
    const profile = { id: 'oracle-control', P: 1, H: 2, E: 2, N: 4 };
    for (const fault of [null, 'drop-write', 'drop-record', 'swap-effect', 'skip-settlement'])
      items.push({ kind: 'control', arm: 'C1', profile, round: 0, settlement: 'rollback', fault });
    items.push({ kind: 'overlap-control', arm: 'C1', profile: { id: 'overlap', P: 0, H: 0, E: 1, N: 4 }, round: 0, settlement: 'rollback' });
    items.push({ kind: 'heap-control', arm: 'C1', profile: { id: 'pin-release', P: 0, H: 0, E: 1, N: 4 }, round: 0, settlement: 'none', control: 'pin-release' });
  }
  return items.map((sample, index) => ({ index, ...sample }));
}
export const expectedFaults = { 'drop-write': 'value-oracle', 'drop-record': 'ledger-ids-oracle', 'swap-effect': 'effect-value-oracle', 'skip-settlement': 'pending-oracle' };
