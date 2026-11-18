import assert from 'node:assert/strict';
import { digest, phaseNames, describe } from './common.mjs';

const job = () => new Promise(resolve => setImmediate(resolve));
const row = (id, width, epoch = 0) => Object.fromEntries([['id', id], ...Array.from({ length: width - 1 }, (_, f) => ['f' + f, epoch * 1000000 + id * 100 + f])]);
const ordinary = (width, epoch = 0) => Object.fromEntries(Array.from({ length: width }, (_, f) => ['f' + f, epoch * 1000000 + f]));
const edits = p => Math.min(200, p.shape === 'entity' ? p.rows : p.width);
function expected(p, epoch = 0, edited = false) {
  if (p.shape === 'ordinary') {
    const result = ordinary(p.width, epoch);
    if (edited) for (let i = 0; i < edits(p); i++) result['f' + i] = 500000 + i;
    return result;
  }
  return Array.from({ length: p.rows }, (_, i) => {
    const value = row(epoch * p.rows + i, p.width, epoch);
    if (edited && i < edits(p)) value.f0 = 500000 + i;
    return value;
  });
}
const target = (tree, p) => p.shape === 'entity' ? tree.$.rows : tree.$.values;
const readTarget = (tree, p) => p.shape === 'entity' ? tree.$.rows.all() : tree.$.values();
// Canonical root snapshots represent an EntityMap as { all: E[] }, not E[].
// Read the actual root so native snapshot certificates are issued and retained.
const readContext = tree => tree.$();
const contextTarget = (snapshot, p) => p.shape === 'entity' ? snapshot.rows.all : snapshot.values;
const expectedContext = (p, value) => p.shape === 'entity' ? { rows: { all: value } } : { values: value };
const pending = (api, tree, p) => p.enhancer === 'transactions' || p.enhancer === 'both' ? api.transactionLifecycleReader(tree).snapshot().pending.map(value => value.id) : [];

export async function runWorkload(api, sample, result) {
  const p = sample.profile, cpu = sample.kind === 'cpu', heap = sample.kind === 'heap' || sample.kind === 'heap-control';
  assert.equal(typeof global.gc === 'function', heap, 'CPU and heap process separation');
  result.stages = cpu ? Object.fromEntries(phaseNames.map(name => [name, { calls: 0, wallNs: 0, userUs: 0, systemUs: 0 }])) : {};
  result.checkpoints = {}; result.oracles = { history: [], deliveryStages: [] };
  const refs = {}, pins = [], holdingPin = sample.control === 'pin-release';
  function timed(name, work) {
    const at = cpu ? process.hrtime.bigint() : undefined, usage = cpu ? process.cpuUsage() : undefined;
    try { return work(); } finally { if (cpu) add(name, at, usage); }
  }
  async function timedAsync(name, work) {
    const at = cpu ? process.hrtime.bigint() : undefined, usage = cpu ? process.cpuUsage() : undefined;
    try { return await work(); } finally { if (cpu) add(name, at, usage); }
  }
  function add(name, at, usage) {
    const elapsed = Number(process.hrtime.bigint() - at), consumed = process.cpuUsage(usage), phase = result.stages[name];
    phase.calls++; phase.wallNs += elapsed; phase.userUs += consumed.user; phase.systemUs += consumed.system;
  }
  async function checkpoint(name) {
    if (!heap) return;
    for (let i = 0; i < 3; i++) { await job(); global.gc(); }
    result.checkpoints[name] = { heapBytes: process.memoryUsage().heapUsed, alive: Object.fromEntries(Object.entries(refs).map(([key, ref]) => [key, ref.deref() !== undefined])) };
  }
  async function drain(connections = []) {
    for (let i = 0; i < 32; i++) await Promise.resolve();
    await job();
    for (const connection of connections) await connection.settled();
    for (let i = 0; i < 8; i++) await Promise.resolve();
  }
  await checkpoint('moduleReady');
  await episode();
  await checkpoint('helperReturned');
  if (heap) {
    result.oracles.release = result.checkpoints.helperReturned.alive;
    if (holdingPin) {
      assert.equal(result.oracles.release.tree, true, 'held-tree-oracle');
      assert.equal(result.oracles.release.snapshot, true, 'held-snapshot-oracle');
      pins.length = 0; await checkpoint('pinReleased');
      assert.deepEqual(result.checkpoints.pinReleased.alive, { tree: false, snapshot: false }, 'pin-release-oracle');
    }
  }
  if (cpu) for (const phase of Object.values(result.stages)) { phase.wallMs = phase.wallNs / 1e6; phase.cpuMs = (phase.userUs + phase.systemUs) / 1000; }

  async function episode() {
    let trees = [], links = [], other, otherLink, held, heldHash, otherValues = [], failed = false;
    const sinks = [];
    function make() {
      const enhancers = [];
      if (p.enhancer === 'transactions' || p.enhancer === 'both') enhancers.push(api.transactions({ history: { retain: 0 } }));
      if (p.enhancer === 'restoration' || p.enhancer === 'both') enhancers.push(api.restoration());
      return api.signalTree(p.shape === 'entity' ? { rows: api.entityMap({ selectId: value => value.id }) } : { values: ordinary(p.width, -1) }, { enhancers });
    }
    function attach() {
      for (const tree of trees) {
        const sink = { count: 0, last: undefined, hashes: [], expectedHashes: [] };
        sinks.push(sink);
        links.push(api.link(target(tree, p), { set(value) {
          sink.count++; sink.last = digest(value); sink.hashes.push(sink.last);
          // Corrupt an earlier observation only after a later correct delivery
          // exists: count and last digest remain correct, so a last-only oracle
          // cannot detect this control. No row payload is retained by the sink.
          if (sample.fault === 'corrupt-earlier-delivery' && sink.count === 2)
            sink.hashes[0] = digest({ fault: 'earlier-target-delivery' });
        } }));
      }
    }
    function checkAll(value, name) {
      const hashes = [];
      for (const tree of trees) {
        const actual = readTarget(tree, p); assert.deepEqual(actual, value, name); hashes.push(digest(actual));
      }
      return digest(hashes);
    }
    function verifyDeliveryHashes(hashes, stage, requireNew = false) {
      const records = [];
      for (const [index, sink] of sinks.entries()) {
        const from = sink.expectedHashes.length, to = sink.hashes.length;
        assert.equal(sink.count, to, 'target-delivery-count-oracle');
        if (requireNew) assert(to > from, 'target-delivery-positive-oracle');
        for (let n = from; n < to; n++) sink.expectedHashes.push(hashes[index]);
        assert.deepEqual(sink.hashes, sink.expectedHashes, 'target-delivery-history-oracle');
        if (to) assert.equal(sink.last, sink.hashes.at(-1), 'target-delivery-last-oracle');
        records.push({ from, to, expectedHash: hashes[index] });
      }
      result.oracles.deliveryStages.push({ stage, records });
    }
    const verifyDelivery = (value, stage, requireNew = false) => verifyDeliveryHashes(sinks.map(() => digest(value)), stage, requireNew);
    try {
      timed('factory', () => {
        for (let i = 0; i < p.trees; i++) trees.push(make());
        if (p.link !== 'absent') other = api.signalTree({ value: 0 });
      });
      if (heap) refs.tree = new WeakRef(trees[0]);
      await timedAsync('initialAttach', async () => {
        if (other) {
          otherLink = api.link(other.$.value, { set(value) { otherValues.push(value); } });
          if (sample.fault !== 'drop-unrelated') other.$.value(17);
          await drain([otherLink]);
        }
        if (p.link === 'initial') { attach(); await drain(links); }
      });
      if (other) assert.deepEqual(otherValues, [17], 'unrelated-delivery-oracle');
      verifyDelivery(p.shape === 'entity' ? [] : ordinary(p.width, -1), 'initial-attach');
      result.oracles.unrelated = [...otherValues];
      await checkpoint('empty');
      timed('population', () => {
        for (let i = 0; i < trees.length; i++) {
          if (sample.fault === 'drop-population' && i === 0) continue;
          if (p.shape === 'entity') trees[i].$.rows.setAll(expected(p));
          else trees[i].$.values(expected(p));
        }
      });
      // Full reads would themselves promote the candidate. Count is the only
      // pre-context collection read; all field values are checked after edits.
      if (p.shape === 'entity') for (const tree of trees) assert.equal(tree.$.rows.count(), p.rows, 'population-count-oracle');
      await timedAsync('populationDrain', () => drain(links));
      verifyDelivery(expected(p), 'population', links.length > 0); await checkpoint('populated');
      timed('literalEdits', () => {
        for (const tree of trees) for (let i = 0; i < edits(p); i++) {
          if (sample.fault === 'drop-edit' && i === edits(p) - 1) continue;
          if (p.shape === 'entity') tree.$.rows.updateOne(i, { f0: 500000 + i });
          else tree.$.values['f' + i](500000 + i);
        }
      });
      await timedAsync('literalEditDrain', () => drain(links));
      verifyDelivery(expected(p, 0, true), 'literal-edits', links.length > 0); await checkpoint('literalEdited');
      held = timed('firstContext', () => trees.map(readContext));
      for (const snapshot of held) assert.deepEqual(snapshot, expectedContext(p, expected(p, 0, true)), 'first-context-oracle');
      heldHash = digest(held); result.oracles.firstContext = heldHash;
      if (heap) { refs.snapshot = new WeakRef(held[0]); if (holdingPin) pins.push(trees[0], held[0]); }
      await checkpoint('contextHeld');
      await timedAsync('lateAttach', async () => { if (p.link === 'late') { attach(); await drain(links); } });
      verifyDelivery(expected(p, 0, true), 'late-attach');
      await checkpoint('enrolled');
      let contextSum = 0;
      timed('repeatedContexts', () => {
        for (let pass = 0; pass < 8; pass++) for (const tree of trees) {
          const value = contextTarget(readContext(tree), p); contextSum += p.shape === 'entity' ? value[0].f0 : value.f0;
        }
      });
      assert.equal(contextSum, p.trees * 8 * 500000, 'repeated-context-oracle');
      result.oracles.contextSum = contextSum;
      let currentEpoch = 0, currentEdited = true;
      for (let cycle = 1; cycle <= p.history; cycle++) {
        const handles = [], previousEpoch = currentEpoch, previousEdited = currentEdited;
        const transactional = p.enhancer === 'transactions' || p.enhancer === 'both';
        const deliveryCounts = sinks.map(sink => sink.count);
        timed('historyMutation', () => {
          for (const tree of trees) {
            const mutate = () => p.shape === 'entity' ? tree.$.rows.setAll(expected(p, cycle)) : tree.$.values(expected(p, cycle));
            if (transactional) handles.push(tree.transact(mutate)); else mutate();
          }
        });
        assert.equal(checkAll(expected(p, cycle), 'history-populated-oracle').length, 64);
        if (transactional) {
          for (const tree of trees) assert.equal(pending(api, tree, p).length, 1, 'pending-owner-oracle');
          await drain();
          assert.deepEqual(sinks.map(sink => sink.count), deliveryCounts, 'pending-delivery-oracle');
        }
        const rollback = transactional && cycle % 2 === 0;
        timed('historySettlement', () => {
          for (let i = handles.length - 1; i >= 0; i--) {
            if (sample.fault === 'skip-settlement' && cycle === 1 && i === 0) continue;
            if (rollback) handles[i].rollback(); else handles[i].confirm();
          }
        });
        for (const tree of trees) assert.deepEqual(pending(api, tree, p), [], 'settled-pending-oracle');
        await timedAsync('historyDrain', () => drain(links));
        currentEpoch = rollback ? previousEpoch : cycle; currentEdited = rollback ? previousEdited : false;
        const want = expected(p, currentEpoch, currentEdited), hash = checkAll(want, 'history-settled-oracle');
        verifyDelivery(want, `history-${cycle}`, !rollback && links.length > 0);
        assert.equal(digest(held), heldHash, 'held-snapshot-oracle');
        result.oracles.history.push({ cycle, rollback, state: hash, pending: 0, held: heldHash });
      }
      if (p.enhancer === 'restoration' || p.enhancer === 'both') {
        const before = trees.map(tree => digest(readTarget(tree, p)));
        await timedAsync('restoreRoundtrip', async () => {
          for (const tree of trees) {
            api.undoable(() => {
              if (p.shape === 'entity') tree.$.rows.updateOne(currentEpoch * p.rows, { f1: 99000001 }); else tree.$.values.f1(99000001);
            });
          }
          await drain(links);
          const after = trees.map(tree => digest(readTarget(tree, p)));
          verifyDeliveryHashes(after, 'restoration-edit', links.length > 0);
          for (let i = 0; i < trees.length; i++) assert.notEqual(after[i], before[i], 'restoration-useful-edit-oracle');
          for (const tree of trees) { assert.equal(tree.canUndo(), true, 'restoration-available-oracle'); tree.undo(); }
          await drain(links);
          assert.deepEqual(trees.map(tree => digest(readTarget(tree, p))), before, 'restoration-undo-oracle');
          verifyDeliveryHashes(before, 'restoration-undo', links.length > 0);
          for (const tree of trees) tree.redo();
          await drain(links);
          assert.deepEqual(trees.map(tree => digest(readTarget(tree, p))), after, 'restoration-redo-oracle');
          verifyDeliveryHashes(after, 'restoration-redo', links.length > 0);
        });
        result.oracles.restoration = true;
      }
      await checkpoint('historyHeld');
      const beforeDisposalCounts = sinks.map(sink => sink.count);
      await timedAsync('disposeAndDrain', async () => {
        for (const connection of links) connection.dispose(); otherLink?.dispose();
        links = []; otherLink = undefined; await drain();
      });
      await checkpoint('linksDisposed');
      await timedAsync('destroyAndDrain', async () => { for (const tree of trees) tree.destroy(); other?.destroy(); await drain(); });
      for (const tree of trees) assert.equal(tree.destroyed(), true, 'destroy-oracle');
      assert.deepEqual(sinks.map(sink => sink.count), beforeDisposalCounts, 'disposed-delivery-oracle');
      result.oracles.deliveries = sinks.map(sink => ({ count: sink.count, last: sink.last, hashes: [...sink.hashes] }));
      await checkpoint('destroyedHeld');
      result.oracles.destroyed = trees.length;
    } catch (error) { failed = true; throw error; }
    finally {
      try { for (const connection of links) connection.dispose(); otherLink?.dispose(); for (const tree of trees) tree.destroy(); other?.destroy(); await drain(); }
      catch (error) { result.cleanupError = describe(error); if (!failed) throw error; }
      trees = []; links = []; other = undefined; otherLink = undefined; held = undefined; sinks.length = 0; otherValues = [];
    }
  }
}
