import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderingModel } from './model.mjs';

test('pure exact cannot silently remove an unnamed existing lifetime', () => {
  const model = new OrderingModel(['A', 'B', 'C']);
  const pending = model.begin();
  const before = model.keys();
  const stats = model.stats();
  const held = model.held(model.id('C'));
  assert.throws(() => model.exact([model.id('B'), model.id('A')], pending));
  assert.deepEqual(model.keys(), before);
  assert.deepEqual(model.stats(), stats);
  assert.equal(model.read(held), 'C');
});

test('replacement anchor key cannot supply the retired anchor lifetime', () => {
  const model = new OrderingModel(['A', 'B', 'C']);
  const originalA = model.held(model.id('A'));
  const originalB = model.held(model.id('B'));
  const pending = model.begin();
  model.remove(originalB.id, pending);
  model.remove(model.id('A'));
  model.remove(model.id('C'));
  const newA = model.append('A');
  assert.notEqual(newA, originalA.id);
  assert.equal(model.read(originalA), undefined);
  const before = model.keys();
  const stats = model.stats();
  assert.throws(() => model.settle(pending, false), /anchor/i);
  assert.deepEqual(model.keys(), before);
  assert.deepEqual(model.stats(), stats);
  assert.equal(model.read(originalB), undefined);
});

test('committed churn has no retired node retention without recovery obligations', () => {
  const model = new OrderingModel();
  const retired = [];
  for (let i = 0; i < 8; i++) {
    const id = model.append('same-key');
    retired.push(model.held(id));
    model.remove(id);
  }
  assert.deepEqual(model.keys(), []);
  assert.equal(model.stats().pending, 0);
  assert.equal(model.stats().recoveryRecords, 0);
  assert.equal(model.stats().nodes, 0);
  for (const held of retired) assert.equal(model.read(held), undefined);
});

test('one append or prepend has fixed counted admission work across untouched sizes', () => {
  for (const size of [64, 1024, 4096]) {
    for (const operation of ['append', 'prepend']) {
      const initial = Array.from({ length: size }, (_, i) => `seed-${i}`);
      const model = new OrderingModel(initial);
      const owner = model.begin();
      model.resetWork();
      model[operation]('selected', owner);
      const measured = { ...model.work };
      assert.equal(measured.admission, 5, `${operation}, untouched=${size}`);
      assert.equal(measured.admissionSnapshots, 0);
      // Snapshot is an output check after the admission counter was captured.
      assert.deepEqual(model.keys(), operation === 'append'
        ? [...initial, 'selected'] : ['selected', ...initial]);
    }
  }
});
