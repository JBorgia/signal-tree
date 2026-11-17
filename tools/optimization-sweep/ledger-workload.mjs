import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inspect } from 'node:util';

export const describeError = error => error instanceof Error ? error.stack ?? error.message : inspect(error);
const job = () => new Promise(resolve => setImmediate(resolve));
export async function drain(notifier) {
  for (let i = 0; i < 4; i++) await Promise.resolve();
  await job();
  assert.equal(notifier.hasPending(), false, 'drain-oracle');
}
const sequence = (start, count) => Array.from({ length: count }, (_, i) => start + i);
const retained = (ids, H) => H > 0 ? ids.slice(-H) : [];
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const start = () => ({ cpu: process.cpuUsage(), at: process.hrtime.bigint() });
const stop = clock => {
  const elapsedNs = Number(process.hrtime.bigint() - clock.at), cpuMicroseconds = process.cpuUsage(clock.cpu);
  return { elapsedNs, cpuMicroseconds, cpuMs: (cpuMicroseconds.user + cpuMicroseconds.system) / 1000 };
};
const sum = stages => ({
  elapsedNs: stages.reduce((n, x) => n + x.elapsedNs, 0),
  cpuMicroseconds: { user: stages.reduce((n, x) => n + x.cpuMicroseconds.user, 0), system: stages.reduce((n, x) => n + x.cpuMicroseconds.system, 0) },
  cpuMs: stages.reduce((n, x) => n + x.cpuMicroseconds.user + x.cpuMicroseconds.system, 0) / 1000,
});
const measured = (enabled, stages, name, work) => {
  const clock = enabled ? start() : undefined;
  const value = work();
  if (enabled) stages[name] = stop(clock);
  return value;
};

function checkValues(tree, { P, E, N }, settled, settlement) {
  for (let j = 0; j < E; j++) assert.deepEqual(tree.$[`w${j}`](), [N, j], 'value-oracle');
  for (let i = 0; i < P; i++) assert.equal(tree.$[`p${i}`](), settled && settlement === 'rollback' ? 0 : 1, 'pending-value-oracle');
  assert.equal(tree.$.probe(), 0, 'probe-value-oracle');
}

// This function returns primitives only; projected effect values do not cross a
// heap checkpoint. The position map holds integers, never payload/owner objects.
function checkLedger(api, tree, profile, expectedIds, positions, fault) {
  const { P, E } = profile;
  const reader = api.confirmedTurnReader(tree);
  assert.ok(reader, 'reader-oracle');
  let snapshot = reader.readConfirmedTurns();
  if (fault === 'drop-record') snapshot = { ...snapshot, turns: snapshot.turns.slice(1) };
  if (fault === 'swap-effect') snapshot = { ...snapshot, turns: snapshot.turns.map(turn => ({ ...turn,
    effects: turn.effects.map((effect, i, effects) => ({ ...effect, after: effects[(i + 1) % effects.length].after })),
  })) };
  assert.deepEqual(snapshot.turns.map(turn => turn.id), expectedIds, 'ledger-ids-oracle');
  const primitive = [];
  for (const turn of snapshot.turns) {
    const pending = turn.id <= P, count = pending ? 1 : E, step = turn.id - P;
    assert.equal(turn.effects.length, count, 'effect-count-oracle');
    const expectedPaths = pending ? [`p${turn.id - 1}`] : sequence(0, E).map(j => `w${j}`);
    assert.deepEqual(turn.effects.map(effect => effect.path).sort(), expectedPaths.slice().sort(), 'effect-path-oracle');
    const observedPositions = [];
    for (const effect of turn.effects) {
      assert.equal(effect.kind, 'set', 'effect-kind-oracle');
      assert.equal(effect.ownerPath, effect.path, 'effect-owner-oracle');
      assert.ok(Number.isSafeInteger(effect.position) && effect.position > 0, 'effect-position-oracle');
      assert.equal(effect.subjectId, undefined, 'scalar-subject-oracle');
      const index = Number(effect.path.slice(1));
      assert.deepEqual(effect.before, pending ? 0 : step === 1 ? [] : [step - 1, index], 'effect-value-oracle');
      assert.deepEqual(effect.after, pending ? 1 : [step, index], 'effect-value-oracle');
      if (positions.has(effect.path)) assert.equal(effect.position, positions.get(effect.path), 'position-stability-oracle');
      else {
        assert.ok(![...positions.values()].includes(effect.position), 'distinct-position-oracle');
        positions.set(effect.path, effect.position);
      }
      observedPositions.push(effect.position);
      primitive.push([turn.id, effect.path, effect.position, effect.before, effect.after]);
    }
    assert.deepEqual([...turn.positions].sort((a, b) => a - b), observedPositions.sort((a, b) => a - b), 'record-position-oracle');
  }
  assert.equal(snapshot.retention.firstAvailableTurnId, expectedIds[0], 'retention-first-oracle');
  // No missing records can be inferred from turn-ID gaps. Truncation is checked
  // only where the fixture has actually evicted ordinary confirmed records.
  if (expectedIds.length < profile.N && profile.P === 0) assert.equal(snapshot.retention.truncated, true, 'retention-truncated-oracle');
  return { ids: expectedIds, effects: primitive.length, digest: digest(primitive), retention: snapshot.retention };
}

function populateStep(tree, notifier, step, sample, timed, samples, refs, pins) {
  const payloads = sequence(0, sample.profile.E).map(j => [step, j]);
  const clock = timed ? start() : undefined;
  for (let j = 0; j < sample.profile.E; j++) {
    if (!(sample.fault === 'drop-write' && step === 2 && j === 0)) tree.$[`w${j}`](payloads[j]);
  }
  notifier.flushSync();
  if (timed) samples.push(stop(clock));
  // Every timed flush gets a useful intermediate oracle after its timer stops.
  for (let j = 0; j < sample.profile.E; j++) assert.deepEqual(tree.$[`w${j}`](), [step, j], 'value-oracle');
  if (refs && step === 1) {
    refs.first = new WeakRef(tree.$.w0());
    if (pins) pins.push(tree.$.w0());
  }
  if (refs && step === sample.profile.N) refs.current = new WeakRef(tree.$.w0());
}

function verifyOwnedPayload(runtime, ref, shouldOwn) {
  const target = ref.deref();
  if (shouldOwn) assert.ok(target, 'sample-liveness-oracle');
  const found = target !== undefined && runtime.getConfirmedTurnRecords().some(turn => turn.__effects?.some(effect => effect.before === target || effect.after === target));
  assert.equal(found, shouldOwn, 'actual-ledger-owner-oracle');
}

async function checkpoint(checkpoints, name, refs) {
  assert.equal(typeof globalThis.gc, 'function', 'Explicit GC required only for memory children');
  for (let i = 0; i < 3; i++) { await job(); globalThis.gc(); }
  checkpoints[name] = { heapUsed: process.memoryUsage().heapUsed,
    alive: Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, ref.deref() !== undefined])) };
}

async function overlap(api, result) {
  const tree = api.signalTree({ x: 0 }, { enhancers: [api.transactions()] });
  let failed = false;
  try {
    const earlier = tree.transact(() => tree.$.x(1));
    const later = tree.transact(() => tree.$.x(2));
    await drain(api.getPathNotifier());
    let threw = false, failure;
    try { earlier.rollback(); } catch (error) { threw = true; failure = error; }
    assert.equal(threw, true, 'overlap-refusal-oracle');
    assert.match(describeError(failure), /later-confirmed-dependency/, 'overlap-kind-oracle');
    assert.equal(tree.$.x(), 2); assert.equal(api.peekInternalTransactionRuntime(tree).getPendingTurnCount(), 2);
    later.rollback(); assert.equal(tree.$.x(), 1);
    earlier.rollback(); assert.equal(tree.$.x(), 0);
    await drain(api.getPathNotifier());
    assert.equal(api.peekInternalTransactionRuntime(tree).getPendingTurnCount(), 0);
    result.oracles = { overlapRefused: true, rollbackValues: [2, 1, 0], pending: 0 };
  } catch (error) { failed = true; throw error; }
  finally {
    try { tree.destroy(); }
    // eslint-disable-next-line no-unsafe-finally -- The failed flag preserves any primary throw, including falsey values; cleanup alone must still fail.
    catch (error) { if (!failed) throw error; result.cleanupError = describeError(error); }
  }
}

export async function runWorkload(api, sample, result) {
  const heap = sample.kind === 'heap' || sample.kind === 'heap-control';
  const timed = sample.kind === 'cpu';
  assert.equal(typeof globalThis.gc === 'function', heap, 'CPU and memory child modes are separate');
  if (sample.kind === 'overlap-control') { await overlap(api, result); return; }
  result.stages = {}; result.operationSamples = []; result.oracles = {}; result.checkpoints = {};
  const refs = {}, pins = sample.control === 'pin-release' ? [] : undefined;
  if (heap) await checkpoint(result.checkpoints, 'moduleReady', refs);
  await retainedEpisode();
  if (heap) {
    await checkpoint(result.checkpoints, 'helperReturned', refs);
    assert.equal(result.checkpoints.helperReturned.alive.tree, false, 'tree-release-oracle');
    assert.equal(result.checkpoints.helperReturned.alive.first, pins ? true : false, 'payload-release-oracle');
    assert.equal(result.checkpoints.helperReturned.alive.current, false, 'current-payload-release-oracle');
    if (pins) {
      pins.length = 0;
      await checkpoint(result.checkpoints, 'pinReleased', refs);
      assert.equal(result.checkpoints.pinReleased.alive.first, false, 'pin-release-oracle');
    }
  }

  async function retainedEpisode() {
    const { P, H, E, N } = sample.profile, positions = new Map();
    let tree, runtime, handles = [], failed = false;
    const notifier = api.getPathNotifier();
    try {
      const state = { probe: 0 };
      for (let i = 0; i < P; i++) state[`p${i}`] = 0;
      for (let j = 0; j < E; j++) state[`w${j}`] = [];
      tree = measured(timed, result.stages, 'factory', () => api.signalTree(state, { enhancers: [api.transactions({ history: { retain: H } })] }));
      runtime = api.peekInternalTransactionRuntime(tree); assert.ok(runtime, 'runtime-oracle');
      if (heap) refs.tree = new WeakRef(tree);
      measured(timed, result.stages, 'pendingSetup', () => {
        for (let i = 0; i < P; i++) handles.push(tree.transact(() => tree.$[`p${i}`](1)));
      });
      await drain(notifier);
      assert.deepEqual(runtime.getPendingTurnIds(), sequence(1, P), 'pending-ids-oracle');
      const immediateBefore = process.memoryUsage().heapUsed;
      for (let step = 1; step <= N; step++) populateStep(tree, notifier, step, sample, timed, result.operationSamples, heap ? refs : undefined, pins);
      const immediateAfter = process.memoryUsage().heapUsed;
      if (timed) result.stages.ordinaryFlushes = sum(result.operationSamples);
      result.immediateHeapProxy = { before: immediateBefore, after: immediateAfter, delta: immediateAfter - immediateBefore,
        meaning: 'Whole V8 heapUsed around the ordinary episode including untimed intermediate checks; neither allocated bytes nor retained memory.' };
      await drain(notifier);
      checkValues(tree, sample.profile, false, sample.settlement);
      assert.equal(runtime.getPendingTurnCount(), P, 'pending-oracle');
      const ordinaryIds = sequence(P + 1, N), heldIds = P ? ordinaryIds : retained(ordinaryIds, H);
      result.oracles.held = checkLedger(api, tree, sample.profile, heldIds, positions, sample.fault);
      // A disjoint probe makes next-ID preservation observable even when H=0.
      let probe = tree.transact(() => tree.$.probe(1));
      assert.deepEqual(runtime.getPendingTurnIds(), [...sequence(1, P), P + N + 1], 'next-id-oracle');
      probe.rollback(); probe = undefined; await drain(notifier);
      assert.equal(tree.$.probe(), 0, 'probe-value-oracle');
      if (heap) {
        verifyOwnedPayload(runtime, refs.first, heldIds.includes(P + 1) || heldIds.includes(P + 2));
        await checkpoint(result.checkpoints, 'held', refs);
        assert.equal(result.checkpoints.held.alive.tree, true, 'tree-liveness-oracle');
        assert.equal(result.checkpoints.held.alive.current, true, 'current-owner-liveness-oracle');
        const firstExpected = pins !== undefined || heldIds.includes(P + 1) || heldIds.includes(P + 2);
        assert.equal(result.checkpoints.held.alive.first, firstExpected, 'ledger-payload-liveness-oracle');
      }
      const clock = timed ? start() : undefined;
      if (sample.fault !== 'skip-settlement') {
        for (let i = handles.length - 1; i >= 0; i--) {
          if (sample.settlement === 'confirm') handles[i].confirm(); else handles[i].rollback();
        }
      }
      await drain(notifier);
      if (timed) result.stages.settlementAndDrain = stop(clock);
      assert.equal(runtime.getPendingTurnCount(), 0, 'pending-oracle');
      checkValues(tree, sample.profile, true, sample.settlement);
      const confirmedIds = sample.settlement === 'confirm' ? sequence(1, P + N) : ordinaryIds;
      result.oracles.settled = checkLedger(api, tree, sample.profile, retained(confirmedIds, H), positions);
      handles = [];
      if (heap) {
        await checkpoint(result.checkpoints, 'settled', refs);
        assert.equal(result.checkpoints.settled.alive.tree, true, 'tree-liveness-oracle');
        assert.equal(result.checkpoints.settled.alive.current, true, 'current-owner-liveness-oracle');
        const ids = retained(confirmedIds, H);
        assert.equal(result.checkpoints.settled.alive.first, pins !== undefined || ids.includes(P + 1) || ids.includes(P + 2), 'settled-ledger-payload-oracle');
      }
      measured(timed, result.stages, 'destroy', () => tree.destroy());
      assert.equal(tree.destroyed(), true, 'destroy-oracle');
      if (heap) {
        await checkpoint(result.checkpoints, 'destroyedHeld', refs);
        assert.equal(result.checkpoints.destroyedHeld.alive.tree, true, 'destroyed-tree-held-oracle');
      }
    } catch (error) { failed = true; throw error; }
    finally {
      try { tree?.destroy(); }
      // eslint-disable-next-line no-unsafe-finally -- The failed flag preserves any primary throw, including falsey values; cleanup alone must still fail.
      catch (error) { if (!failed) throw error; result.cleanupError = describeError(error); }
      tree = undefined; runtime = undefined; handles = [];
    }
  }
}
