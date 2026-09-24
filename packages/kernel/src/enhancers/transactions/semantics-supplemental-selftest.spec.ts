import { describe, expect, it } from 'vitest';
import {
  makeCurrent,
  makeOccupiedConflict,
} from './semantics-current-adapter';
import { UnsupportedSemantic } from './semantics-contract';
import {
  runSupplemental,
  supplementalExitCode,
  type Factories,
  type Fixture,
  type SupplementalCase,
} from './semantics-supplemental';

const factories = (scalar: Factories['scalar']): Factories => ({
  scalar,
  occupied: scalar,
});
const check: SupplementalCase = {
  id: 'instrument-control',
  scope: 'instrument only',
  async run(_f, c) {
    c.equal(1, 1, 'positive control');
  },
};

describe('native occupied-conflict fixture', () => {
  it('retains state and pending authority on refusal, then retries after removing the blocker', async () => {
    const f = await makeOccupiedConflict();
    let off: (() => void) | undefined;
    try {
      const handle = await f.prepareConflict();
      const before = structuredClone(f.candidate.readVisible());
      const confirmed = f.confirmedCount();
      const publications: unknown[] = [];
      off = f.candidate.observeVisible((value) =>
        publications.push(structuredClone(value))
      );

      expect(before).toEqual({
        x: 1,
        y: 0,
        z: 0,
        rows: [{ id: 'A', value: 2 }],
      });
      expect(f.candidate.settleReject(handle).status).toBe('refused');
      for (let i = 0; i < 6; i++) await f.flush();
      expect(f.candidate.readVisible()).toEqual(before);
      expect(f.hasPendingAuthority(handle)).toBe(true);
      expect(f.confirmedCount()).toBe(confirmed);
      expect(publications).toEqual([]);

      await f.resolveConflict();
      for (let i = 0; i < 6; i++) await f.flush();
      publications.length = 0;
      expect(f.candidate.settleReject(handle).status).toBe('settled');
      for (let i = 0; i < 6; i++) await f.flush();
      expect(f.candidate.readVisible()).toEqual({
        x: 0,
        y: 0,
        z: 0,
        rows: [{ id: 'A', value: 0 }],
      });
      expect(f.hasPendingAuthority(handle)).toBe(false);
      expect(publications.length).toBeGreaterThan(0);
    } finally {
      off?.();
      f.dispose();
    }
  });
});

describe('supplemental evidence runner integrity (not semantic conformance)', () => {
  it('cannot pass when every constructor throws, even an unsupported marker', async () => {
    const rows = await runSupplemental(
      factories(async () => {
        throw new UnsupportedSemantic('constructor missing');
      }),
      [check, { ...check, id: 'second' }]
    );
    expect(rows.map((r) => r.status)).toEqual(['error', 'error']);
    expect(supplementalExitCode(rows)).toBe(1);
    expect(supplementalExitCode([])).toBe(1);
  });
  it('retains assertion failures before unsupported evidence and disposes the fixture', async () => {
    let disposed = 0;
    const rows = await runSupplemental(
      factories(async () => {
        const f = await makeCurrent();
        return {
          ...f,
          dispose() {
            disposed++;
            f.dispose();
          },
        };
      }),
      [
        {
          ...check,
          async run(_f, c) {
            c.equal(1, 2, 'planted violation');
            throw new UnsupportedSemantic('missing terminal reader');
          },
        },
      ]
    );
    expect(rows[0].status).toBe('violated');
    expect(rows[0].assertions.map((a) => a.status)).toEqual([
      'violated',
      'unsupported',
    ]);
    expect(disposed).toBe(1);
    expect(supplementalExitCode(rows)).toBe(1);
  });
  it('reports unsupported operations separately and never as a pass', async () => {
    const rows = await runSupplemental(factories(makeCurrent), [
      {
        ...check,
        async run() {
          throw new UnsupportedSemantic('unmapped capability');
        },
      },
    ]);
    expect(rows[0].status).toBe('unsupported');
    expect(supplementalExitCode(rows)).toBe(1);
  });
  it('refusal fails a successful-settlement obligation', async () => {
    const rows = await runSupplemental(factories(makeCurrent), [
      {
        ...check,
        async run(_f, c) {
          c.requireSuccess(
            { status: 'refused', reason: 'planted' },
            'must settle'
          );
        },
      },
    ]);
    expect(rows[0].status).toBe('violated');
    expect(supplementalExitCode(rows)).toBe(1);
  });
  it('unexpected operation and cleanup errors fail execution', async () => {
    const rows = await runSupplemental(
      factories(async (): Promise<Fixture> => {
        const f = await makeCurrent();
        return {
          ...f,
          dispose() {
            f.dispose();
            throw new Error('cleanup broke');
          },
        };
      }),
      [
        {
          ...check,
          async run() {
            throw new Error('operation broke');
          },
        },
      ]
    );
    expect(rows[0].status).toBe('error');
    expect(rows[0].assertions.map((a) => a.label)).toEqual([
      'execution',
      'disposal',
    ]);
    expect(supplementalExitCode(rows)).toBe(1);
  });
  it('rejects a case that executes no assertion', async () => {
    const rows = await runSupplemental(factories(makeCurrent), [
      {
        ...check,
        async run() {
          /* deliberate empty-case control */
        },
      },
    ]);
    expect(rows[0].status).toBe('error');
    expect(supplementalExitCode(rows)).toBe(1);
  });
  it('does not silently substitute a scalar factory for missing structural capability', async () => {
    const rows = await runSupplemental(factories(makeCurrent), [
      { ...check, fixture: 'structural' },
    ]);
    expect(rows[0].status).toBe('unsupported');
    expect(supplementalExitCode(rows)).toBe(1);
  });
  it('accepts an actual positive assertion', async () => {
    const rows = await runSupplemental(factories(makeCurrent), [check]);
    expect(rows[0].status).toBe('held');
    expect(supplementalExitCode(rows)).toBe(0);
  });
});
