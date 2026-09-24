import { writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { signalTree } from '../../lib/signal-tree';
import { transactions } from './transactions';
import { makeCurrent } from './semantics-current-adapter';
import {
  ALL_CASES,
  ContractExecutionError,
  UnsupportedSemantic,
  runContract,
  type CaseResult,
} from './semantics-contract';

/**
 * TRANSACTION-SEMANTICS-2 run against the CURRENT implementation.
 *
 * This is candidate A of the architecture competition. It maps transact() /
 * confirm() / rollback() onto the semantic adapter; a draft/MVCC candidate
 * would map draft()/merge()/discard() onto the same contract and run the same
 * cases unmodified.
 *
 * Predictions were recorded in docs/research/transaction-semantics-2/
 * PREDICTIONS.md BEFORE this file existed and are not revised afterwards.
 * Violations found here are EVIDENCE, and are reported, not fixed.
 */

function reportResults(results: CaseResult[]): string {
  const lines = [
    '',
    'TRANSACTION-SEMANTICS-2 / candidate A — current implementation',
    '',
  ];
  for (const r of results) {
    lines.push(`  ${r.status.toUpperCase().padEnd(11)} ${r.id}`);
    const note = r.error ?? r.unsupported ?? r.violation;
    if (note) lines.push(`              ${note}`);
  }
  lines.push(
    '',
    `  cases: ${['held', 'violated', 'unsupported', 'error']
      .map(
        (status) =>
          `${results.filter((r) => r.status === status).length} ${status}`
      )
      .join(', ')}, ${results.length} total`,
    '  Held means this implemented case only; unsupported is not a pass or a law verdict.',
    ''
  );
  return lines.join('\n');
}

describe('TRANSACTION-SEMANTICS-2 — candidate A (current implementation)', () => {
  it('reports semantic evidence and fails on execution errors', async () => {
    let results: CaseResult[];
    let failure: ContractExecutionError | undefined;
    try {
      results = await runContract(makeCurrent);
    } catch (e) {
      if (!(e instanceof ContractExecutionError)) throw e;
      results = e.results;
      failure = e;
    }
    const report = reportResults(results);
    console.log(report);
    if (process.env['SEMANTICS_REPORT'])
      writeFileSync(process.env['SEMANTICS_REPORT'], report, 'utf8');
    if (failure) throw failure;
    expect(results.map((r) => r.id)).toEqual(ALL_CASES.map((c) => c.id));
    expect(results).toHaveLength(13);
  });
});

// Instrument regressions, not additional frozen research cases.
describe('current adapter and contract execution integrity', () => {
  it('fails when all 13 constructors throw, retaining each error', async () => {
    let attempts = 0;
    const failure = await runContract(async () => {
      attempts++;
      throw new Error('constructor unavailable');
    }).catch((e: unknown) => e);
    expect(attempts).toBe(13);
    expect(failure).toBeInstanceOf(ContractExecutionError);
    if (!(failure instanceof ContractExecutionError))
      throw new Error('Expected execution failure');
    expect(failure.results).toHaveLength(13);
    expect(
      failure.results.every(
        (r) =>
          r.status === 'error' && r.error?.includes('constructor unavailable')
      )
    ).toBe(true);
  });

  it('does not disguise a construction failure as unsupported', async () => {
    await expect(
      runContract(async () => {
        throw new UnsupportedSemantic('constructor cannot run');
      })
    ).rejects.toBeInstanceOf(ContractExecutionError);
  });

  it('unsupported operations never become held cases, and every fixture is disposed', async () => {
    let disposed = 0;
    const unsupported = (): never => {
      throw new UnsupportedSemantic('fixture lacks operation');
    };
    const results = await runContract(async () => {
      const fixture = await makeCurrent();
      return {
        ...fixture,
        candidate: {
          ...fixture.candidate,
          beginContribution: unsupported,
          applyAuthority: unsupported,
        },
        dispose: () => {
          disposed++;
          fixture.dispose();
        },
      };
    });
    expect(disposed).toBe(13);
    expect(results.every((r) => r.status === 'unsupported')).toBe(true);
    expect(reportResults(results)).toContain(
      '0 held, 0 violated, 13 unsupported, 0 error'
    );
  });

  it('fails if one constructor fails even when others run and dispose', async () => {
    let attempts = 0;
    let disposed = 0;
    const failure = await runContract(async () => {
      if (++attempts === 2) throw new Error('single broken constructor');
      const fixture = await makeCurrent();
      return {
        ...fixture,
        dispose: () => {
          disposed++;
          fixture.dispose();
        },
      };
    }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ContractExecutionError);
    expect(attempts).toBe(13);
    expect(disposed).toBe(12);
  });

  it('treats teardown failure as execution failure', async () => {
    await expect(
      runContract(async () => {
        const fixture = await makeCurrent();
        return {
          ...fixture,
          dispose: () => {
            fixture.dispose();
            throw new Error('teardown failed');
          },
        };
      })
    ).rejects.toBeInstanceOf(ContractExecutionError);
  });

  it('matches native settlement results on every call, including repeated rollback', async () => {
    const f = await makeCurrent();
    const control = signalTree(
      { x: 0, y: 0, z: 0 },
      { enhancers: [transactions()] }
    );
    const nativeStatus = (operation: () => void) => {
      try {
        operation();
        return 'settled';
      } catch {
        return 'refused';
      }
    };
    try {
      const h = f.candidate.beginContribution(() => f.write('x', 1));
      const native = control.transact(() => control.$.x(1));
      await f.flush();
      expect(f.candidate.settleReject(h).status).toBe(
        nativeStatus(() => native.rollback())
      );
      expect(f.candidate.settleReject(h).status).toBe(
        nativeStatus(() => native.rollback())
      );
      expect(f.candidate.settleAccept(h).status).toBe(
        nativeStatus(() => native.confirm())
      );
    } finally {
      f.dispose();
      control.destroy();
    }
  });

  it('reads only this handle pending ID and never invents terminal disposition', async () => {
    const f = await makeCurrent();
    try {
      const first = f.candidate.beginContribution(() => f.write('x', 1));
      await f.flush();
      const second = f.candidate.beginContribution(() => f.write('y', 2));
      await f.flush();
      expect(f.candidate.readSettlementState(first)).toEqual({
        disposition: 'pending',
        retainsAuthority: true,
      });
      expect(f.candidate.settleReject(first).status).toBe('settled');
      expect(() => f.candidate.readSettlementState(first)).toThrow(
        UnsupportedSemantic
      );
      expect(f.candidate.readSettlementState(second)).toEqual({
        disposition: 'pending',
        retainsAuthority: true,
      });
    } finally {
      f.dispose();
    }
  });

  it('reports missing canonical, revision and correlation semantics explicitly', async () => {
    const f = await makeCurrent();
    try {
      expect(() => f.candidate.readCanonical()).toThrow(UnsupportedSemantic);
      expect(() =>
        f.candidate.applyAuthority({
          truth: () => f.write('x', 7),
          order: { kind: 'versioned', revision: 20 },
        })
      ).toThrow(UnsupportedSemantic);
      expect(f.candidate.readVisible()['x']).toBe(0);
      const h = f.candidate.beginContribution(() => f.write('y', 1));
      expect(() =>
        f.candidate.applyAuthority({
          order: { kind: 'snapshot' },
          settlement: { kind: 'accepts', contribution: h },
        })
      ).toThrow(UnsupportedSemantic);
    } finally {
      f.dispose();
    }
  });
});
