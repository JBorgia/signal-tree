import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validateIntended } from '../src/intended.js';
import type { Sequence, WriteOp } from '../src/model.js';
import { compareSubjects, runOracle } from '../src/oracle.js';
import { loadSubject } from '../src/subjects/registry.js';
import { modelSubject } from './model-subject.js';

/** Planted defect: a write of 2 or more to cfg.q is silently dropped. */
const dropsLargeQ = (w: WriteOp) => w.kind === 'setLeaf' && w.path === 'cfg.q' && w.value >= 2;

describe('the runner', () => {
  it('finds no difference between a subject and itself', async () => {
    const result = await runOracle({ a: modelSubject('model'), b: modelSubject('model'), runs: 300, seed: 7 });
    expect(result.groups).toEqual([]);
  });

  it('detects a planted difference and shrinks it to a minimal counterexample', async () => {
    const result = await runOracle({
      a: modelSubject('model'),
      b: modelSubject('planted', { ignore: dropsLargeQ }),
      runs: 300,
      seed: 7,
    });
    const group = result.groups.find((g) => g.pattern === 'setLeaf' && g.field === 'state.cfg');
    expect(group, JSON.stringify(result.groups.map((g) => g.key))).toBeDefined();
    if (!group) return;
    expect(group.count).toBeGreaterThan(0);
    const { example } = group;
    // fast-check shrank the generated sequence: the replayable path has shrink steps,
    // and the value it kept is the smallest one that still triggers the defect.
    expect(example.shrunk).toBe(true);
    expect(example.path.split(':').length).toBeGreaterThan(1);
    expect(example.sequence.steps).toEqual([
      { op: { kind: 'write', wrap: 'none', write: { kind: 'setLeaf', path: 'cfg.q', value: 2 } }, sameTick: false },
    ]);
    expect(example.divergence.primary).toMatchObject({ field: 'state.cfg', a: { p: 0, q: 2 }, b: { p: 0, q: 0 } });
  });

  it('accepts a difference listed in intended differences, and only for that pair', async () => {
    // Field-level, not pattern-level: once cfg.q differs, every later step that
    // reads cfg differs too, and comparison continues past a covered step.
    const intended = [{ subjects: ['planted', 'model'] as const, field: 'state.cfg', reason: 'test' }];
    const covered = await runOracle({
      a: modelSubject('model'),
      b: modelSubject('planted', { ignore: dropsLargeQ }),
      runs: 300,
      seed: 7,
      intended: [...intended],
    });
    expect(covered.groups).toEqual([]);
    expect(covered.coveredRuns).toBeGreaterThan(0);

    const otherPair = await runOracle({
      a: modelSubject('model'),
      b: modelSubject('other', { ignore: dropsLargeQ }),
      runs: 300,
      seed: 7,
      intended: [...intended],
    });
    expect(otherPair.groups.length).toBeGreaterThan(0);
  });

  it('reports an operation one subject lacks as unsupported', async () => {
    const result = await runOracle({
      a: modelSubject('model'),
      b: modelSubject('nobranch', { kinds: ['setLeaf', 'updateLeaf', 'addOne', 'updateOne', 'removeOne'] }),
      runs: 200,
      seed: 7,
    });
    expect(result.groups.map((g) => g.key)).toContain('setBranch | result.status | * | unsupported');
  });

  it('is deterministic for a seed', async () => {
    const run = () =>
      runOracle({ a: modelSubject('model'), b: modelSubject('planted', { ignore: dropsLargeQ }), runs: 150, seed: 99 });
    const [first, second] = [await run(), await run()];
    const summary = (r: typeof first) => r.groups.map((g) => [g.key, g.count, g.example.path]);
    expect(summary(second)).toEqual(summary(first));
  });
});

describe('intended-differences.json', () => {
  it('the checked-in file is valid', () => {
    const file = fileURLToPath(new URL('../../intended-differences.json', import.meta.url));
    expect(validateIntended(JSON.parse(readFileSync(file, 'utf8')))).toEqual([]);
  });

  it('rejects malformed entries', () => {
    expect(validateIntended({ differences: [{ subjects: ['v15', 'v16'], reason: 'no pattern or field' }] })).toEqual([
      'differences[0] must name a pattern, a field or both',
    ]);
    expect(validateIntended({ differences: [{ subjects: ['v16', 'v16'], field: 'x', reason: 'r' }] })).toEqual([
      'differences[0].subjects must name two different subjects',
    ]);
    expect(validateIntended({ differences: [{ subjects: ['a', 'b'], field: 'x', reason: '', why: 1 }] })).toEqual([
      'differences[0]: unknown key "why"',
      'differences[0].reason must be a non-empty string',
    ]);
    expect(validateIntended({ differences: {} })).toEqual(['"differences" must be an array']);
  });
});

describe('the published kernels', () => {
  it('v16.0.0-rc.1 against itself shows no difference', async () => {
    const v16 = await loadSubject('v16');
    const result = await runOracle({ a: v16, b: v16, runs: 200, seed: 3 });
    expect(result.groups).toEqual([]);
  });

  it('catches the known rollback refusal difference between 15.4.9 and 16.0.0-rc.1', async () => {
    // rollback-refusal-legibility.spec.ts at both tags: 15.4.9 refuses with
    // later-confirmed-dependency, 16.0.0-rc.1 with effect-validation-failed.
    const sequence: Sequence = {
      config: { transactions: true, restoration: false },
      steps: [
        { op: { kind: 'write', wrap: 'none', write: { kind: 'addOne', row: { id: 'r0', n: 1 } } }, sameTick: false },
        { op: { kind: 'transact', undoable: true, body: [{ kind: 'removeOne', id: 'r0' }] }, sameTick: false },
        { op: { kind: 'write', wrap: 'none', write: { kind: 'addOne', row: { id: 'r0', n: 99 } } }, sameTick: false },
        { op: { kind: 'rollback', tx: 0 }, sameTick: false },
      ],
    };
    const { comparison } = await compareSubjects(await loadSubject('v15'), await loadSubject('v16'), sequence);
    expect(comparison.uncovered).toMatchObject({
      step: 3,
      pattern: 'rollback',
      primary: { field: 'result.error.causeKind', a: 'later-confirmed-dependency', b: 'effect-validation-failed' },
    });
  });
});
