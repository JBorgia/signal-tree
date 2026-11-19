import type { CompositeDefinition, ExternalDefinition } from '../runner/types.ts';

/** S6(a): owned by ci/core-bundle-scan.mjs (ruling 4); referenced, not run, here. */
export const S6a: ExternalDefinition = {
  id: 'S6a',
  title: 'A core-only bundle contains no plugin code (symbol scan)',
  owner: 'ci/core-bundle-scan.mjs',
};

/**
 * S6(b): M1, S1 and S2 rerun with every plugin the subject has attached to a
 * different 10% subtree (the 'scoped-plugins' variant), against a bare tree.
 * Phase 3 has only transactions, so the phase's S6 covers the plugins that exist.
 */
export const S6b: CompositeDefinition = {
  id: 'S6b',
  title: 'Every plugin attached to a different 10% subtree: M1, S1, S2 within ±5% of a bare tree',
  requires: ['scopedPlugins'],
  compare: { scenarios: ['M1', 'S1', 'S2'], variant: 'scoped-plugins', against: 'bare' },
};

/** S6(c): byte identity of the core-only bundle with and without the plugin folders; owned by ci/ (ruling 4). */
export const S6c: ExternalDefinition = {
  id: 'S6c',
  title: 'The core-only bundle has identical bytes with and without the plugin folders',
  owner: 'ci/core-bundle-scan.mjs',
};
