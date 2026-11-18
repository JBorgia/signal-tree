import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

export const read = path => JSON.parse(readFileSync(path, 'utf8'));
export const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
export const verify = bindings => { for (const [path, hash] of Object.entries(bindings)) assert.equal(sha(path), hash, `Input drift: ${path}`); };
export const describe = error => error instanceof Error ? error.stack ?? error.message : String(error);
export const phaseNames = ['factory', 'initialAttach', 'population', 'populationDrain', 'literalEdits', 'literalEditDrain', 'firstContext', 'lateAttach', 'repeatedContexts', 'historyMutation', 'historySettlement', 'historyDrain', 'restoreRoundtrip', 'disposeAndDrain', 'destroyAndDrain'];
export const checkpointNames = ['moduleReady', 'empty', 'populated', 'literalEdited', 'contextHeld', 'enrolled', 'historyHeld', 'linksDisposed', 'destroyedHeld', 'helperReturned'];
export const faults = { 'drop-edit': 'first-context-oracle', 'drop-population': 'population-count-oracle', 'drop-unrelated': 'unrelated-delivery-oracle', 'skip-settlement': 'settled-pending-oracle', 'corrupt-earlier-delivery': 'target-delivery-history-oracle' };

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
export function fresh(path, protectedPaths = []) {
  path = resolve(path);
  for (const item of protectedPaths.map(value => resolve(value)))
    assert(path !== item && !path.startsWith(item + sep) && !item.startsWith(path + sep), `Output overlaps input: ${path} / ${item}`);
  assert(!existsSync(path), `Preserve earlier output: ${path}`);
  mkdirSync(path, { recursive: true }); return path;
}
export function admitKernel(item) {
  const manifestPath = resolve(item.manifest);
  assert.match(item.manifestSha256, /^[a-f0-9]{64}$/);
  assert.equal(sha(manifestPath), item.manifestSha256);
  const manifest = read(manifestPath), receipt = read(manifest.buildReceipt);
  assert.equal(manifest.kind, 'identified-built-kernel-v1');
  assert.equal(sha(manifest.buildReceipt), manifest.buildReceiptSha256);
  assert.equal(receipt.exitCode, 0); assert.equal(receipt.sourceUnchanged, true);
  assert.equal(receipt.head, manifest.head);
  assert.deepEqual(receipt.command, ['pnpm', 'nx', 'build', 'kernel', '--skip-nx-cache']);
  assert.deepEqual(inventory(manifest.root), manifest.files, 'Complete package inventory');
  const bindings = { [manifestPath]: item.manifestSha256, [manifest.buildReceipt]: manifest.buildReceiptSha256 };
  for (const [name, hash] of Object.entries(manifest.files)) bindings[join(manifest.root, name)] = hash;
  const snapshots = {}, originals = {}, snapshotRoot = join(dirname(manifest.buildReceipt), 'source');
  let sourceRoot;
  // build-kernel.py binds absolute originals and copied snapshots but does not
  // currently put cwd in its receipt. Rejoin both complete inventories through
  // exact relative paths; never require the now-edited workspace to match.
  for (const [snapshot, hash] of Object.entries(receipt.snapshots)) {
    const name = relative(snapshotRoot, snapshot);
    assert(name && !name.startsWith('..') && !name.startsWith(sep));
    const matches = Object.entries(receipt.bindings).filter(([original, expected]) => original.endsWith(sep + name) && expected === hash);
    assert.equal(matches.length, 1, `Exact original/snapshot join: ${name}`);
    const [original] = matches[0], root = original.slice(0, -name.length - 1);
    if (sourceRoot === undefined) sourceRoot = root; else assert.equal(root, sourceRoot, 'Single build source root');
    originals[original] = hash; snapshots[snapshot] = hash;
  }
  assert.deepEqual(originals, receipt.bindings);
  if (receipt.cwd !== undefined) assert.equal(receipt.cwd, sourceRoot);
  Object.assign(bindings, snapshots);
  for (const [name, hash] of [['source.patch', receipt.patchSha256], ['build.log', receipt.logSha256]])
    bindings[join(dirname(manifest.buildReceipt), name)] = hash;
  verify(bindings);
  const pkg = read(join(manifest.root, 'package.json'));
  assert.equal(pkg.name, '@signal-tree/kernel'); assert.equal(Number(pkg.version.split('.')[0]), 16);
  return { manifestPath, manifest, bindings, sourceRoot };
}
export function validateConfig(config) {
  assert.equal(config.kind, 'publication-activation-config-v1');
  assert(Number.isInteger(config.cpuRounds) && config.cpuRounds >= 3 && config.cpuRounds <= 5);
  assert(Number.isInteger(config.heapRounds) && config.heapRounds >= 1 && config.heapRounds <= 5);
  assert(Number.isInteger(config.timeoutMs) && config.timeoutMs >= 1000 && config.timeoutMs <= 600000);
  assert(config.profiles.length > 0 && config.profiles.length <= 24);
  assert.equal(new Set(config.profiles.map(p => p.id)).size, config.profiles.length);
  for (const p of config.profiles) {
    assert.match(p.id, /^[a-z0-9-]+$/); assert(['entity', 'ordinary'].includes(p.shape));
    assert(['none', 'transactions', 'restoration', 'both'].includes(p.enhancer));
    assert(['absent', 'unrelated', 'initial', 'late'].includes(p.link));
    for (const key of ['trees', 'rows', 'width', 'history']) assert(Number.isInteger(p[key]) && p[key] > 0);
    assert(p.width >= 2 && p.width <= 128 && p.rows <= 10000 && p.trees <= 256 && p.history <= 20);
    if (p.shape === 'ordinary') assert.equal(p.rows, 1);
    if (p.link === 'absent') assert.equal(p.enhancer, 'none', 'No-Link control retains exactly signalTree/entityMap named imports');
  }
  for (const shape of ['entity', 'ordinary']) assert(config.profiles.some(p => p.shape === shape));
  for (const link of ['absent', 'unrelated', 'initial', 'late']) assert(config.profiles.some(p => p.link === link));
  for (const enhancer of ['none', 'transactions', 'restoration', 'both']) assert(config.profiles.some(p => p.enhancer === enhancer));
}
export function makeSchedule(config, kind) {
  const samples = [];
  if (kind === 'controls') {
    const p = { id: 'controls', shape: 'entity', trees: 1, rows: 16, width: 8, enhancer: 'transactions', link: 'late', history: 2 };
    for (const arm of ['baseline', 'candidate']) {
      samples.push({ arm, kind: 'control', profile: p, round: 0 });
      samples.push({ arm, kind: 'control', profile: { ...p, id: 'restoration-control', enhancer: 'restoration' }, round: 0 });
      const initial = { ...p, id: 'initial-delivery-control', link: 'initial' };
      samples.push({ arm, kind: 'control', profile: initial, round: 0 });
      for (const fault of Object.keys(faults)) samples.push({ arm, kind: 'control', profile: fault === 'corrupt-earlier-delivery' ? initial : p, round: 0, fault });
      samples.push({ arm, kind: 'heap-control', profile: p, round: 0, control: 'pin-release' });
    }
  } else {
    assert(['cpu', 'heap'].includes(kind));
    for (const [index, profile] of config.profiles.entries())
      for (let round = 0; round < config[kind + 'Rounds']; round++)
        for (const arm of (round + index) % 2 ? ['candidate', 'baseline'] : ['baseline', 'candidate'])
          samples.push({ arm, kind, profile, round });
    // Two independent baseline A/A pairs, covering ordinary and entity shapes.
    for (const shape of ['entity', 'ordinary']) {
      const profile = config.profiles.find(p => p.shape === shape && p.link === 'unrelated');
      assert(profile, 'A/A needs unrelated-Link ordinary and entity profiles');
      for (let repeat = 0; repeat < 2; repeat++) samples.push({ arm: 'baseline', kind, profile, round: 0, control: 'AA', repeat });
    }
  }
  return samples.map((sample, index) => ({ index, ...sample }));
}
