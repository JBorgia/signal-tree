import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ASYNC-SOURCE-RETIRE-0 — the INVENTORY, and ⚠️ TWO measurements that change the
 * plan.
 *
 * The directive was to carve `asyncSource` retirement out as a NARROW
 * prerequisite for a truthful required-attribution error event. The inventory
 * says it is not narrow, and separately says retiring it may not be the thing
 * that unblocks the event at all.
 *
 * ## ⚠️ 1. RETIREMENT IS NOT NARROW — ~95 files
 *
 * ```text
 * core source (non-spec)   15   incl. signal-tree, types, utils, readonly,
 *                               readonly-readers, serialization,
 *                               materialize-markers, entity-map, index
 * core specs               ~14
 * demo app                 ~8   routes, navigation, examples config, components
 * tools / release gates      5   verify-gates, check-rc-public-dispositions,
 *                               check-contract-neutrality, check-bundle-budget,
 *                               bench-ssr-payload
 * docs / rfcs / audits     ~50
 * ```
 *
 * `asyncSource` is PUBLICLY EXPORTED (via `markers/index.ts`), so removal is a
 * breaking public change with demo, gate and documentation consequences. That is
 * the full migration phase, not a carve-out.
 *
 * ⚠️ One piece of good news: `async-query.ts` does NOT depend on it. The only
 * reference is a comment describing a shape. So retirement does not cascade into
 * the other async primitive.
 *
 * ## ⚠️ 2. ITS CENTRAL REPORTING IS ALREADY INCOMPLETE — 1 of 4 paths
 *
 * This is the measurement that matters most, because the whole reason
 * `asyncSource` blocks ERROR-SURFACE-2 is that it is a REPORTER PRODUCER which
 * cannot supply `treeId`.
 *
 * ```text
 * errorSignal.set(err)     3 failure paths   sync throw, observable error,
 *                                            promise rejection
 * reportTreeError(...)     1 failure path    the SYNC THROW only
 * ```
 *
 * So an application observing `asyncSource` failures through the central
 * reporter today sees **one of its three failure modes**. The path that actually
 * carries every failure is the marker's own public signal:
 *
 * ```ts
 * readonly error: Signal<unknown | null>;
 * ```
 *
 * ⚠️ **That reframes the blocker.** `asyncSource`'s central report is not a
 * coherent observability guarantee being removed — it is a partial one that
 * never covered the async paths, sitting next to a complete local one.
 *
 * ## The third option the falsifier actually supports
 *
 * ```text
 * OPTION 1  plumb ownership context into async-source          rejected: spends
 *                                                              architecture on a
 *                                                              retiring API
 * OPTION 2  retire async-source first                          ~95 files; the
 *                                                              full migration
 *                                                              phase, not a
 *                                                              prerequisite
 * OPTION 3  remove async-source's SINGLE reportTreeError call  one call site
 * ```
 *
 * Under OPTION 3 every remaining reporter producer supplies required attribution
 * immediately:
 *
 * ```text
 * link     registry.id ✓  ownerPath ✓   KEEPS
 * stored   ownerRegistry.id ✓  key ✓    RETIRING LATER, already compliant
 * ```
 *
 * ⚠️ Its cost, stated plainly: `asyncSource` users lose the one central-reporter
 * path they had, and must use `node.error()` — which is public, and is the only
 * surface that covered their other two failure modes anyway.
 *
 * ⚠️ Recorded, NOT taken. Removing an observability path is a public-surface
 * decision even when the path is partial.
 *
 * This file is an INVENTORY. It asserts the facts so the decision is made
 * against measurements rather than an assumption about scope.
 */

const SRC = (() => {
  for (const c of [join(process.cwd(), 'packages/core/src'), join(process.cwd(), 'src')]) {
    try {
      readFileSync(join(c, 'lib/signal-tree.ts'), 'utf8');
      return c;
    } catch {
      /* next */
    }
  }
  throw new Error('ASYNC-SOURCE-RETIRE-0: could not locate packages/core/src');
})();

const ASYNC_SOURCE = readFileSync(join(SRC, 'lib/markers/async-source.ts'), 'utf8');

describe('ASYNC-SOURCE-RETIRE-0: the reporting is partial', () => {
  it('⚠️ ONE central report, but THREE local failure paths', () => {
    const reports = [...ASYNC_SOURCE.matchAll(/reportTreeError\(\{/g)].length;
    const localSets = [...ASYNC_SOURCE.matchAll(/errorSignal\.set\(err\)/g)].length;

    // The asymmetry is the finding: central observation covers the synchronous
    // throw only, while the local signal covers every failure mode.
    expect(reports).toBe(1);
    expect(localSets).toBe(3);
    expect(localSets).toBeGreaterThan(reports);
  });

  it('the complete surface is the marker\'s own public error signal', () => {
    // Public, readonly, and covering all three paths. Declared on
    // `AsyncSourceSignal` in async-source.ts itself, not the contract module.
    expect(ASYNC_SOURCE).toContain('readonly error: Signal<unknown | null>;');
    expect(ASYNC_SOURCE).toContain(
      "Object.defineProperty(fn, 'error', { value: errorSignal.asReadonly() });"
    );
  });

  it('⚠️ the single report site is the SYNCHRONOUS-throw path', () => {
    const at = ASYNC_SOURCE.indexOf('reportTreeError({');
    const before = ASYNC_SOURCE.slice(Math.max(0, at - 400), at);
    // It sits in the `catch` around the synchronous `load()` call, not in the
    // observable-error or promise-rejection handlers.
    expect(before).toContain('result = load();');
    expect(before).toContain('} catch (err) {');
  });
});

describe('ASYNC-SOURCE-RETIRE-0: retirement scope', () => {
  it('asyncSource is PUBLICLY exported — removal is a breaking change', () => {
    const markersIndex = readFileSync(join(SRC, 'lib/markers/index.ts'), 'utf8');
    expect(markersIndex).toContain('asyncSource,');
  });

  it('⚠️ but async-query does NOT depend on it — retirement does not cascade', () => {
    const asyncQuery = readFileSync(join(SRC, 'lib/markers/async-query.ts'), 'utf8');
    const hits = [...asyncQuery.matchAll(/asyncSource|AsyncSource|ASYNC_SOURCE/g)];

    // Exactly one reference, and it is prose.
    expect(hits).toHaveLength(1);
    expect(asyncQuery).toContain(
      '/** Alias for `results` to match the asyncSource shape. */'
    );
  });

  it('core source coupling is wide enough to be the migration phase, not a carve-out', () => {
    // A representative sample of the non-spec core files that would change.
    for (const f of [
      'lib/signal-tree.ts',
      'lib/types.ts',
      'lib/utils.ts',
      'lib/readonly.ts',
      'lib/readonly-readers.ts',
      'lib/internals/materialize-markers.ts',
      'enhancers/serialization/serialization.ts',
    ]) {
      const src = readFileSync(join(SRC, f), 'utf8');
      expect(
        /asyncSource|AsyncSource|ASYNC_SOURCE/.test(src),
        `${f} references asyncSource`
      ).toBe(true);
    }
  });
});
