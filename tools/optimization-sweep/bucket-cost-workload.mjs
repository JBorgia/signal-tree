import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { digest, expectedState, ids, row, scalar } from './bucket-cost-common.mjs';
export const describeError = error => error instanceof Error ? error.stack ?? error.message : inspect(error);
const job = () => new Promise(resolve => setImmediate(resolve));
const start = () => ({ cpu: process.cpuUsage(), at: process.hrtime.bigint() });
const stop = clock => { const elapsedNs = Number(process.hrtime.bigint() - clock.at), cpuMicroseconds = process.cpuUsage(clock.cpu); return { elapsedNs, cpuMicroseconds, cpuMs: (cpuMicroseconds.user + cpuMicroseconds.system) / 1000 }; };
const measured = (enabled, result, name, work) => { const clock = enabled ? start() : undefined, value = work(); if (enabled) result.stages[name] = stop(clock); return value; };
async function drain() { for (let i = 0; i < 4; i++) await Promise.resolve(); await job(); }
async function measuredDrain(enabled, result, name, notifier) { const clock = enabled ? start() : undefined; await drain(); if (enabled) result.stages[name] = stop(clock); assert.equal(notifier.hasPending(), false, 'drain-oracle'); }
const valueSnapshot = (tree, profile) => profile.shape === 'entity' ? tree.$.rows.all() : Object.fromEntries(Array.from({ length: profile.count }, (_, i) => [`s${i}`, tree.$.scalars[`s${i}`]()]));
function checkState(tree, runtime, profile, remaining) {
  assert.equal(runtime.getPendingTurnCount(), remaining, 'pending-oracle');
  const pending = runtime.getPendingTurnIds(); assert.deepEqual(pending, ids(remaining), 'pending-ids-oracle');
  const expected = expectedState(profile, remaining), actual = valueSnapshot(tree, profile);
  if (profile.shape === 'entity') {
    const byId = new Map(actual.map(value => [value.id, value]));
    assert.equal(byId.size, expected.length, 'value-oracle');
    for (const value of expected) assert.deepEqual(byId.get(value.id), value, 'value-oracle');
    assert.deepEqual(actual.map(value => value.id), expected.map(value => value.id), 'order-oracle');
    assert.deepEqual(tree.$.rows.ids(), expected.map(value => value.id), 'order-oracle');
    assert.equal(tree.$.rows.count(), expected.length, 'count-oracle');
  } else assert.deepEqual(actual, expected, 'value-oracle');
  return { pending: remaining, ids: pending, valuesSha256: digest(actual) };
}
async function checkpoint(result, name, refs) {
  assert.equal(typeof globalThis.gc, 'function');
  for (let i = 0; i < 3; i++) { await job(); globalThis.gc(); }
  result.checkpoints[name] = { heapUsed: process.memoryUsage().heapUsed, alive: Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, ref.deref() !== undefined])) };
}
function openAll(tree, method, sample, handles) {
  for (let i = 0; i < sample.profile.count; i++) {
    // Each transaction owns a distinct leaf/key. A deliberate control swaps only
    // insertion order, keeping the complete set of useful entity values intact.
    const index = sample.fault === 'wrong-order' && i < 2 ? 1 - i : i;
    handles.push(tree[method](() => {
      if (sample.profile.shape === 'entity') tree.$.rows.addOne(row(index));
      else tree.$.scalars[`s${i}`](sample.fault === 'wrong-value' && i === 0 ? [-1, 0] : scalar(i));
    }));
  }
}
function sampleOwnedPayload(tree, profile, snapshot, refs, pins) {
  const target = profile.shape === 'entity' ? snapshot[0] : snapshot.s0;
  const actual = profile.shape === 'entity' ? tree.$.rows.all()[0] : tree.$.scalars.s0();
  assert.equal(target, actual, 'actual-payload-owner-oracle');
  assert.ok(target && typeof target === 'object'); refs.payload = new WeakRef(target);
  if (pins) pins.push(tree, target);
}
export async function runWorkload(api, method, sample, result) {
  const heap = sample.kind === 'heap' || sample.kind === 'heap-control', timed = sample.kind === 'cpu';
  assert.equal(typeof globalThis.gc === 'function', heap, 'Separate CPU and explicit-GC children');
  result.stages = {}; result.settlementSamples = []; result.oracles = { steps: [] }; result.checkpoints = {};
  const refs = {}, pins = sample.control === 'pin-release' ? [] : undefined;
  if (heap) await checkpoint(result, 'moduleReady', refs);
  await episode();
  if (heap) {
    await checkpoint(result, 'helperReturned', refs);
    assert.equal(result.checkpoints.helperReturned.alive.tree, Boolean(pins), 'tree-release-oracle');
    assert.equal(result.checkpoints.helperReturned.alive.payload, Boolean(pins), 'payload-release-oracle');
    if (pins) {
      pins.length = 0; await checkpoint(result, 'pinReleased', refs);
      assert.deepEqual(result.checkpoints.pinReleased.alive, { tree: false, payload: false }, 'pin-release-oracle');
    }
  }
  async function episode() {
    let tree, runtime, handles = [], heldSnapshot, heldDigest, failed = false;
    const notifier = api.getPathNotifier(), profile = sample.profile;
    try {
      const state = profile.shape === 'entity' ? { rows: api.entityMap({ selectId: value => value.id }) } : { scalars: Object.fromEntries(Array.from({ length: profile.count }, (_, i) => [`s${i}`, []])) };
      tree = measured(timed, result, 'factory', () => api.signalTree(state, { enhancers: [api.transactions({ history: { retain: 0 } })] }));
      runtime = api.peekInternalTransactionRuntime(tree); assert.ok(runtime, 'runtime-oracle');
      assert.equal(typeof tree[method], 'function', 'exact-line-transaction-method-oracle');
      assert.equal(runtime.getPendingTurnCount(), 0, 'empty-pending-oracle');
      assert.equal(runtime.getConfirmedTurnCount(), 0, 'empty-ledger-oracle');
      const emptyValues = valueSnapshot(tree, profile);
      assert.deepEqual(emptyValues, expectedState({ ...profile, settlement: 'rollback' }, 0), 'empty-value-oracle');
      result.oracles.empty = { pending: 0, confirmed: 0, valuesSha256: digest(emptyValues) };
      if (heap) { refs.tree = new WeakRef(tree); await checkpoint(result, 'empty', refs); }
      measured(timed, result, 'openAll', () => openAll(tree, method, sample, handles));
      await measuredDrain(timed, result, 'openDrain', notifier);
      result.oracles.pending = checkState(tree, runtime, profile, profile.count);
      heldSnapshot = valueSnapshot(tree, profile); heldDigest = digest(heldSnapshot);
      result.oracles.pending.snapshotSha256 = heldDigest;
      if (heap) {
        sampleOwnedPayload(tree, profile, heldSnapshot, refs, pins);
        await checkpoint(result, 'pending', refs);
        assert.equal(result.checkpoints.pending.alive.tree, true, 'tree-liveness-oracle');
        assert.equal(result.checkpoints.pending.alive.payload, true, 'payload-liveness-oracle');
      }
      for (let i = handles.length - 1; i >= 0; i--) {
        const clock = timed ? start() : undefined;
        if (!(sample.fault === 'skip-settlement' && i === 0)) handles[i][profile.settlement]();
        if (timed) result.settlementSamples.push(stop(clock));
        const checked = checkState(tree, runtime, profile, i);
        assert.equal(digest(heldSnapshot), heldDigest, 'held-snapshot-oracle');
        result.oracles.steps.push({ ...checked, turnId: i + 1, heldSnapshotSha256: heldDigest });
      }
      if (timed) {
        const cpuMicroseconds = result.settlementSamples.reduce((sum, item) => ({ user: sum.user + item.cpuMicroseconds.user, system: sum.system + item.cpuMicroseconds.system }), { user: 0, system: 0 });
        result.stages.settlementCalls = { elapsedNs: result.settlementSamples.reduce((n, item) => n + item.elapsedNs, 0), cpuMicroseconds, cpuMs: (cpuMicroseconds.user + cpuMicroseconds.system) / 1000 };
      }
      await measuredDrain(timed, result, 'settlementDrain', notifier);
      result.oracles.settled = { ...checkState(tree, runtime, profile, 0), confirmed: runtime.getConfirmedTurnCount(), heldSnapshotSha256: digest(heldSnapshot) };
      assert.equal(result.oracles.settled.confirmed, 0, 'settled-ledger-oracle');
      assert.equal(result.oracles.settled.heldSnapshotSha256, heldDigest, 'held-snapshot-oracle');
      // Held snapshots are an explicit semantic control, released before the
      // settled heap checkpoint. No returned result owns any payload or handle.
      heldSnapshot = undefined; handles = [];
      if (heap) await checkpoint(result, 'settled', refs);
      measured(timed, result, 'destroy', () => tree.destroy());
      result.destroyed = tree.destroyed(); assert.equal(result.destroyed, true, 'destroy-oracle');
      if (heap) { await checkpoint(result, 'destroyedHeld', refs); assert.equal(result.checkpoints.destroyedHeld.alive.tree, true, 'destroyed-held-oracle'); }
    } catch (error) { failed = true; throw error; }
    finally {
      try { tree?.destroy(); }
      // eslint-disable-next-line no-unsafe-finally -- The failed flag preserves any primary throw, including falsey values; cleanup alone must still fail.
      catch (error) { if (!failed) throw error; result.cleanupError = describeError(error); }
      tree = undefined; runtime = undefined; handles = []; heldSnapshot = undefined;
    }
  }
}
