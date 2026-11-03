import assert from 'node:assert/strict';
import { signalTree, entityMap, transactions } from '@signal-tree/kernel';
import { entityMembershipReader } from '@signal-tree/kernel/internals';
import { StructuralStore } from '@proof/packages/kernel/src/lib/physical/structural-store.ts';
import { EntityMutationFrame } from '@proof/packages/kernel/src/lib/physical/entity-mutation-frame.ts';

const mode = process.argv[2] ?? 'off';
assert.ok(['off', 'active'].includes(mode), 'capture mode must be off or active');
const sizes = (process.argv[3] ?? '100,1000,10000,30000').split(',').map(Number);
assert.ok(sizes.every((size) => Number.isSafeInteger(size) && size > 0));
const output = {
  mode,
  workload: ['addOne(new)', 'changeId(new,renamed)', 'updateOne(renamed)', 'removeOne(renamed)'],
  limits: [
    'No timing is measured or claimed.',
    'off reproduces the existing zero-scan workload; active groups the same four writes in one transaction.',
    'activeKeysSnapshot visitedKeys is its cache-miss returned length: the inspected implementation pushes once per active-list node; it is not an independent instruction counter.',
    'Frame counts measure staged mutation records and distinct subject IDs, not all internal loop iterations.',
    'Prototype hooks observe only the synchronous measured interval; seed, before/after validation, confirmation, unsubscribe, and destruction are excluded.',
    'Subscriber records delta events only; it never asks for inventory.',
  ],
  runs: [],
};
for (const size of sizes) {
  const result = { size, capture: mode, calls: [], frames: [], events: [], status: 'pending' };
  output.runs.push(result);
  let tree;
  let unsubscribe;
  let mutation = 'outside';
  let measured = false;
  const restorers = [];
  const hook = (prototype, name, replacement) => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    assert.ok(descriptor && typeof descriptor.value === 'function', `Missing method ${name}`);
    Object.defineProperty(prototype, name, { ...descriptor, value: replacement(descriptor.value) });
    restorers.push(() => Object.defineProperty(prototype, name, descriptor));
  };
  const stack = () => new Error('point-work call').stack?.split('\n').slice(2) ?? [];
  try {
    tree = signalTree({ rows: entityMap() }, mode === 'active' ? { enhancers: [transactions()] } : undefined);
    const rows = tree.$.rows;
    const seed = Array.from({ length: size }, (_, id) => ({ id: String(id), n: 0 }));
    rows.setAll(seed);
    const reader = entityMembershipReader(tree);
    assert.ok(reader, 'membership reader must be available');
    unsubscribe = reader.subscribe((event) => result.events.push(event));
    // Do not read ids() or reader.snapshot() here: that would prime keysCache
    // and change the unchanged zero-scan workload before measurement.
    assert.equal(rows.count(), size);
    assert.deepEqual(rows.byIdOrFail('0')(), seed[0]);
    assert.deepEqual(rows.byIdOrFail(String(size - 1))(), seed[size - 1]);
    assert.equal(result.events.length, 0);
    hook(StructuralStore.prototype, 'activeKeysSnapshot', (original) => function (...args) {
      if (!measured) return original.apply(this, args);
      const cacheHit = this.keysCache !== undefined;
      const record = { method: 'activeKeysSnapshot', mutation, cacheHit, stack: stack() };
      result.calls.push(record);
      const keys = original.apply(this, args);
      record.returnedLength = keys.length;
      record.visitedKeys = cacheHit ? 0 : keys.length;
      record.cachePopulatedAfter = this.keysCache !== undefined;
      return keys;
    });
    for (const name of ['lastActiveKey', 'neighborSubjectsForKey']) {
      hook(StructuralStore.prototype, name, (original) => function (...args) {
        if (measured) result.calls.push({ method: name, mutation, args, stack: stack() });
        return original.apply(this, args);
      });
    }
    hook(StructuralStore.prototype, 'snapshotActiveOrder', (original) => function (keys, subjects) {
      const before = keys.length;
      const record = measured ? { method: 'snapshotActiveOrder', mutation, stack: stack() } : undefined;
      if (record) result.calls.push(record);
      const returned = original.call(this, keys, subjects);
      if (record) record.visitedKeys = keys.length - before;
      return returned;
    });
    hook(EntityMutationFrame.prototype, 'commit', (original) => function (...args) {
      if (measured) result.frames.push({
        mutation, stagedInstructions: this.mutations.length,
        touchedSubjects: new Set(this.mutations.map((item) => item.subjectId)).size,
        kinds: this.mutations.map((item) => item.kind),
        committedObserverPresent: typeof args[0] === 'function', stack: stack(),
      });
      return original.apply(this, args);
    });
    const writes = () => {
      mutation = 'addOne'; rows.addOne({ id: 'new', n: 1 });
      mutation = 'changeId'; rows.changeId('new', 'renamed');
      mutation = 'updateOne'; rows.updateOne('renamed', { n: 2 });
      measured = false;
      assert.equal(rows.byIdOrFail('renamed').n(), 2, 'field update must do useful work');
      measured = true;
      mutation = 'removeOne'; rows.removeOne('renamed');
      mutation = 'capture-completion';
    };
    let pending;
    measured = true;
    try {
      if (mode === 'active') pending = tree.transact(writes);
      else writes();
    } finally { measured = false; mutation = 'outside'; }
    pending?.confirm();
    // Full inventory/state validation is deliberately outside measured work.
    assert.deepEqual(rows.all(), seed);
    assert.deepEqual(rows.ids(), seed.map((row) => row.id));
    assert.equal(rows.byId('new'), undefined);
    assert.equal(rows.byId('renamed'), undefined);
    const inventory = reader.snapshot();
    assert.equal(inventory.collections.length, 1);
    assert.deepEqual(inventory.collections[0].members.map((member) => member.key), seed.map((row) => row.id));
    assert.equal(result.events.length, 3);
    assert.deepEqual(result.events.map((event) => event.changes.map((change) => change.kind)), [['add'], ['rekey'], ['remove']]);
    assert.ok(result.events.every((event) => !('members' in event.collection)), 'point events must not deliver inventory');
    const snapshots = result.calls.filter((call) => call.method === 'activeKeysSnapshot');
    result.summary = {
      publicMutations: 4,
      membershipEvents: result.events.length,
      snapshotCalls: snapshots.length,
      cacheHits: snapshots.filter((call) => call.cacheHit).length,
      cacheMisses: snapshots.filter((call) => !call.cacheHit).length,
      visitedKeys: snapshots.reduce((total, call) => total + call.visitedKeys, 0),
      activeOrderWalkCalls: result.calls.filter((call) => call.method === 'snapshotActiveOrder').length,
      activeOrderVisitedKeys: result.calls.filter((call) => call.method === 'snapshotActiveOrder').reduce((total, call) => total + call.visitedKeys, 0),
      lastActiveKeyCalls: result.calls.filter((call) => call.method === 'lastActiveKey').length,
      neighborSubjectsCalls: result.calls.filter((call) => call.method === 'neighborSubjectsForKey').length,
      frameCommits: result.frames.length,
      frameInstructions: result.frames.reduce((total, frame) => total + frame.stagedInstructions, 0),
      frameTouchedSubjects: result.frames.reduce((total, frame) => total + frame.touchedSubjects, 0),
    };
    result.status = 'pass';
  } catch (error) {
    result.status = 'fail';
    result.error = error?.stack ?? String(error);
    process.exitCode = 1;
  } finally {
    measured = false;
    for (const restore of restorers.reverse()) restore();
    unsubscribe?.();
    tree?.destroy();
  }
}
console.log(JSON.stringify(output, null, 2));
