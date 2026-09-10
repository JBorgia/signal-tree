import { describe, expect, it } from 'vitest';

import { realizationSupport } from './support';

describe('realizationSupport', () => {
  it('unsupported for a bare tree', () => {
    expect(realizationSupport({ capabilities: [] })).toEqual({
      state: 'unsupported',
      reason: 'leaf-observation-unavailable',
    });
  });

  it('unsupported when the subject is not a tree', () => {
    expect(realizationSupport({ capabilities: undefined }).state).toBe('unsupported');
  });

  it('supported when causal-runtime is present', () => {
    expect(realizationSupport({ capabilities: ['causal-runtime'] })).toEqual({
      state: 'supported',
      capture: 'inactive',
    });
  });

  it('supported via restoration\'s capability set', () => {
    expect(
      realizationSupport({ capabilities: ['causal-runtime', 'temporal-snapshots'] }).state
    ).toBe('supported');
  });

  /**
   * S2-11 — entity effects are observable without causal-runtime, but exposing
   * that partial coverage while silently missing scalar leaves is the
   * partial-history trap. Refuse loudly instead.
   */
  it('unsupported for capabilities that do not imply leaf observation', () => {
    expect(
      realizationSupport({ capabilities: ['mutation-capture', 'position-topology'] }).state
    ).toBe('unsupported');
  });

  /** R1 POSITIVE CONTROL — the predicate must be able to return each answer. */
  it('control: the predicate discriminates, it is not constant', () => {
    const yes = realizationSupport({ capabilities: ['causal-runtime'] }).state;
    const no = realizationSupport({ capabilities: ['temporal-snapshots'] }).state;
    expect(yes).toBe('supported');
    expect(no).toBe('unsupported');
    expect(yes).not.toBe(no);
  });
});
