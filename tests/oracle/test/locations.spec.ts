// T4's locations are leaves, row fields and row existence (BRIEF.md T4, T5).
// Planted kernels that get the field/existence distinction wrong must be
// caught; the correct model must hold.
import { describe, expect, it } from 'vitest';
import { judge } from '../src/generator.js';
import type { Op, Row, Sequence, Step, WriteOp } from '../src/model.js';
import { MODEL_KINDS, modelSubject } from './model-subject.js';

const step = (op: Op, sameTick = false): Step => ({ op, sameTick });
const write = (w: WriteOp, wrap: 'none' | 'external' = 'none', sameTick = false): Step =>
  step({ kind: 'write', write: w, wrap }, sameTick);
const transact = (...body: WriteOp[]): Step => step({ kind: 'transact', undoable: false, body });
const rollback = step({ kind: 'rollback', tx: 0 });
const sequence = (...steps: Step[]): Sequence => ({ config: { transactions: true, restoration: false }, steps });
const row = (n: number, m = 0): Row => ({ id: 'r1', n, m });
const add: WriteOp = { kind: 'addOne', row: row(0) };
const field = (f: 'n' | 'm', value: number): WriteOp => ({ kind: 'updateOne', id: 'r1', field: f, value });

const kinds = [...MODEL_KINDS, 'setAll' as const];
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
