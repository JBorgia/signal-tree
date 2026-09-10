import { describe, expect, it } from 'vitest';
import type {
  CapturedValue,
  EvidenceSet,
  RealizationCoverage,
} from '@signal-tree/studio-query';

import { formatWhy, whyValue } from './index';

const val = (v: unknown): CapturedValue => ({ kind: 'value', value: v });
const coverage = (o: Partial<RealizationCoverage> = {}): RealizationCoverage => ({
  completeFromTreeStart: false, scopeIntegrity: 'complete', startedAtSequence: 0,
  truncated: false, ...o,
});

/** T31 -> 9600, T32 -> 9800, R44 9800 -> 10200. */
const canonical: EvidenceSet = {
  transactions: [
    { kind: 'transaction', treeId: 't', turnId: 31, disposition: 'committed',
      effects: [{ path: 'cart.total', ownerPath: 'cart.total', before: 12000, after: 9600 }] },
    { kind: 'transaction', treeId: 't', turnId: 32, disposition: 'committed',
      effects: [{ path: 'cart.total', ownerPath: 'cart.total', before: 9600, after: 9800 }] },
  ],
  realizations: [
    { kind: 'realization', treeId: 't', sequence: 44, path: 'cart.total', ownerPath: 'cart.total',
      before: val(9800), after: val(10200), origin: 'external', participation: 'realized' },
  ],
  coverage: coverage(),
};

describe('whyValue', () => {
  it('renders FACT / DERIVED / UNKNOWN in that epistemic order', () => {
    const view = whyValue(canonical, 'cart.total', val(10200));
    const classes = view.lines.map((l) => l.classification);

    expect(classes.filter((c) => c === 'fact')).toHaveLength(3);
    expect(classes).toContain('derived');
    expect(classes).toContain('unknown');
    expect(view.currentValueExplained).toBe(true);
  });

  it('never renders a sentence attributing the realization to a transaction', () => {
    const text = formatWhy(whyValue(canonical, 'cart.total', val(10200)));
    expect(text).toContain('External realization changed 9800 → 10200.');
    expect(text).not.toMatch(/T3[12].*(corrected|caused|superseded by)/i);
    expect(text).toContain('No retained evidence identifies which authored operation');
  });

  it('carries evidence references on every non-unknown line', () => {
    for (const line of whyValue(canonical, 'cart.total', val(10200)).lines) {
      if (line.classification !== 'unknown') {
        expect(line.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  /**
   * The panel must not present retained history as explaining what is on
   * screen when the live value has moved on.
   */
  it('flags when the current value is NOT explained by retained evidence', () => {
    const view = whyValue(canonical, 'cart.total', val(55555));
    expect(view.currentValueExplained).toBe(false);
    expect(formatWhy(view)).toContain('not explained by retained evidence');
  });

  it('states coverage limits as lines rather than footnotes', () => {
    const truncated: EvidenceSet = { ...canonical, coverage: coverage({ truncated: true }) };
    const text = formatWhy(whyValue(truncated, 'cart.total', val(10200)));
    expect(text).toContain('Earlier captured evidence has been evicted');
    expect(text).toContain('Capture began after application startup');
  });

  it('renders an unserializable value without pretending it is absent', () => {
    const set: EvidenceSet = {
      transactions: [], coverage: coverage(),
      realizations: [{
        kind: 'realization', treeId: 't', sequence: 1, path: 'cart.fn', ownerPath: 'cart.fn',
        before: { kind: 'unserializable', valueType: 'function', preview: 'function f' },
        after: val(1), origin: 'external', participation: 'realized',
      }],
    };
    expect(formatWhy(whyValue(set, 'cart.fn', val(1)))).toContain('<function: function f>');
  });

  it('a restoration realization is not described as external', () => {
    const set: EvidenceSet = {
      transactions: [], coverage: coverage(),
      realizations: [{
        kind: 'realization', treeId: 't', sequence: 1, path: 'p', ownerPath: 'p',
        before: val(1), after: val(2), origin: 'restoration', participation: 'realized',
      }],
    };
    const text = formatWhy(whyValue(set, 'p', val(2)));
    expect(text).toContain('A restoration write changed');
    expect(text).not.toContain('External realization');
  });
});
