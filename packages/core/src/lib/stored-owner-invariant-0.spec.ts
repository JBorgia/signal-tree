import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  type TreeErrorEvent,
} from './internals/error-reporter';
import { getPositionRegistry } from './internals/position-registry';
import { flushAllStoredSignals, stored } from './markers/stored';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * STORED-OWNER-INVARIANT-0 — P0 for ERROR-SURFACE-2.
 *
 * `stored()` is the last transitional reporter producer. A REQUIRED `treeId`
 * depends on it always having an owning registry, and the source spells that
 * optionally:
 *
 * ```ts
 * const ownerRegistry = context?.positionRegistry;
 * ```
 *
 * ```text
 * NULL       every materialized stored() capable of reaching reportError has an
 *            owner PositionRegistry; the optionality is defensive/type-level
 * FALSIFIER  a legitimate stored error can reach reportTreeError with no
 *            registry
 * ```
 *
 * ## RESULT — the NULL SURVIVES. Outcome A.
 *
 * Instrumented at the report boundary itself, for BOTH live report operations
 * and both enhancer configurations:
 *
 * ```text
 * NO enhancers               op=read   hasContext=true hasRegistry=true id=1
 * restoration+transactions   op=read   hasContext=true hasRegistry=true id=2
 * NO enhancers               op=write  hasContext=true hasRegistry=true id=1
 * restoration+transactions   op=write  hasContext=true hasRegistry=true id=2
 * ```
 *
 * ⚠️ **AND A DISTINCTION THAT NEARLY MISLED THIS PROBE.**
 *
 * The first version asserted `getPositionRegistry(tree.$)` and FAILED on a
 * plain tree. That is a different question:
 *
 * ```text
 * the registry EXISTS               always — created unconditionally by
 *                                   createMaterializationContext
 * the registry is ATTACHED to $     only when an enhancer enables position
 *                                   topology
 * ```
 *
 * `stored()` reads it from the CONTEXT, not from the node, so its ownership does
 * not depend on enhancers at all. Asserting the node attachment would have
 * falsified the NULL for the wrong reason and cost us a required `treeId`.
 *
 * ## Why the optionality is type-level only
 *
 * ```text
 * 1  MaterializationContext.positionRegistry is REQUIRED, not optional, and is
 *    unconditionally constructed — unlike the capability-gated
 *    `positionTopologyEnabled`
 * 2  the only production path into createStoredSignal is the marker processor
 *    registration; it lives in the INTERNAL `lib/markers` barrel and `index.ts`
 *    neither names it nor re-exports that barrel, so no supported caller can
 *    construct one contextless
 * ```
 *
 * **Required `treeId` is earned.**
 *
 * ⚠️ Had this failed, the correct response was NOT `treeId?: TreeId` — it was to
 * bring back the exact construction path that lacked ownership.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

/** Reads fine, writes always fail — isolates the `'write'` report path. */
const writeFailingStorage = (): Storage => ({
  length: 0,
  clear: () => void 0,
  key: () => null,
  getItem: () => null,
  removeItem: () => void 0,
  setItem: () => {
    throw new Error('quota exceeded');
  },
});

const capture = () => {
  clearTreeErrorListenersForTesting();
  const seen: TreeErrorEvent[] = [];
  const off = onTreeError((e) => seen.push(e));
  return {
    seen,
    stop: () => {
      off();
      clearTreeErrorListenersForTesting();
    },
  };
};

describe('STORED-OWNER-INVARIANT-0: the report boundary has ownership', () => {
  it('a real write failure reports — WITHOUT enhancers', async () => {
    const cap = capture();

    const tree = signalTree({
      prefs: stored('soi-plain', 'light', { storage: writeFailingStorage() }),
    });
    await flush();
    (tree.$.prefs as unknown as { set(v: string): void }).set('dark');
    await flush();
    // ⚠️ Writes are DEBOUNCED. Without this the failure never happens and the
    // probe passes for the wrong reason — measured: zero reports before it.
    flushAllStoredSignals();
    await flush();

    const write = cap.seen.find((e) => e.operation === 'write');
    expect(write, 'the write path reported').toBeDefined();
    // The STATE location. `soi-plain` is the storage key, a different domain —
    // see ERROR-PATH-SEMANTICS-0.
    expect(write?.path).toBe('prefs');

    // ⚠️ The node attachment is enhancer-gated and ABSENT here — which is why
    // this is not the question. `stored()` takes its registry from the
    // materialization context.
    expect(getPositionRegistry(tree.$)).toBeUndefined();

    cap.stop();
  });

  it('and WITH enhancers, where the node attachment also exists', async () => {
    const cap = capture();

    const tree = signalTree(
      { prefs: stored('soi-enh', 'light', { storage: writeFailingStorage() }) },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();
    (tree.$.prefs as unknown as { set(v: string): void }).set('dark');
    await flush();
    flushAllStoredSignals();
    await flush();

    expect(cap.seen.find((e) => e.operation === 'write')).toBeDefined();
    expect(getPositionRegistry(tree.$)?.id).toBeDefined();

    cap.stop();
  });

  it('⚠️ two same-KEY stored trees are distinguishable only by owner', async () => {
    const a = signalTree(
      { prefs: stored('soi-same', 'light', { storage: writeFailingStorage() }) },
      { enhancers: [restoration(), transactions()] }
    );
    const b = signalTree(
      { prefs: stored('soi-same', 'light', { storage: writeFailingStorage() }) },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();

    // Same storage key, same shape — `path` cannot separate them.
    const idA = getPositionRegistry(a.$)?.id;
    const idB = getPositionRegistry(b.$)?.id;
    expect(idA).toBeDefined();
    expect(idB).toBeDefined();
    expect(idA).not.toBe(idB);
  });
});

const SRC = (() => {
  for (const c of [join(process.cwd(), 'packages/core/src'), join(process.cwd(), 'src')]) {
    try {
      readFileSync(join(c, 'lib/signal-tree.ts'), 'utf8');
      return c;
    } catch {
      /* next */
    }
  }
  throw new Error('STORED-OWNER-INVARIANT-0: could not locate packages/core/src');
})();

describe('STORED-OWNER-INVARIANT-0: why the optionality is type-level only', () => {
  it('the materialization context ALWAYS supplies a registry', () => {
    const mm = readFileSync(
      join(SRC, 'lib/internals/materialize-markers.ts'),
      'utf8'
    );

    // Required on the interface — not `positionRegistry?:`.
    expect(mm).toContain('positionRegistry: PositionRegistry;');
    // Unconditionally constructed, unlike the capability-gated flags.
    expect(mm).toContain('const positionRegistry = createPositionRegistry();');
  });

  it('⚠️ createStoredSignal is NOT reachable from the package root', () => {
    const markersBarrel = readFileSync(join(SRC, 'lib/markers/index.ts'), 'utf8');
    const index = readFileSync(join(SRC, 'index.ts'), 'utf8');

    expect(markersBarrel).toContain('createStoredSignal,');
    // The root neither names it nor re-exports that barrel wholesale, so no
    // supported caller can construct one without context.
    expect(index).not.toContain('createStoredSignal');
    expect(index).not.toContain("from './lib/markers'");
  });

  it('the production registration is the marker processor', () => {
    const src = readFileSync(join(SRC, 'lib/markers/stored.ts'), 'utf8');
    expect(src).toContain(
      'registerBuiltinMarkerProcessor(isStoredMarker, createStoredSignal, {'
    );
    // The line this probe exists to qualify.
    expect(src).toContain('const ownerRegistry = context?.positionRegistry;');
  });
});
