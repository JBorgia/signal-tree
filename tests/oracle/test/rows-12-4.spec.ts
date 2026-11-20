// The BRIEF.md 12.4 properties. Each planted defect breaks one clause of a
// row; the model with no defect must hold and the planted one must be caught.
import { describe, expect, it } from 'vitest';
import type { BehaviorId } from '../src/behaviors/types.js';
import { judge } from '../src/generator.js';
import type { LeafPath, Op, OpKind, Reaction, Reader, Sequence, Step, WriteOp } from '../src/model.js';
import { loadSubject } from '../src/subjects/registry.js';
import { MODEL_KINDS, modelSubject, type ModelOptions } from './model-subject.js';

const step = (op: Op, sameTick = false): Step => ({ op, sameTick });
const set = (path: LeafPath, value: number): WriteOp => ({ kind: 'setLeaf', path, value });
const write = (w: WriteOp, wrap: 'none' | 'undoable' = 'none'): Step => step({ kind: 'write', write: w, wrap });
const watch = (reader: Reader, react: Reaction = { kind: 'none' }): Step => step({ kind: 'observe', reader, react });
const leaf = (path: LeafPath): Reader => ({ kind: 'leaf', path });
const sequence = (...steps: Step[]): Sequence => ({ config: { transactions: true, restoration: true }, steps });

const kinds: readonly OpKind[] = [...MODEL_KINDS, 'observe', 'destroy', 'hydrate', 'scopeAwait', 'changeId'];
const model = (name: string, options: ModelOptions = {}) => modelSubject(name, { kinds, restoration: true, ...options });
const correct = model('correct');

/** The correct model holds and the planted one violates with `kind`; returns the planted verdict. */
async function caught(id: BehaviorId, planted: ModelOptions, seq: Sequence, kind: string) {
  const { provenance, verdicts } = await judge([correct, model('planted', planted)], id, seq);
  expect(provenance).toEqual({ correct: 'holds', planted: 'violates' });
  expect(verdicts['planted']?.kind).toBe(kind);
  return verdicts['planted'];
}

describe('O1: a reader re-runs only for a location it read', () => {
  it('catches a reader that re-runs for a write the seam skips', async () => {
    await caught('O1', { coarseReaders: true }, sequence(watch(leaf('a')), write(set('a', 0))), 'ran-for-skipped-write');
  });

  it('catches a field reader that re-runs for another row', async () => {
    const add = (id: 'r1' | 'r2'): Step => write({ kind: 'addOne', row: { id, n: 0, m: 0 } });
    const otherRow = write({ kind: 'updateOne', id: 'r2', field: 'n', value: 1 });
    const seq = sequence(add('r1'), add('r2'), watch({ kind: 'field', id: 'r1', field: 'n' }), otherRow);
    await caught('O1', { coarseReaders: true }, seq, 'ran-for-other-row');
  });
});

describe('O2: one turn, one change', () => {
  const tx = (...body: WriteOp[]): Step => step({ kind: 'transact', undoable: false, body });

  it('catches an observer that runs for each write of a transaction', async () => {
    await caught('O2', { publishEachWrite: true }, sequence(watch(leaf('a')), tx(set('a', 1), set('a', 2))), 'ran-twice-in-one-turn');
  });

  it('catches an observer that sees part of a turn', async () => {
    const v = await caught('O2', { publishEachWrite: true }, sequence(watch(leaf('a')), tx(set('a', 1), set('cfg.p', 1))), 'saw-part-of-turn');
    expect(v?.observed).toEqual({ saw: [{ a: 1, cfg: { p: 0, q: 0 }, rows: [], ids: [] }] });
  });

  it('catches history state that changes after the turn', async () => {
    // The first step gives the history state before the undoable write.
    await caught('O2', { historyLater: true }, sequence(write(set('cfg.p', 1)), write(set('a', 1), 'undoable')), 'history-changed-after-turn');
  });
});

describe('O3: every read path agrees', () => {
  it('catches a count() that lags the rows', async () => {
    await caught('O3', { staleCount: true }, sequence(write({ kind: 'addOne', row: { id: 'r1', n: 0, m: 0 } })), 'read-paths-disagree');
  });

  // BRIEF.md 4.4: a row's key is always selectId(row), here row => row.id.
  const rekeyed = sequence(write({ kind: 'addOne', row: { id: 'r1', n: 0, m: 0 } }), write({ kind: 'changeId', from: 'r1', to: 'r2' }));

  it('catches a key change that leaves the id field, so the key is not selectId(row)', async () => {
    const v = await caught('O3', { changeIdKeepsField: true }, rekeyed, 'key-not-selectId');
    expect(v).toMatchObject({ step: 1, observed: { keysNotSelected: ['r2: "r1"'] } });
  });

  it('reports the published kernels, which change the key and keep the id field', async () => {
    const { provenance, verdicts } = await judge([await loadSubject('v15'), await loadSubject('v16')], 'O3', rekeyed);
    expect(provenance).toEqual({ v15: 'violates', v16: 'violates' });
    expect(verdicts['v16']).toMatchObject({ kind: 'key-not-selectId', step: 1 });
  });
});

describe('O4: a reentrant write is its own later turn', () => {
  const writer = watch(leaf('a'), { kind: 'write', path: 'cfg.q' });

  it('catches a reentrant write that is refused', async () => {
    await caught('O4', { refuseReentrant: true }, sequence(writer, write(set('a', 1))), 'reentrant-write-refused');
  });

  it('catches a reentrant write merged into the turn being published', async () => {
    const v = await caught('O4', { reentrantInline: true }, sequence(writer, watch(leaf('a')), write(set('a', 1))), 'reentrant-write-merged');
    expect(v?.observed).toEqual({ 'cfg.q': 10 });
  });
});

describe('X3: a fault stays with its observer', () => {
  const thrower = watch(leaf('a'), { kind: 'throw' });

  it('catches an observer error thrown to the writer', async () => {
    await caught('X3', { faultToWriter: true }, sequence(thrower, write(set('a', 1))), 'fault-thrown-to-writer');
  });

  it('catches a fault that stops the observers after it', async () => {
    await caught('X3', { faultStops: true }, sequence(thrower, watch(leaf('a')), write(set('a', 1))), 'other-observer-skipped');
  });
});

describe('D1: a destroyed tree refuses every read and write', () => {
  it('catches a destroy() that leaves the tree working', async () => {
    const seq = sequence(watch(leaf('a')), write(set('a', 1)), step({ kind: 'destroy' }), write(set('a', 2)));
    await caught('D1', { destroyKeeps: true }, seq, 'operation-ran-after-destroy');
  });

  it('reports what the published kernels do after destroy()', async () => {
    const seq = sequence(write(set('a', 1)), step({ kind: 'destroy' }), write(set('a', 2)));
    const { provenance, verdicts } = await judge([await loadSubject('v15'), await loadSubject('v16')], 'D1', seq);
    expect(provenance).toEqual({ v15: 'violates', v16: 'violates' });
    expect(verdicts['v16']?.kind).toBe('operation-ran-after-destroy');
  });
});

describe('W5: turn membership does not carry across an await', () => {
  const scope = (kind: 'transact' | 'undoable'): Step =>
    step({ kind: 'scopeAwait', scope: kind, before: [set('a', 1)], after: [set('cfg.p', 2)] });

  it('catches a rollback that reverses a write made after the await', async () => {
    const seq = sequence(scope('transact'), step({ kind: 'rollback', tx: 0 }));
    const v = await caught('W5', { scopeCarries: true }, seq, 'rollback-reversed-write-after-await');
    expect(v?.expected).toEqual({ state: { 'cfg.p': 2 } });
  });

  it('catches an undo that reverses a write made after the await', async () => {
    await caught('W5', { scopeCarries: true }, sequence(scope('undoable'), step({ kind: 'undo' })), 'undo-reversed-write-after-await');
  });
});

describe('H1: hydration is one turn and yields identical values', () => {
  it('catches a hydration observers see in parts', async () => {
    const seq = sequence(write(set('a', 1)), write(set('cfg.q', 2)), step({ kind: 'hydrate' }));
    await caught('H1', { hydrateInParts: true }, seq, 'hydration-seen-partly');
  });

  it('expects a rekeyed row to keep its key, which the published kernels lose', async () => {
    const seq = sequence(
      write({ kind: 'addOne', row: { id: 'r1', n: 0, m: 0 } }),
      write({ kind: 'changeId', from: 'r1', to: 'r2' }),
      step({ kind: 'hydrate' })
    );
    const { provenance, verdicts } = await judge([await loadSubject('v15'), await loadSubject('v16')], 'H1', seq);
    expect(provenance).toEqual({ v15: 'violates', v16: 'violates' });
    expect(verdicts['v16']).toMatchObject({ kind: 'hydrated-values-differ', expected: { values: { ids: ['r2'] } } });
  });
});
