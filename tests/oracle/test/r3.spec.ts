import { describe, expect, it } from 'vitest';
import { judge } from '../src/generator.js';
import type { LeafPath, Row, Sequence, Step } from '../src/model.js';
import { MODEL_KINDS, modelSubject } from './model-subject.js';

const step = (op: Step['op']): Step => ({ op, sameTick: false });
const set = (path: LeafPath, value: number) => ({ kind: 'setLeaf', path, value }) as const;
const write = (path: LeafPath, value: number, wrap: 'none' | 'undoable' = 'none'): Step =>
  step({ kind: 'write', wrap, write: set(path, value) });
const sequence = (...steps: Step[]): Sequence => ({ config: { transactions: true, restoration: true }, steps });

const correct = modelSubject('correct', { restoration: true });

describe('R3 (a): undo after a confirmed transaction', () => {
  const twoWrites = step({ kind: 'transact', undoable: true, body: [set('a', 1), set('cfg.p', 2)] });

  it('expects one undo to reverse every write of the transaction', async () => {
    const planted = modelSubject('partial', { restoration: true, undoPartial: true });
    const { provenance, verdicts } = await judge(
      [correct, planted],
      'R3',
      sequence(twoWrites, step({ kind: 'confirm', tx: 0 }), step({ kind: 'undo' }))
    );
    expect(provenance).toEqual({ correct: 'holds', partial: 'violates' });
    const expected = { status: 'ok', state: { a: 0, 'cfg.p': 0 } };
    expect(verdicts['correct']?.expected).toEqual(expected);
    expect(verdicts['partial']).toMatchObject({
      kind: 'a-undo-not-exact',
      step: 2,
      expected,
      observed: { status: 'ok', state: { a: 0, 'cfg.p': 2 } },
    });
  });

  it('expects undo to refuse whole when a newer write would be overwritten', async () => {
    const planted = modelSubject('overwrites', { restoration: true, undoOverwrites: true });
    const { provenance, verdicts } = await judge(
      [correct, planted],
      'R3',
      sequence(twoWrites, step({ kind: 'confirm', tx: 0 }), write('cfg.p', 3), step({ kind: 'undo' }))
    );
    expect(provenance).toEqual({ correct: 'holds', overwrites: 'violates' });
    expect(verdicts['overwrites']).toMatchObject({
      kind: 'a-undo-over-newer-write',
      step: 3,
      expected: { status: 'refused', state: { a: 1, cfg: { p: 3, q: 0 } } },
      observed: { status: 'ok', state: { a: 0, cfg: { p: 0, q: 0 } } },
    });
  });
});

describe('R3 (b): an undo entry whose transaction was rolled back', () => {
  it('expects undo to remove it from history', async () => {
    const planted = modelSubject('keeps', { restoration: true, keepRolledBack: true });
    const { provenance, verdicts } = await judge(
      [correct, planted],
      'R3',
      sequence(
        step({ kind: 'transact', undoable: true, body: [set('a', 1)] }),
        step({ kind: 'rollback', tx: 0 }),
        step({ kind: 'undo' })
      )
    );
    expect(provenance).toEqual({ correct: 'holds', keeps: 'violates' });
    expect(verdicts['keeps']).toMatchObject({
      kind: 'b-rolled-back-entry-kept',
      expected: { historyLength: 'at most 0' },
      observed: { historyLength: 1 },
    });
  });

});

describe('R3 (c): redo after undo', () => {
  it('expects redo to re-apply exactly what undo reversed', async () => {
    const { provenance, verdicts } = await judge(
      [correct],
      'R3',
      sequence(write('a', 2, 'undoable'), step({ kind: 'undo' }), step({ kind: 'redo' }))
    );
    expect(provenance).toEqual({ correct: 'holds' });
    expect(verdicts['correct']?.expected).toEqual({ status: 'ok', state: { a: 2 }, changesOutside: [] });
  });

  it('expects redo to refuse whole when a newer write would be overwritten', async () => {
    const planted = modelSubject('overwrites', { restoration: true, redoOverwrites: true });
    const { provenance, verdicts } = await judge(
      [correct, planted],
      'R3',
      sequence(write('a', 2, 'undoable'), step({ kind: 'undo' }), write('a', 3), step({ kind: 'redo' }))
    );
    expect(provenance).toEqual({ correct: 'holds', overwrites: 'violates' });
    expect(verdicts['overwrites']).toMatchObject({
      kind: 'c-redo-over-newer-write',
      step: 3,
      expected: { status: 'refused', state: { a: 3 } },
      observed: { status: 'ok', state: { a: 2 } },
    });
  });
});

describe('R3 (c), ruling on #26: redo refuses on any later touch of a location it would re-apply', () => {
  it('expects a refusal when newer writes left the value redo would find, and catches a value-based redo', async () => {
    const byValue = modelSubject('by-value', { restoration: true, redoByValue: true });
    const { provenance, verdicts } = await judge(
      [correct, byValue],
      'R3',
      sequence(write('a', 2, 'undoable'), step({ kind: 'undo' }), write('a', 1), write('a', 0), step({ kind: 'redo' }))
    );
    expect(provenance).toEqual({ correct: 'holds', 'by-value': 'violates' });
    expect(verdicts['by-value']).toMatchObject({
      kind: 'c-redo-over-newer-write',
      step: 4,
      expected: { status: 'refused', state: { a: 0 } },
      observed: { status: 'ok', state: { a: 2 } },
    });
  });

  it('re-applies a replaced row\'s existence, so a write to another field of it counts', async () => {
    const kinds = [...MODEL_KINDS, 'replaceOne' as const];
    const row = (n: number, m = 0): Row => ({ id: 'r1', n, m });
    const subjects = [
      modelSubject('correct', { kinds, restoration: true }),
      modelSubject('field-only', { kinds, restoration: true, rewriteIsFieldOnly: true }),
    ];
    const { provenance, verdicts } = await judge(
      subjects,
      'R3',
      sequence(
        step({ kind: 'write', wrap: 'none', write: { kind: 'addOne', row: row(0) } }),
        step({ kind: 'write', wrap: 'undoable', write: { kind: 'replaceOne', id: 'r1', row: row(1) } }),
        step({ kind: 'undo' }),
        step({ kind: 'write', wrap: 'none', write: { kind: 'updateOne', id: 'r1', field: 'm', value: 2 } }),
        step({ kind: 'redo' })
      )
    );
    expect(provenance).toEqual({ correct: 'holds', 'field-only': 'violates' });
    expect(verdicts['field-only']).toMatchObject({ kind: 'c-redo-over-newer-write', expected: { status: 'refused' } });
  });
});
