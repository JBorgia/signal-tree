import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { CATALOG } from '../src/behaviors/catalog.js';
import type { CatalogEntry } from '../src/behaviors/types.js';
import { CORE_SUBJECT, EXIT, NIGHTLY_FLOOR, PR_FLOOR, coreGate, instanceFloor } from '../src/gate.js';
import { generate } from '../src/generator.js';
import type { WriteOp } from '../src/model.js';
import { REPORT_JSON, writeSpecReport, type SpecReport } from '../src/report.js';
import { modelSubject } from './model-subject.js';

/** Planted defect: inside a transaction, a write of 2 or more to cfg.q is silently dropped. */
const dropsLargeQ = (w: WriteOp) => w.kind === 'setLeaf' && w.path === 'cfg.q' && w.value >= 2;
const only = (...ids: string[]): CatalogEntry[] => CATALOG.filter((e) => ids.includes(e.id));
const run = (subjects: Parameters<typeof generate>[0]['subjects'], catalog: CatalogEntry[], runs = 300) =>
  generate({ subjects, runs, seed: 7, catalog, shrinkBudget: 20 });

describe('the instance floor', () => {
  it('is 100 at 10,000 sequences and 1,000 at 100,000, as ruled', () => {
    expect(instanceFloor(PR_FLOOR.runs)).toBe(PR_FLOOR.instances);
    expect(instanceFloor(NIGHTLY_FLOOR.runs)).toBe(NIGHTLY_FLOOR.instances);
    expect([PR_FLOOR.instances, NIGHTLY_FLOOR.instances]).toEqual([100, 1_000]);
  });

  it('keeps the ratio for other run counts, rounding up', () => {
    expect(instanceFloor(300)).toBe(3);
    expect(instanceFloor(250)).toBe(3);
    expect(instanceFloor(1)).toBe(1);
    expect(instanceFloor(0)).toBe(0);
  });
});

describe('the core gate', () => {
  it('fails on a violation by the core', async () => {
    const result = await run([modelSubject(CORE_SUBJECT, { dropInTransaction: dropsLargeQ })], only('T1'));
    const gate = coreGate(result);
    expect(gate).toMatchObject({ applied: true, belowFloor: [], exitCode: EXIT.coreViolation });
    expect(gate.violated.map((v) => v.behavior)).toEqual(['T1']);
  });

  it('fails when a generatable behavior is checked on the core fewer times than the floor', async () => {
    // The model has no held row handles, so E1 never applies to it.
    const result = await run([modelSubject(CORE_SUBJECT)], only('T1', 'E1'));
    const gate = coreGate(result);
    expect(gate).toMatchObject({ applied: true, floor: 3, violated: [], exitCode: EXIT.belowFloor });
    expect(gate.belowFloor).toEqual([{ behavior: 'E1', instances: 0 }]);
  });

  it('reports both failures with their combined code', async () => {
    const result = await run([modelSubject(CORE_SUBJECT, { dropInTransaction: dropsLargeQ })], only('T1', 'E1'));
    expect(coreGate(result).exitCode).toBe(EXIT.coreViolationAndBelowFloor);
  });

  it('passes the core while an old subject violates, and does not gate the old subject', async () => {
    const result = await run([modelSubject('v16', { dropInTransaction: dropsLargeQ }), modelSubject(CORE_SUBJECT)], only('T1'));
    expect(result.stats.get('T1')?.violates['v16']).toBeGreaterThan(0);
    expect(coreGate(result)).toMatchObject({ applied: true, violated: [], belowFloor: [], exitCode: EXIT.ok });
  });

  it('does nothing when the core is not a subject', async () => {
    const result = await run([modelSubject('v16', { dropInTransaction: dropsLargeQ })], only('T1', 'E1'));
    expect(coreGate(result)).toMatchObject({ applied: false, violated: [], belowFloor: [], exitCode: EXIT.ok });
  });

  it('keeps every exit code distinct', () => {
    expect(new Set(Object.values(EXIT)).size).toBe(Object.keys(EXIT).length);
  });
});

describe('the report', () => {
  const dir = mkdtempSync(join(tmpdir(), 'oracle-gate-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('lists instances, the floor, clauses, and clauses never reached', async () => {
    // T3 has clauses; R3 never applies to a model without undo, so its clauses are never reached.
    const result = await run([modelSubject(CORE_SUBJECT, { rollbackCause: 'later-pending-dependency' }), modelSubject('v16')], only('T3', 'R3', 'T8'));
    writeSpecReport(dir, result);
    const report = JSON.parse(readFileSync(join(dir, REPORT_JSON), 'utf8')) as SpecReport;
    const t3 = report.behaviors['T3'];
    expect(t3.instances[CORE_SUBJECT]).toBe((t3.holds[CORE_SUBJECT] ?? 0) + (t3.violates[CORE_SUBJECT] ?? 0));
    expect(t3.floor).toEqual({ required: 3, met: { core: t3.instances[CORE_SUBJECT]! >= 3, v16: t3.instances['v16']! >= 3 } });
    expect(Object.keys(t3.clauses ?? {})).toEqual(['a', 'b', 'c']);
    expect(report.behaviors['T8'].floor).toEqual({ excluded: 'not generatable' });
    expect(report.notGeneratable).toEqual(['T8']);
    expect(report.unreachedClauses.filter((u) => u.behavior === 'R3')).toEqual([
      expect.objectContaining({ clause: 'a', subjects: ['core', 'v16'] }),
      expect.objectContaining({ clause: 'b', subjects: ['core', 'v16'] }),
      expect.objectContaining({ clause: 'c', subjects: ['core', 'v16'] }),
    ]);
    expect(report.gate).toMatchObject({ subject: CORE_SUBJECT, applied: true, floor: 3 });
    expect(report.gate.belowFloor.map((b) => b.behavior)).toContain('R3');
    expect(readFileSync(join(dir, 'spec-report.md'), 'utf8')).toContain('**Clauses never reached:**');
  });
});
