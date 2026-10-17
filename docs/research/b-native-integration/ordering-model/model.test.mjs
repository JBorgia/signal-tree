import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderingModel } from './model.mjs';
const exact = (model, keys, owner) => model.exact(keys.map((key) => model.id(key)), owner);

test('pending exact hides earlier pending authority; rejection reveals it', () => {
  const m = new OrderingModel(['A', 'B', 'C']);
  const p = m.begin(); exact(m, ['C', 'A', 'B'], p);
  const q = m.begin(); exact(m, ['B', 'C', 'A'], q);
  m.settle(q, false); assert.deepEqual(m.keys(), ['C', 'A', 'B']);
  m.settle(p, false); assert.deepEqual(m.keys(), ['A', 'B', 'C']);
  assert.equal(m.stats().recoveryRecords, 0);
});
for (const acceptOlder of [false, true]) test(`newer confirmed exact retires old authority before older ${acceptOlder ? 'confirmation' : 'rejection'}`, () => {
  const m = new OrderingModel(['A', 'B', 'C']);
  const p = m.begin(); exact(m, ['C', 'A', 'B'], p);
  const q = m.begin(); exact(m, ['B', 'C', 'A'], q);
  m.settle(q, true);
  assert.equal(m.pending.has(p), true);
  assert.equal(m.dependencies().some((d) => d.owner === p), false);
  m.settle(p, acceptOlder); assert.deepEqual(m.keys(), ['B', 'C', 'A']);
});
for (const placement of ['front', 'append']) test(`committed ${placement} does not adopt observed order`, () => {
  const m = new OrderingModel(['A', 'B', 'C']);
  const p = m.begin(); exact(m, ['C', 'A', 'B'], p);
  if (placement === 'front') m.front(m.id('B')); else m.append('D');
  m.settle(p, false);
  assert.deepEqual(m.keys(), placement === 'front' ? ['B', 'A', 'C'] : ['A', 'B', 'C', 'D']);
});
test('confirmed newer same-member exact retires old dependency owner but still requires creator', () => {
  const m = new OrderingModel(['A', 'B']); const creator = m.begin(); const c = m.append('C', creator);
  const p = m.begin(); exact(m, ['C', 'A', 'B'], p);
  const q = m.begin(); exact(m, ['B', 'C', 'A'], q);
  m.settle(q, true);
  assert.equal(m.dependencies().some((d) => d.owner === p), false);
  assert.equal(m.dependencies().some((d) => d.id === c && d.owner === undefined), true);
  const before = m.stats();
  assert.throws(() => m.settle(creator, false), /semantic existence/);
  assert.deepEqual(m.stats(), before); assert.deepEqual(m.keys(), ['B', 'C', 'A']);
  m.settle(p, false); m.settle(creator, true);
  assert.equal(m.stats().recoveryRecords, 0);
});
test('dependency rejection permits useful creator rejection and stable held lifetime cleanup', () => {
  const m = new OrderingModel(['A', 'B']); const creator = m.begin(); const c = m.append('C', creator); const held = m.held(c);
  const p = m.begin(); exact(m, ['C', 'A', 'B'], p);
  assert.throws(() => m.settle(creator, false));
  m.settle(p, false); m.settle(creator, false);
  assert.deepEqual(m.keys(), ['A', 'B']); assert.equal(m.read(held), undefined);
  const replacement = m.append('C'); assert.notEqual(replacement, c); assert.equal(m.read(held), undefined);
  assert.equal(m.stats().recoveryRecords, 0); assert.equal(m.stats().nodes, 3);
});
test('supplementary stale-order analogue with modeled key and membership facts', () => {
  const m = new OrderingModel(['A', 'B', 'C']); const c = m.id('C'); const held = m.held(c);
  const key = m.begin(); m.rekey(c, 'C2', key);
  const p = m.begin(); exact(m, ['C2', 'A', 'B'], p); m.settle(p, true);
  m.replace([m.id('B'), m.id('A')]); assert.equal(m.read(held), undefined);
  m.settle(key, false); assert.deepEqual(m.keys(), ['B', 'A']);
  assert.equal(m.read(held), undefined); assert.equal(m.stats().recoveryRecords, 0);
});
test('superseded inverse recovery never becomes published authority', () => {
  const m = new OrderingModel(['A', 'B', 'C']); const p = m.begin(); exact(m, ['C', 'A', 'B'], p);
  exact(m, ['B', 'C', 'A']); assert.equal(m.stats().recoveryOnly, 1);
  assert.equal(m.dependencies().some((d) => d.owner === p), false);
  m.settle(p, false); assert.deepEqual(m.keys(), ['B', 'C', 'A']);
});
test('local inverse chain restores rows while removing created anchors', () => {
  const m = new OrderingModel(['z', 'a', 'b', 'c']); const p = m.begin();
  m.append('x', p); m.append('y', p); m.remove(m.id('b'), p); m.remove(m.id('c'), p);
  m.settle(p, false); assert.deepEqual(m.keys(), ['z', 'a', 'b', 'c']);
});
test('conservative moved-anchor policy refuses atomically and compatible placement permits retry', () => {
  const m = new OrderingModel(['A', 'B', 'C']); const p = m.begin(); m.remove(m.id('B'), p); m.front(m.id('C'));
  const before = m.stats(); assert.throws(() => m.settle(p, false), /Contradictory/);
  assert.deepEqual(m.keys(), ['C', 'A']); assert.deepEqual(m.stats(), before);
  m.front(m.id('A')); m.settle(p, false); assert.deepEqual(m.keys(), ['A', 'B', 'C']);
});
test('injected preparation failure preserves state and useful retry', () => {
  const m = new OrderingModel(['A', 'B', 'C']); const p = m.begin(); exact(m, ['C', 'A', 'B'], p);
  const before = m.stats(); const dependencies = m.dependencies(); m.failPreparation();
  assert.throws(() => m.settle(p, false), /Injected/);
  assert.deepEqual(m.stats(), before); assert.deepEqual(m.dependencies(), dependencies); assert.deepEqual(m.keys(), ['C', 'A', 'B']);
  m.settle(p, false); assert.deepEqual(m.keys(), ['A', 'B', 'C']);
});
test('pure exact cannot silently remove an omitted lifetime', () => {
  const m = new OrderingModel(['A', 'B', 'C']);
  assert.throws(() => exact(m, ['B', 'A']), /complete/);
  assert.deepEqual(m.keys(), ['A', 'B', 'C']);
});
test('point admission counts and full replay settlement counts are reported separately', (t) => {
  const measurements = [];
  for (const operation of ['append', 'prepend', 'front']) for (const size of [64, 128, 256]) for (const accept of [false, true]) {
    const m = new OrderingModel(['A']); const a = m.id('A'); const p = m.begin(); m.resetWork();
    for (let i = 0; i < size; i++) {
      if (operation === 'front') m.front(a, p); else m[operation](`x${i}`, p);
    }
    const admission = m.work.admission;
    assert.equal(m.work.admissionSnapshots, 0);
    assert.equal(admission, size * (operation === 'front' ? 8 : 5));
    const retainedBefore = m.stats().recoveryRecords;
    m.settle(p, accept); assert.equal(m.stats().recoveryRecords, 0);
    const settlement = m.work.settlement;
    assert.equal(m.keys().length, accept && operation !== 'front' ? size + 1 : 1);
    measurements.push({ operation, size, terminal: accept ? 'confirm' : 'reject', admission, settlement, replayedEvents: m.work.replayedEvents, retainedBefore });
  }
  t.diagnostic(JSON.stringify({ measurements, limitation: 'Settlement clones state and replays retained journal; counts are modeled visits, not engine instructions, time, or bytes.' }));
});
