import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CATALOG } from '../src/behaviors/catalog.js';
import { BEHAVIOR_IDS } from '../src/behaviors/types.js';
import { checkDeterminism } from '../src/determinism.js';
import { generate, type GenerateResult } from '../src/generator.js';
import type { WriteOp } from '../src/model.js';
import { CASES_DIR, REPORT_JSON, writeSpecReport } from '../src/report.js';
import { loadSubject } from '../src/subjects/registry.js';
import { modelSubject } from './model-subject.js';

/** Planted defect: inside a transaction, a write of 2 or more to cfg.q is silently dropped. */
const dropsLargeQ = (w: WriteOp) => w.kind === 'setLeaf' && w.path === 'cfg.q' && w.value >= 2;

const planted = () => generate({ subjects: [modelSubject('model'), modelSubject('planted', { dropInTransaction: dropsLargeQ })], runs: 300, seed: 7 });

describe('generation', () => {
  let first: GenerateResult;

  it('detects a planted property violation and shrinks it to a minimal sequence', async () => {
    first = await planted();
    const group = first.groups.find((g) => g.behavior === 'T1' && g.subject === 'planted');
    expect(group, JSON.stringify(first.groups)).toBeDefined();
    expect(first.groups.filter((g) => g.subject === 'model' && g.behavior === 'T1')).toEqual([]);
    expect(first.stats.get('T1')?.violates).toMatchObject({ model: 0 });
    const c = first.cases.find((x) => x.id === group?.case);
    expect(c).toMatchObject({
      behaviors: ['T1'],
      sequence: {
        config: { transactions: true, restoration: false },
        steps: [{ op: { kind: 'transact', undoable: false, body: [{ kind: 'setLeaf', path: 'cfg.q', value: 2 }] }, sameTick: false }],
      },
      step: 0,
      expected: { 'cfg.q': 2 },
      provenance: { model: 'holds', planted: 'violates' },
      observed: { model: { 'cfg.q': 2 }, planted: { 'cfg.q': 0 } },
    });
  });

  it('keeps a minimal holding sequence for each behavior that held', () => {
    const held = first.cases.filter((c) => c.origin.violation === undefined);
    expect(held.map((c) => c.behaviors[0])).toContain('T1');
    for (const c of held) expect(Object.values(c.provenance)).toContain('holds');
  });

  it('is deterministic for a seed', async () => {
    const again = await planted();
    const summary = (r: GenerateResult) => [r.groups, r.cases.map((c) => [c.id, c.sequence]), [...r.stats]];
    expect(summary(again)).toEqual(summary(first));
  });

  describe('case files and report', () => {
    const dir = mkdtempSync(join(tmpdir(), 'oracle-report-'));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it('write every case in the documented shape', () => {
      writeSpecReport(dir, first);
      const files = readdirSync(join(dir, CASES_DIR));
      expect(files.length).toBe(first.cases.length);
      const ids = new Set<string>(BEHAVIOR_IDS);
      for (const file of files) {
        const c = JSON.parse(readFileSync(join(dir, CASES_DIR, file), 'utf8')) as Record<string, unknown>;
        expect(Array.isArray(c['behaviors']) && (c['behaviors'] as string[]).every((b) => ids.has(b)), file).toBe(true);
        expect((c['behaviors'] as string[]).length).toBeGreaterThan(0);
        expect(c['sequence']).toMatchObject({ config: expect.any(Object), steps: expect.any(Array) });
        expect(c['expected'], file).toBeDefined();
        expect(Object.keys(c['provenance'] as object).sort()).toEqual(['model', 'planted']);
        for (const p of Object.values(c['provenance'] as object)) expect(['holds', 'violates', 'n/a']).toContain(p);
        expect(file).toBe(`${c['id'] as string}.json`);
      }
    });

    it('write a report with every behavior and per-subject counts', () => {
      const report = JSON.parse(readFileSync(join(dir, REPORT_JSON), 'utf8')) as {
        runs: number;
        seed: number;
        subjects: { name: string }[];
        behaviors: Record<string, { generatable: boolean; reason?: string; exercised: number; holds: object; violates: object }>;
        violations: { case: string }[];
      };
      expect(report).toMatchObject({ runs: 300, seed: 7, subjects: [{ name: 'model' }, { name: 'planted' }] });
      expect(Object.keys(report.behaviors)).toEqual([...BEHAVIOR_IDS]);
      for (const [id, b] of Object.entries(report.behaviors)) {
        expect(Object.keys(b.holds).sort(), id).toEqual(['model', 'planted']);
        expect(Object.keys(b.violates).sort(), id).toEqual(['model', 'planted']);
        expect(typeof b.exercised).toBe('number');
        if (!b.generatable) expect(b.reason, id).toBeTruthy();
      }
      expect(report.behaviors['T1']?.violates).toMatchObject({ model: 0 });
      for (const v of report.violations) expect(readdirSync(join(dir, CASES_DIR))).toContain(`${v.case}.json`);
    });
  });
});

describe('the determinism check', () => {
  it('passes a deterministic subject', async () => {
    const result = await checkDeterminism({ subject: modelSubject('model'), runs: 200, seed: 11 });
    expect(result.mismatches).toBe(0);
  });

  it('fails a planted nondeterministic subject', async () => {
    const result = await checkDeterminism({ subject: modelSubject('flaky', { nondeterministic: true }), runs: 200, seed: 11 });
    expect(result.mismatches).toBeGreaterThan(0);
    expect(result.first?.record).toBeGreaterThanOrEqual(0);
  });

  it('passes the published v16 kernel', async () => {
    const result = await checkDeterminism({ subject: await loadSubject('v16'), runs: 100, seed: 3 });
    expect(result.mismatches).toBe(0);
  });
});

describe('the published kernels', () => {
  it('generate cases for every generatable behavior without a generator error', async () => {
    const result = await generate({ subjects: [await loadSubject('v15'), await loadSubject('v16')], runs: 200, seed: 5, shrinkBudget: 60 });
    const generatable = CATALOG.filter((e) => e.generatable).map((e) => e.id);
    expect([...result.stats.keys()]).toEqual(generatable);
    for (const c of result.cases) expect(['v15', 'v16']).toContain(c.origin.minimizedOn);
  });
});
