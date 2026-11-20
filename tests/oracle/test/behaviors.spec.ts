import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/behaviors/catalog.js';
import { BEHAVIOR_IDS } from '../src/behaviors/types.js';
import { judge } from '../src/generator.js';
import type { Sequence, Step } from '../src/model.js';
import { loadSubject } from '../src/subjects/registry.js';
import { modelSubject } from './model-subject.js';

const step = (op: Step['op']): Step => ({ op, sameTick: false });

describe('the behavior catalog', () => {
  const brief = readFileSync(fileURLToPath(new URL('../../../BRIEF.md', import.meta.url)), 'utf8');

  it('has one entry per 5.1 and 5.2 row, in table order, each quoting its row verbatim', () => {
    expect(CATALOG.map((e) => e.id)).toEqual([...BEHAVIOR_IDS]);
    for (const entry of CATALOG) {
      expect(brief, entry.id).toContain(`| ${entry.id} | ${entry.row} |`);
    }
  });

  it('gives a reason for every row it does not generate, and generates none of 5.2', () => {
    for (const entry of CATALOG) {
      if (!entry.generatable) expect(entry.reason.length, entry.id).toBeGreaterThan(0);
    }
    expect(CATALOG.filter((e) => e.id.startsWith('W')).every((e) => !e.generatable)).toBe(true);
  });
});

describe('expected outcomes come from the property, not the subject', () => {
  // Two overlapping transactions, then a rollback of the older one.
  const overlapping: Sequence = {
    config: { transactions: true, restoration: false },
    steps: [
      step({ kind: 'transact', undoable: false, body: [{ kind: 'setLeaf', path: 'a', value: 1 }] }),
      step({ kind: 'transact', undoable: false, body: [{ kind: 'setLeaf', path: 'a', value: 2 }] }),
      step({ kind: 'rollback', tx: 0 }),
    ],
  };

  it('T3 expects later-pending-dependency whatever cause a subject refuses with', async () => {
    const subjects = [
      modelSubject('pending', { rollbackCause: 'later-pending-dependency' }),
      modelSubject('confirmed', { rollbackCause: 'later-confirmed-dependency' }),
      modelSubject('completes', { conflicts: 'none' }),
    ];
    const { provenance, verdicts } = await judge(subjects, 'T3', overlapping);
    expect(provenance).toEqual({ pending: 'holds', confirmed: 'violates', completes: 'violates' });
    const expected = { status: 'refused', cause: 'later-pending-dependency' };
    for (const name of ['pending', 'confirmed', 'completes']) expect(verdicts[name]?.expected).toEqual(expected);
    expect(verdicts['confirmed']?.observed).toMatchObject({ status: 'refused', cause: 'later-confirmed-dependency' });
    expect(verdicts['completes']?.observed).toEqual({ status: 'ok' });
  });

  it('T1 expects the written value whether or not a subject shows it', async () => {
    const sequence: Sequence = {
      config: { transactions: true, restoration: false },
      steps: [step({ kind: 'transact', undoable: false, body: [{ kind: 'setLeaf', path: 'cfg.q', value: 2 }] })],
    };
    const subjects = [
      modelSubject('model'),
      modelSubject('planted', { dropInTransaction: (w) => w.kind === 'setLeaf' && w.path === 'cfg.q' && w.value >= 2 }),
    ];
    const { provenance, verdicts } = await judge(subjects, 'T1', sequence);
    expect(provenance).toEqual({ model: 'holds', planted: 'violates' });
    expect(verdicts['model']?.expected).toEqual({ 'cfg.q': 2 });
    expect(verdicts['planted']?.expected).toEqual({ 'cfg.q': 2 });
    expect(verdicts['planted']?.observed).toEqual({ 'cfg.q': 0 });
  });
});

describe('the published kernels', () => {
  it('reports the T3 example as a v16 violation, expecting later-pending-dependency', async () => {
    // transact(setField r0); transact(undoable(addOne r2)); transact(undoable(updateOne r2; …)); rollback(tx1)
    const sequence: Sequence = {
      config: { transactions: true, restoration: false },
      steps: [
        step({ kind: 'transact', undoable: false, body: [{ kind: 'setField', id: 'r0', field: 'n', value: 1 }] }),
        step({ kind: 'transact', undoable: true, body: [{ kind: 'addOne', row: { id: 'r2', n: 0, m: 0 } }] }),
        step({
          kind: 'transact',
          undoable: true,
          body: [
            { kind: 'updateOne', id: 'r2', field: 'n', value: 1 },
            { kind: 'setLeaf', path: 'a', value: 1 },
          ],
        }),
        step({ kind: 'rollback', tx: 1 }),
      ],
    };
    const subjects = [await loadSubject('v15'), await loadSubject('v16')];
    const { provenance, verdicts } = await judge(subjects, 'T3', sequence);
    expect(provenance).toEqual({ v15: 'holds', v16: 'violates' });
    expect(verdicts['v16']).toMatchObject({
      holds: false,
      step: 3,
      kind: 'cause-later-confirmed-dependency',
      expected: { status: 'refused', cause: 'later-pending-dependency' },
      observed: { status: 'refused', cause: 'later-confirmed-dependency' },
    });
  });
});
