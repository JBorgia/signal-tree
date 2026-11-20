// T4's locations are leaves, row fields and row existence (BRIEF.md T4, T5).
// Planted kernels that get the field/existence distinction wrong must be
// caught; the correct model must hold.
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/behaviors/analysis.js';
import { judge } from '../src/generator.js';
import { runSequence } from '../src/run.js';
import type { Op, Row, Sequence, Step, WriteOp } from '../src/model.js';
import { MODEL_KINDS, modelSubject } from './model-subject.js';

const step = (op: Op, sameTick = false): Step => ({ op, sameTick });
const write = (w: WriteOp, wrap: 'none' | 'external' | 'undoable' = 'none', sameTick = false): Step =>
  step({ kind: 'write', write: w, wrap }, sameTick);
const transact = (...body: WriteOp[]): Step => step({ kind: 'transact', undoable: false, body });
const rollback = step({ kind: 'rollback', tx: 0 });
const sequence = (...steps: Step[]): Sequence => ({ config: { transactions: true, restoration: false }, steps });
const row = (n: number, m = 0): Row => ({ id: 'r1', n, m });
const add: WriteOp = { kind: 'addOne', row: row(0) };
const field = (f: 'n' | 'm', value: number): WriteOp => ({ kind: 'updateOne', id: 'r1', field: f, value });

const kinds = [...MODEL_KINDS, 'setAll' as const, 'replaceOne' as const, 'linkOpen' as const, 'linkPush' as const];
const correct = modelSubject('correct', { kinds });

describe('T5: a write to another field of the same row is neither supersession nor dependency', () => {
  // The transaction changes r1.n; newer truth then writes r1.m.
  const otherField = sequence(write(add), transact(field('n', 1)), write(field('m', 2), 'external'), rollback);

  it('expects the rollback to succeed, restore the field it changed and keep the other', async () => {
    const rowLevel = modelSubject('row-level', { kinds, conflicts: 'row' });
    const wholeRow = modelSubject('whole-row', { kinds, restoreWholeRows: true });
    const { provenance, verdicts } = await judge([correct, rowLevel, wholeRow], 'T5', otherField);
    expect(provenance).toEqual({ correct: 'holds', 'row-level': 'violates', 'whole-row': 'violates' });
    const expected = { status: 'ok', state: { 'rows.r1.n': 0, 'rows.r1.m': 2 } };
    for (const v of Object.values(verdicts)) expect(v?.expected).toEqual(expected);
    // Refusing because another field of the row changed.
    expect(verdicts['row-level']).toMatchObject({
      kind: 'other-field-rollback-refused',
      step: 3,
      observed: { status: 'refused', cause: 'later-confirmed-dependency' },
    });
    // Restoring the whole row over the other writer's field.
    expect(verdicts['whole-row']).toMatchObject({
      kind: 'other-field-not-kept',
      step: 3,
      observed: { status: 'ok', state: { 'rows.r1.n': 0, 'rows.r1.m': 0 } },
    });
  });

  it('leaves the case to T5 alone: T4 has no dependency to expect a refusal for', async () => {
    const { provenance } = await judge([correct, modelSubject('row-level', { kinds, conflicts: 'row' })], 'T4', otherField);
    expect(provenance).toEqual({ correct: 'n/a', 'row-level': 'n/a' });
  });

  it('still expects a refusal when newer truth writes the field the transaction changed', async () => {
    const sameField = sequence(write(add), transact(field('n', 1)), write(field('n', 2), 'external'), rollback);
    const completes = modelSubject('completes', { kinds, conflicts: 'none' });
    const { provenance, verdicts } = await judge([correct, completes], 'T5', sameField);
    expect(provenance).toEqual({ correct: 'holds', completes: 'violates' });
    expect(verdicts['completes']).toMatchObject({ kind: 'dependent-rollback-completed', expected: { status: 'refused' } });
  });

  it('reads removal as supersession of the row, fields included', async () => {
    const removed = sequence(
      write(add),
      transact(field('n', 1), { kind: 'setLeaf', path: 'a', value: 1 }),
      write({ kind: 'removeOne', id: 'r1' }, 'external'),
      rollback
    );
    const { provenance, verdicts } = await judge([correct, modelSubject('row-level', { kinds, conflicts: 'row' })], 'T5', removed);
    expect(provenance).toEqual({ correct: 'holds', 'row-level': 'holds' });
    expect(verdicts['correct']?.expected).toEqual({ status: 'ok', state: { a: 0, 'rows.r1': 'absent' } });
  });
});

describe('T4: a write to a row\'s existence touches every field of the row', () => {
  const expected = { status: 'refused', cause: 'later-confirmed-dependency' };
  const fieldsOnly = modelSubject('fields-only', { kinds, conflicts: 'fields-only' });

  it.each([
    ['setAll leaving the row as it was', write({ kind: 'setAll', rows: [row(1)] })],
    ['an ordinary removal', write({ kind: 'removeOne', id: 'r1' })],
  ])('expects a refusal after %s, and catches a kernel that ignores it', async (_, later) => {
    const seq = sequence(write(add), transact(field('n', 1)), later, rollback);
    const { provenance, verdicts } = await judge([correct, fieldsOnly], 'T4', seq);
    expect(provenance).toEqual({ correct: 'holds', 'fields-only': 'violates' });
    expect(verdicts['correct']?.expected).toEqual(expected);
    expect(verdicts['fields-only']).toMatchObject({ kind: 'rollback-completed', step: 3, expected, observed: { status: 'ok' } });
  });
});

describe('T4: every touching write counts', () => {
  const completes = modelSubject('completes', { kinds, conflicts: 'none' });
  const setA = (value: number): WriteOp => ({ kind: 'setLeaf', path: 'a', value });

  it.each([
    ['an unread overwrite', sequence(transact(setA(1)), write(setA(2)), rollback)],
    ['a re-insert of a removed key', sequence(write(add), transact({ kind: 'removeOne', id: 'r1' }), write(add), rollback)],
    ['a write in the rollback call\'s own turn', sequence(transact(setA(1)), write(setA(2), 'none', true), rollback)],
    [
      'a confirmed newer transaction that wrote the same row object',
      sequence(write(add), transact(field('n', 1)), transact({ kind: 'setAll', rows: [row(1)] }), step({ kind: 'confirm', tx: 1 }), rollback),
    ],
  ])('expects a refusal after %s', async (_, seq) => {
    const { provenance, verdicts } = await judge([correct, completes], 'T4', seq);
    expect(provenance).toEqual({ correct: 'holds', completes: 'violates' });
    expect(verdicts['completes']?.expected).toEqual({ status: 'refused', cause: 'later-confirmed-dependency' });
  });

  it('does not count a write the seam skips: the same number written again', async () => {
    const { provenance } = await judge([correct, completes], 'T4', sequence(transact(setA(1)), write(setA(1)), rollback));
    expect(provenance).toEqual({ correct: 'n/a', completes: 'n/a' });
  });
});

// Rulings on #26.
const refused = { status: 'refused', cause: 'later-confirmed-dependency' };

describe('ruling 1: T4 excepts a removal T5 classifies as supersession', () => {
  it('does not expect a refusal when newer truth removed the row', async () => {
    const refuses = modelSubject('refuses', { kinds, rollbackCause: 'later-confirmed-dependency' });
    const seq = sequence(write(add), transact(field('n', 1)), write({ kind: 'removeOne', id: 'r1' }, 'external'), rollback);
    expect((await judge([correct, refuses], 'T4', seq)).provenance).toEqual({ correct: 'n/a', refuses: 'n/a' });
    expect((await judge([correct, refuses], 'T5', seq)).provenance).toEqual({ correct: 'holds', refuses: 'violates' });
  });

  // Mixed: the removal is supersession, and every other later write is judged under T4 as usual.
  const masks = modelSubject('masks', { kinds, supersessionMasks: true });
  it.each([
    [
      'a dependency on the row before newer truth removed it',
      sequence(write(add), transact(field('n', 1)), write(field('n', 2)), write({ kind: 'removeOne', id: 'r1' }, 'external'), rollback),
    ],
    [
      'a write under the key after newer truth removed the row',
      sequence(write(add), transact(field('n', 1)), write({ kind: 'removeOne', id: 'r1' }, 'external'), write(add), rollback),
    ],
  ])('still expects a refusal for %s, and catches a kernel that lets the removal excuse it', async (_, seq) => {
    const { provenance, verdicts } = await judge([correct, masks], 'T4', seq);
    expect(provenance).toEqual({ correct: 'holds', masks: 'violates' });
    expect(verdicts['masks']).toMatchObject({ kind: 'rollback-completed', expected: refused, observed: { status: 'ok' } });
  });
});

describe('ruling 2: a replace, or a setAll that keeps the key, changes the row\'s existence', () => {
  const fieldOnly = modelSubject('field-only', { kinds, rewriteIsFieldOnly: true, restoration: true });
  const restoring = modelSubject('correct', { kinds, restoration: true });
  const rewrites: [string, WriteOp][] = [
    ['replaceOne', { kind: 'replaceOne', id: 'r1', row: row(1) }],
    ['setAll keeping the key', { kind: 'setAll', rows: [row(1)] }],
  ];

  it.each(rewrites)('T4: a later write to another field depends on a transaction that ran %s', async (_, rewrite) => {
    const seq = sequence(write(add), transact(rewrite), write(field('m', 2)), rollback);
    const { provenance, verdicts } = await judge([correct, fieldOnly], 'T4', seq);
    expect(provenance).toEqual({ correct: 'holds', 'field-only': 'violates' });
    expect(verdicts['field-only']).toMatchObject({ kind: 'rollback-completed', expected: refused });
  });

  it.each(rewrites)('T3: a newer pending transaction writing another field overlaps one that ran %s', async (_, rewrite) => {
    const seq = sequence(write(add), transact(rewrite), transact(field('m', 2)), rollback);
    const { provenance, verdicts } = await judge([correct, fieldOnly], 'T3', seq);
    expect(provenance).toEqual({ correct: 'holds', 'field-only': 'violates' });
    expect(verdicts['field-only']).toMatchObject({
      expected: { status: 'refused', cause: 'later-pending-dependency' },
      observed: { status: 'ok' },
    });
  });

  it.each(rewrites)('R2: undo of an undoable %s refuses after a write to another field', async (_, rewrite) => {
    const seq: Sequence = {
      config: { transactions: false, restoration: true },
      steps: [write(add), write(rewrite, 'undoable'), write(field('m', 2)), step({ kind: 'undo' })],
    };
    const { provenance, verdicts } = await judge([restoring, fieldOnly], 'R2', seq);
    expect(provenance).toEqual({ correct: 'holds', 'field-only': 'violates' });
    expect(verdicts['field-only']).toMatchObject({ kind: 'overwrote-newer-write', expected: { status: 'refused' } });
  });
});

describe('ruling 3: an inbound link value is newer truth (another writer context)', () => {
  const linkRows = step({ kind: 'linkOpen', source: 'rows', mode: 'sync' });
  // payloadFor('rows', 0) is [{ id: 'r0', n: 0, m: 0 }]: the rows link replaces the collection without r1.
  const push = (value: number) => step({ kind: 'linkPush', link: 0, value });

  it('reads a link value that removed the row as supersession, and catches a kernel that treats it as a dependency', async () => {
    const ordinary = modelSubject('ordinary', { kinds, linkIsOrdinary: true });
    const seq = sequence(write(add), linkRows, transact(field('n', 1), { kind: 'setLeaf', path: 'a', value: 1 }), push(0), rollback);
    const t5 = await judge([correct, ordinary], 'T5', seq);
    expect(t5.provenance).toEqual({ correct: 'holds', ordinary: 'violates' });
    expect(t5.verdicts['correct']?.expected).toEqual({ status: 'ok', state: { a: 0, 'rows.r1': 'absent' } });
    expect(t5.verdicts['ordinary']).toMatchObject({
      kind: 'superseded-rollback-refused',
      observed: { status: 'refused', cause: 'later-confirmed-dependency' },
    });
    expect((await judge([correct, ordinary], 'T4', seq)).provenance).toEqual({ correct: 'n/a', ordinary: 'n/a' });
  });

  it('reads a link value on a changed location as a dependency', async () => {
    const completes = modelSubject('completes', { kinds, conflicts: 'none' });
    const linkA = step({ kind: 'linkOpen', source: 'a', mode: 'sync' });
    const seq = sequence(linkA, transact({ kind: 'setLeaf', path: 'a', value: 1 }), push(2), rollback);
    for (const id of ['T4', 'T5'] as const) {
      expect((await judge([correct, completes], id, seq)).provenance, id).toEqual({ correct: 'holds', completes: 'violates' });
    }
  });
});

// BRIEF.md 4.4: a row's key is always selectId(row). The touch simulation
// runs changeId and replaceOne both ways (4.4, and as the published kernels
// do), so a subject that follows 4.4 has its key changes seen, not skipped.
describe('key changes are seen under 4.4 and as the published kernels run them', () => {
  const keyKinds = [...kinds, 'changeId' as const, 'observe' as const];
  const conforming = modelSubject('conforming', { kinds: keyKinds, restoration: true });
  const asPublished = { changeIdKeepsField: true, replaceKeepsKey: true };
  const published = modelSubject('published', { kinds: keyKinds, restoration: true, ...asPublished });
  const rekey: WriteOp = { kind: 'changeId', from: 'r1', to: 'r2' };
  const replace: WriteOp = { kind: 'replaceOne', id: 'r1', row: { id: 'r3', n: 1, m: 0 } };

  it.each([
    ['changeId', rekey, ['rows.r1', 'rows.r2'], ['rows.r1', 'rows.r2']],
    ['a replace whose row has another id', replace, ['rows.r1', 'rows.r3'], ['rows.r1']],
  ])('gives %s a touch set on both', async (_, w, under44, asPublished) => {
    const seq = sequence(write(add), write(w));
    for (const [subject, want] of [[conforming, under44], [published, asPublished]] as const) {
      const records = await runSequence(subject, seq);
      const touches = analyze({ sequence: seq, records }).steps[1]?.touches;
      expect(touches && [...touches.sure].sort(), subject.name).toEqual(want);
    }
  });

  it.each([
    ['changeId', rekey],
    ['a replace whose row has another id', replace],
  ])('%s: T4, R2 and O1 judge it on a conforming subject instead of skipping it', async (_, w) => {
    const t4 = sequence(write(add), transact(field('n', 1)), write(w), rollback);
    const r2: Sequence = {
      config: { transactions: false, restoration: true },
      steps: [write(add), write(field('n', 1), 'undoable'), write(w), step({ kind: 'undo' })],
    };
    const o1 = sequence(write(add), step({ kind: 'observe', reader: { kind: 'leaf', path: 'a' }, react: { kind: 'none' } }), write(w));
    for (const [id, seq] of [['T4', t4], ['R2', r2], ['O1', o1]] as const) {
      const { provenance } = await judge([conforming, published], id, seq);
      expect(provenance, id).toEqual({ conforming: 'holds', published: 'holds' });
    }
  });
});
