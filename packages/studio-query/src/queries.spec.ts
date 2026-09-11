/**
 * studio-query — adversarial cases.
 *
 * The governing rule: **the query layer may combine S1 and S2 evidence, but it
 * may never upgrade succession into causation** (`SUPERSESSION-0`, WEAK).
 */
import { describe, expect, it } from 'vitest';

import {
  currentObservedResponsibility,
  explainValue,
  latestRealization,
  predecessor,
  priorProducerFor,
  realizationsForPath,
  type CapturedValue,
  type EvidenceSet,
  type RealizationCoverage,
  type RealizationEvidence,
  type TransactionEvidence,
} from './index';

const val = (v: unknown): CapturedValue => ({ kind: 'value', value: v });

const coverage = (over: Partial<RealizationCoverage> = {}): RealizationCoverage => ({
  completeFromTreeStart: false,
  scopeIntegrity: 'complete',
  startedAtSequence: 0,
  truncated: false,
  ...over,
});

const tx = (turnId: number, path: string, before: unknown, after: unknown): TransactionEvidence => ({
  kind: 'transaction', treeId: 'tree-0001', turnId, disposition: 'committed',
  effects: [{ path, ownerPath: path, before, after }],
});

const rz = (sequence: number, path: string, before: unknown, after: unknown,
            over: Partial<RealizationEvidence> = {}): RealizationEvidence => ({
  kind: 'realization', treeId: 'tree-0001', sequence, path, ownerPath: path,
  before: val(before), after: val(after), origin: 'external', participation: 'realized', ...over,
});

/** THE CANONICAL CASE. T31→9600, T32→9800, R44 9800→10200. */
const canonical: EvidenceSet = {
  transactions: [tx(31, 'cart.total', 12000, 9600), tx(32, 'cart.total', 9600, 9800)],
  realizations: [rz(44, 'cart.total', 9800, 10200)],
  coverage: coverage(),
};

describe('1. the canonical case never attributes the realization to a transaction', () => {
  it('predecessor is the VALUE 9800, not an operation', () => {
    const r = canonical.realizations[0]!;
    expect(predecessor(r)).toEqual(val(9800));
  });

  it('latest realization is R44', () => {
    expect(latestRealization(canonical, 'cart.total').value?.sequence).toBe(44);
  });

  it('explanation emits FACT / DERIVED / UNKNOWN and names no cause', () => {
    const claims = explainValue(canonical, 'cart.total').value;
    const codes = claims.map((c) => c.code);

    expect(codes).toContain('TRANSACTION_COMMITTED_VALUE');
    expect(codes).toContain('REALIZATION_CHANGED_VALUE');
    expect(codes).toContain('VALUE_SUPERSEDED_PREDECESSOR');
    expect(codes).toContain('AUTHORING_CAUSE_UNKNOWN');

    const superseded = claims.find((c) => c.code === 'VALUE_SUPERSEDED_PREDECESSOR')!;
    expect(superseded.classification).toBe('derived');

    const cause = claims.find((c) => c.code === 'AUTHORING_CAUSE_UNKNOWN')!;
    expect(cause.classification).toBe('unknown');
    expect(cause.data['reason']).toBe('no-correlation-referent');

    // No claim may assert a transaction caused the realization.
    const realizationClaims = claims.filter((c) => c.code === 'REALIZATION_CHANGED_VALUE');
    for (const c of realizationClaims) {
      expect(JSON.stringify(c.data)).not.toContain('turnId');
    }
  });

  it('priorProducerFor offers candidates as DERIVED, and finds T32 not T31', () => {
    const r = canonical.realizations[0]!;
    const producers = priorProducerFor(canonical, r).value;
    expect(producers.map((t) => t.turnId)).toEqual([32]);
    expect(producers.map((t) => t.turnId)).not.toContain(31);
  });

  it('every claim carries an evidence reference or is explicitly unknown', () => {
    for (const c of explainValue(canonical, 'cart.total').value) {
      if (c.classification !== 'unknown') {
        expect(c.evidence.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('2-4. coverage limits survive every query', () => {
  it('2. capture started late is always a caveat', () => {
    expect(realizationsForPath(canonical, 'cart.total').caveats).toContain('capture-started-late');
  });

  it('3. incomplete scope prevents a strong absence claim', () => {
    const set: EvidenceSet = { ...canonical, realizations: [],
      coverage: coverage({ scopeIntegrity: 'incomplete-unscoped-evidence' }) };
    const a = latestRealization(set, 'cart.total');
    expect(a.value).toBeUndefined();
    // undefined must never read as "none happened".
    expect(a.caveats).toContain('scope-incomplete');
  });

  it('4. truncation is reported rather than walked through', () => {
    const set: EvidenceSet = { ...canonical,
      coverage: coverage({ truncated: true, firstRetainedSequence: 40 }) };
    const claims = explainValue(set, 'cart.total').value;
    const limits = claims.filter((c) => c.code === 'COVERAGE_LIMIT').map((c) => c.data['reason']);
    expect(limits).toContain('history-truncated');
  });
});

describe('5. unserializable values are preserved, not assumed', () => {
  it('predecessor returns the discriminated value untouched', () => {
    const r: RealizationEvidence = {
      ...rz(1, 'cart.fn', null, null),
      before: { kind: 'unserializable', valueType: 'function', preview: 'function f' },
    };
    expect(predecessor(r).kind).toBe('unserializable');
  });

  it('priorProducerFor makes no claim when the value cannot be compared', () => {
    const r: RealizationEvidence = {
      ...rz(1, 'cart.total', null, 1),
      before: { kind: 'unserializable', valueType: 'function', preview: 'fn' },
    };
    expect(priorProducerFor(canonical, r).value).toEqual([]);
  });
});

describe('6. entity realizations address the row, not the field', () => {
  it('a field path finds nothing when the kernel addressed the row', () => {
    const set: EvidenceSet = {
      transactions: [],
      realizations: [rz(1, 'rows.A', { name: 'Alpha' }, { name: 'Server' })],
      coverage: coverage(),
    };
    // Exact address equality only — no parent/child inference.
    expect(realizationsForPath(set, 'rows.A.name').value).toEqual([]);
    expect(realizationsForPath(set, 'rows.A').value).toHaveLength(1);
  });
});

describe('7. equal values are not collapsed', () => {
  it('two realizations with the same visible value stay distinct', () => {
    const set: EvidenceSet = {
      transactions: [],
      realizations: [rz(1, 'p', 1, 2), rz(2, 'p', 2, 2, { origin: 'restoration' })],
      coverage: coverage(),
    };
    const all = realizationsForPath(set, 'p').value;
    expect(all).toHaveLength(2);
    expect(all[1]?.origin).toBe('restoration');
  });
});

describe('8. S1 and S2 coexist without being fused', () => {
  it('both appear for one path, as separately classified claims', () => {
    const claims = explainValue(canonical, 'cart.total').value;
    const fromTx = claims.filter((c) => c.evidence.some((e) => e.startsWith('transaction:')));
    const fromRz = claims.filter((c) => c.evidence.some((e) => e.startsWith('realization:')));
    expect(fromTx.length).toBeGreaterThan(0);
    expect(fromRz.length).toBeGreaterThan(0);
    // No claim cites both sources as one causal edge.
    for (const c of claims) {
      const kinds = new Set(c.evidence.map((e) => e.split(':')[0]));
      expect(kinds.size).toBeLessThanOrEqual(1);
    }
  });
});

describe('currentObservedResponsibility checks the LIVE value', () => {
  it('claims FACT only when the latest evidence matches current', () => {
    const r = currentObservedResponsibility(canonical, 'cart.total', val(10200)).value;
    expect(r.confidence).toBe('fact');
    expect(r.source.kind).toBe('realization');
  });

  /** "Latest event we hold" must not become "current owner". */
  it('is UNKNOWN when the live value diverges from retained evidence', () => {
    const r = currentObservedResponsibility(canonical, 'cart.total', val(99999)).value;
    expect(r.source.kind).toBe('unknown');
    expect(r.confidence).toBe('derived');
  });

  it('is UNKNOWN with no retained evidence for the path', () => {
    const r = currentObservedResponsibility(canonical, 'cart.other', val(1)).value;
    expect(r.source).toMatchObject({ kind: 'unknown', reason: 'no-retained-evidence' });
  });
});

describe('transported object matches remain epistemically weak', () => {
  it('finds cloned candidates without claiming an authoring cause', () => {
    const before = { price: 10, flags: new Set(['a', 'b']) };
    const after = { price: 12 };
    const realization = rz(2, 'cart', structuredClone(before), after);
    const set: EvidenceSet = { transactions: [tx(1, 'cart', {}, before)], realizations: [realization], coverage: coverage() };
    expect(priorProducerFor(set, realization).value.map((t) => t.turnId)).toEqual([1]);
    expect(currentObservedResponsibility(set, 'cart', val(structuredClone(after))).value.source.kind).toBe('realization');
    expect(explainValue(set, 'cart').value.find((c) => c.code === 'AUTHORING_CAUSE_UNKNOWN')?.classification).toBe('unknown');
  });
  it('returns unknown responsibility and no candidates for unsupported values', () => {
    const value = new Uint8Array([1]);
    const realization = rz(2, 'cart', value, value);
    const set: EvidenceSet = { transactions: [tx(1, 'cart', 0, value)], realizations: [realization], coverage: coverage() };
    expect(priorProducerFor(set, realization).value).toEqual([]);
    expect(currentObservedResponsibility(set, 'cart', val(value)).value.source.kind).toBe('unknown');
  });
});
