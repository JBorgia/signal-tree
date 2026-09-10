/**
 * Proves the STRUCTURAL predicate matches the BEHAVIOUR that
 * LEAF-OBSERVATION-SUPPORT-0 measured. Without this, `treeCapabilities()` is an
 * unverified proxy for observability.
 */
import { describe, expect, it } from 'vitest';

import { batching } from '../../../enhancers/batching/batching';
import { restoration } from '../../../enhancers/restoration/restoration';
import { transactions } from '../../../enhancers/transactions/transactions';
import { treeCapabilities } from '../../../internals';
import { signalTree } from '../../signal-tree';

type Cart = { total: number };
const has = (t: unknown) => treeCapabilities(t as never)?.includes('causal-runtime') ?? false;

describe('treeCapabilities matches measured leaf observability', () => {
  it('bare -> no causal-runtime (measured: unobservable)', () => {
    expect(has(signalTree({ total: 0 } as Cart))).toBe(false);
  });

  it('batching() -> no causal-runtime (measured: unobservable)', () => {
    expect(has(signalTree({ total: 0 } as Cart, { enhancers: [batching()] } as never))).toBe(false);
  });

  it('transactions() -> causal-runtime (measured: observable)', () => {
    expect(has(signalTree({ total: 0 } as Cart, { enhancers: [transactions()] } as never))).toBe(true);
  });

  it('restoration() -> causal-runtime (measured: observable)', () => {
    expect(has(signalTree({ total: 0 } as Cart, { enhancers: [restoration()] } as never))).toBe(true);
  });

  /** The adversarial case: capability requested directly, no enhancer. */
  it('capabilities:[causal-runtime] -> causal-runtime (measured: observable)', () => {
    expect(has(signalTree({ total: 0 } as Cart, { capabilities: ['causal-runtime'] } as never))).toBe(true);
  });

  /** R1 POSITIVE CONTROL — the accessor must be able to report absence. */
  it('control: reports undefined for a non-tree and empty for a bare tree', () => {
    expect(treeCapabilities({} as never)).toBeUndefined();
    const bare = treeCapabilities(signalTree({ total: 0 } as Cart) as never);
    expect(Array.isArray(bare)).toBe(true);
    expect(bare).not.toContain('causal-runtime');
  });
});
