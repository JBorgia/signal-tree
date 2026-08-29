import { describe, expect, it } from 'vitest';
import { ENHANCER_META } from '../lib/types';
import { batching } from './batching/batching';
import { restoration } from './restoration/restoration';
import { devTools } from './devtools/devtools';
import { serialization } from './serialization/serialization';

/**
 * Enhancer metadata — that real enhancer factories carry the metadata the
 * declarative plan reads.
 *
 * ## MATRIX-CLOSE M4: what was DELETED from this file, and why
 *
 * It used to contain "duplicate enhancer detection" and "dependency validation"
 * suites — seven tests over a hand-built `createMockTree()` whose `.with()`,
 * duplicate check and dependency check were all implemented IN THE TEST FILE.
 * The mock threw `"Enhancer X has already been applied to this tree"`, a string
 * that does not exist in the product.
 *
 * So those tests asserted that the test's own reimplementation worked. They
 * could not fail for a product reason, and they exercised `.with()` — a method
 * deleted in 15.0 — which is what made them look like coverage of a surface that
 * no longer exists.
 *
 * The real behaviour is covered against real trees in
 * `lib/enhancer-metadata-authority.spec.ts`: duplicate detection by name,
 * requirement satisfaction by capability, fail-closed before any enhancer runs,
 * declaration-order independence, and a throwing enhancer aborting construction
 * — with the messages the library actually emits.
 *
 * What survives here is the part that touched real code.
 */

describe('enhancer metadata', () => {
  it.each([
    ['batching', batching],
    ['restoration', restoration],
    ['devTools', devTools],
    ['serialization', serialization],
  ])('%s attaches metadata with name', (expectedName, factory) => {
    const enhancerFn = (factory as any)();
    const meta =
      (enhancerFn as any)[ENHANCER_META] ?? (enhancerFn as any).metadata;

    expect(meta).toBeDefined();
    expect(meta.name).toBe(expectedName);
    expect(meta.provides).toContain(expectedName);
  });
});
