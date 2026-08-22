import {
  assertEnhancerConfigurationValid,
  findEnhancerConfigurationProblems,
} from './enhancer-requirements';

import type { EnhancerConfigurationProblems } from './enhancer-requirements';

const meta = (
  name: string | undefined,
  requires: string[] = [],
  provides: string[] = []
) => ({ name, requires, provides });

describe('enhancer configuration validation', () => {
  it('accepts a satisfied requirement regardless of declaration order', () => {
    const consumerFirst = [
      meta('consumer', ['x']),
      meta('provider', [], ['x']),
    ];
    const providerFirst = [
      meta('provider', [], ['x']),
      meta('consumer', ['x']),
    ];

    const problems: EnhancerConfigurationProblems =
      findEnhancerConfigurationProblems(consumerFirst);
    expect(problems.unsatisfied).toEqual([]);
    expect(
      findEnhancerConfigurationProblems(providerFirst).unsatisfied
    ).toEqual([]);
    expect(() => assertEnhancerConfigurationValid(consumerFirst)).not.toThrow();
  });

  it('rejects a requirement nothing provides', () => {
    expect(() =>
      assertEnhancerConfigurationValid([meta('consumer', ['x'])])
    ).toThrow(
      /"consumer" requires capability "x", but no configured enhancer provides it/
    );
  });

  it('checks anonymous enhancers too', () => {
    // The chained builder once gated the whole block on `meta.name`, so an
    // unnamed enhancer's requirements were silently ignored.
    expect(() =>
      assertEnhancerConfigurationValid([meta(undefined, ['x'])])
    ).toThrow(/an unnamed enhancer requires capability "x"/);
  });

  it('reports EVERY problem in one failure, not just the first', () => {
    let message = '';
    try {
      assertEnhancerConfigurationValid([
        meta('alpha', ['missing-one']),
        meta('beta', ['missing-two']),
        meta('gamma', ['missing-three']),
      ]);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('missing-one');
    expect(message).toContain('missing-two');
    expect(message).toContain('missing-three');
  });

  it('reports duplicate named enhancers, and exempts anonymous ones', () => {
    const problems = findEnhancerConfigurationProblems([
      meta('dup'),
      meta('dup'),
      meta(undefined),
      meta(undefined),
    ]);
    expect(problems.duplicates).toEqual([{ name: 'dup', count: 2 }]);
  });

  it('accepts an empty configuration', () => {
    expect(() => assertEnhancerConfigurationValid([])).not.toThrow();
    expect(() => assertEnhancerConfigurationValid([undefined])).not.toThrow();
  });
});
