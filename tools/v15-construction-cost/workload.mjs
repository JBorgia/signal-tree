import assert from 'node:assert/strict';
import { digest } from './common.mjs';

const task = () => new Promise(resolve => setImmediate(resolve));
const state = width => Object.fromEntries(Array.from({ length: width }, (_, i) => ['f' + i, i]));
const read = tree => tree.$();
const write = (carrier, leaf, value) => carrier === 'angular' ? leaf.set(value) : leaf(value);
async function drain(links = []) {
  for (let i = 0; i < 16; i++) await Promise.resolve();
  await task();
  for (const connection of links) await connection.settled();
  await task();
}
async function collect() {
  for (let i = 0; i < 6; i++) { await task(); global.gc(); }
  await task();
}

export async function runWorkload(api, sample, result) {
  const { profile: p, carrier } = sample;
  const heap = sample.kind === 'heap' || sample.kind === 'heap-control';
  assert.equal(typeof global.gc === 'function', heap, 'measurement-mode-oracle');
  result.stages = {}; result.checkpoints = {}; result.oracles = {};
  const pins = [], refs = {};
  async function checkpoint(name) {
    if (!heap) return;
    await collect();
    result.checkpoints[name] = { heapBytes: process.memoryUsage().heapUsed,
      alive: Object.fromEntries(Object.entries(refs).map(([name, reference]) => [name, reference.deref() !== undefined])) };
  }
  function timed(name, fn) {
    if (heap) return fn();
    const clock = process.hrtime.bigint(), cpu = process.cpuUsage();
    try { return fn(); } finally {
      const used = process.cpuUsage(cpu);
      result.stages[name] = { wallNs: Number(process.hrtime.bigint() - clock), userUs: used.user, systemUs: used.system };
    }
  }
  async function timedAsync(name, fn) {
    if (heap) return await fn();
    const clock = process.hrtime.bigint(), cpu = process.cpuUsage();
    try { return await fn(); } finally {
      const used = process.cpuUsage(cpu);
      result.stages[name] = { wallNs: Number(process.hrtime.bigint() - clock), userUs: used.user, systemUs: used.system };
    }
  }
  await checkpoint('moduleReady');
  await timedAsync('episodeIncludingOracles', episode);
  await checkpoint('helperReturned');
  if (heap) {
    if (sample.pin) {
      assert.deepEqual(result.checkpoints.helperReturned.alive, { tree: true, snapshot: true }, 'held-control-oracle');
      pins.length = 0;
      await checkpoint('pinReleased');
      assert.deepEqual(result.checkpoints.pinReleased.alive, { tree: false, snapshot: false }, 'release-control-oracle');
    } else assert.deepEqual(result.checkpoints.helperReturned.alive, { tree: false, snapshot: false }, 'release-oracle');
  }

  async function episode() {
    const trees = [], heldWriters = [], links = [], sent = [], initialSnapshots = [];
    let other, otherLink;
    let originalError;
    let failed = false;
    try {
      const initial = state(p.width);
      const make = () => api.signalTree({ ...initial }, p.mode === 'transactions' ? { enhancers: [api.transactions()] } : undefined);
      timed('firstFactory', () => trees.push(make()));
      timed('remainingFactories', () => {
        for (let i = 1; i < p.trees; i++) {
          if (sample.fault === 'drop-tree' && i === p.trees - 1) continue;
          trees.push(make());
        }
      });
      assert.equal(trees.length, p.trees, 'tree-count-oracle');
      refs.tree = new WeakRef(trees[0]);
      if (p.mode === 'unrelated') {
        const delivered = [];
        await timedAsync('unrelatedSetup', async () => {
          other = api.signalTree({ f0: 0 });
          otherLink = api.link(other.$.f0, { set: value => void delivered.push(value) });
          if (sample.fault !== 'drop-unrelated') write(carrier, other.$.f0, 17);
          await drain([otherLink]);
        });
        assert.deepEqual(delivered, [17], 'unrelated-delivery-oracle');
        result.oracles.unrelated = [...delivered];
      }
      await checkpoint('constructed');
      timed('firstUse', () => {
        for (const tree of trees) {
          heldWriters.push(tree.$.f0);
          initialSnapshots.push(read(tree));
        }
      });
      for (const snapshot of initialSnapshots) assert.deepEqual(snapshot, initial, 'initial-state-oracle');
      refs.snapshot = new WeakRef(initialSnapshots[0]);
      if (sample.pin) pins.push(trees[0], initialSnapshots[0]);
      await checkpoint('firstUsed');
      const expected = { ...initial };
      for (let n = 0; n < p.writes; n++) expected['f' + (n % p.width)] = 10000 + n;
      const observedWrites = trees.map(() => []);
      timed('steadyWritesAndReads', () => {
        for (let t = 0; t < trees.length; t++) {
          for (let n = 0; n < p.writes; n++) {
            const leaf = trees[t].$['f' + (n % p.width)];
            if (!(sample.fault === 'drop-write' && t === trees.length - 1 && n === p.writes - 1))
              write(carrier, leaf, 10000 + n);
            observedWrites[t].push(leaf());
          }
        }
      });
      const expectedWrites = Array.from({ length: p.writes }, (_, n) => 10000 + n);
      for (const values of observedWrites) assert.deepEqual(values, expectedWrites, 'steady-state-oracle');
      observedWrites.length = 0;
      await timedAsync('steadyDrain', () => drain());
      for (const tree of trees) assert.deepEqual(read(tree), expected, 'steady-state-oracle');
      for (const snapshot of initialSnapshots) assert.deepEqual(snapshot, initial, 'held-snapshot-oracle');
      await checkpoint('written');
      if (p.mode === 'leaf' || p.mode === 'root') {
        await timedAsync('lateAttach', async () => {
          for (const tree of trees) {
            const values = []; sent.push(values);
            links.push(api.link(p.mode === 'leaf' ? tree.$.f0 : tree.$, { set(value) {
              if (sample.fault !== 'drop-delivery') values.push(digest(value));
            } }));
          }
          await drain(links);
        });
        assert.deepEqual(sent.map(values => values.length), trees.map(() => 0), 'no-initial-delivery-oracle');
        await timedAsync('heldWriterDelivery', async () => {
          for (const held of heldWriters) write(carrier, held, 90001);
          await drain(links);
        });
        expected.f0 = 90001;
        const delivery = digest(p.mode === 'leaf' ? 90001 : expected);
        for (const values of sent) assert.deepEqual(values, [delivery], 'late-delivery-oracle');
        for (const tree of trees) assert.deepEqual(read(tree), expected, 'linked-state-oracle');
        for (const connection of links) connection.dispose();
        await timedAsync('releasedWriter', async () => {
          for (const held of heldWriters) write(carrier, held, 90002);
          await drain(links);
        });
        expected.f0 = 90002;
        for (const values of sent) assert.deepEqual(values, [delivery], 'disposed-delivery-oracle');
      }
      if (p.mode === 'transactions') {
        await timedAsync('transactionAndDrain', async () => {
          for (const [index, tree] of trees.entries()) {
            const handle = tree.transaction(() => write(carrier, tree.$.f0, 70000 + index));
            assert.equal(tree.$.f0(), 70000 + index, 'pending-write-oracle');
            if (index % 2) handle.rollback(); else handle.confirm();
          }
          await drain();
        });
        for (const [index, tree] of trees.entries())
          assert.deepEqual(read(tree), { ...expected, f0: index % 2 ? expected.f0 : 70000 + index }, 'settled-state-oracle');
      } else for (const tree of trees) assert.deepEqual(read(tree), expected, 'final-state-oracle');
      for (const snapshot of initialSnapshots) assert.deepEqual(snapshot, initial, 'final-held-snapshot-oracle');
      result.oracles.final = digest(trees.map(tree => digest(read(tree))));
      result.oracles.deliveries = digest(sent);
      result.oracles.trees = trees.length;
      await checkpoint('active');
      await timedAsync('destroyAndDrain', async () => {
        for (const connection of links) connection.dispose();
        otherLink?.dispose();
        for (const tree of trees) tree.destroy();
        other?.destroy();
        await drain(links);
      });
      assert(trees.every(tree => tree.destroyed()), 'destroy-oracle');
      await checkpoint('destroyedHeld');
    } catch (error) { failed = true; originalError = error; }
    // Do cleanup without a finally throw: preserve the first useful failure.
    for (const connection of links) {
      try { connection.dispose(); } catch (error) { if (!failed) { failed = true; originalError = error; } }
    }
    for (const tree of trees) {
      try { tree.destroy(); } catch (error) { if (!failed) { failed = true; originalError = error; } }
    }
    try { otherLink?.dispose(); } catch (error) { if (!failed) { failed = true; originalError = error; } }
    try { other?.destroy(); } catch (error) { if (!failed) { failed = true; originalError = error; } }
    otherLink = undefined; other = undefined;
    trees.length = 0; heldWriters.length = 0; links.length = 0; initialSnapshots.length = 0;
    if (failed) throw originalError;
  }
}
