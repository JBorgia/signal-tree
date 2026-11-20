import { describe, expect, it } from 'vitest';
import { judge } from '../src/generator.js';
import type { LeafPath, Sequence, Step } from '../src/model.js';
import { modelSubject } from './model-subject.js';

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
