import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  reportTreeError,
  type TreeErrorEvent,
} from './internals/error-reporter';
import { link } from './link';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * ERROR-SURFACE-1 — is the central reporter the v15 PUBLIC error-observation
 * mechanism?
 *
 * The claim production Link now depends on:
 *
 * > "a rejected outbound Link `set()` is observable"
 *
 * That is only true for USERS if its chosen channel is public. It currently is
 * not exported at all, so until this closes the truthful wording is:
 *
 * > Link reports rejected outbound sends to SignalTree's INTERNAL error
 * > reporter.
 *
 * ```text
 * NULL       the existing reporter can become the v15 generic public
 *            error-observation mechanism with a small, truthful, stable event
 * FALSIFIER  it cannot identify which tree emitted an otherwise identical
 *            error; or the taxonomy would freeze obsolete categories; or the
 *            semantics are too incomplete to justify a generic public claim
 * ```
 *
 * ## ⚠️ THE NULL IS FALSIFIED, on TWO independent counts
 *
 * ### 1. Two same-shaped trees are INDISTINGUISHABLE
 *
 * Measured below. Two independent trees, both linked, both endpoints failing
 * identically, produce byte-identical events:
 *
 * ```text
 * { source: 'link', operation: 'link:set', error: Error('endpoint down') }
 * { source: 'link', operation: 'link:set', error: Error('endpoint down') }
 * ```
 *
 * A listener wired to logging, Sentry or recovery routing cannot tell A from B.
 *
 * ⚠️ **This is the SAME lesson NOTIFIER-SCOPE-0 and OWNER-PING-0 already cost
 * us**, arriving in diagnostics: path and tree-local identity are not enough to
 * distinguish trees. Two same-shaped trees give their positions the SAME local
 * ids by design, and `settings.theme` names a location in both.
 *
 * The reporter carries no owner at all — not even the `ownerId` the notifier
 * invariant already requires of every notification.
 *
 * ### 2. The taxonomy is mostly UNPRODUCED, and mostly RETIRING
 *
 * ```text
 * member          live producer?   status
 * stored          YES              RETIRING
 * async-source    YES              RETIRING
 * link            YES              keeps
 * async-query     NO               no producer
 * entity-loader   NO               no producer
 * persistence     NO               no producer
 * effect          NO               no producer
 * ```
 *
 * Seven members, three producers, and **only one producer is not scheduled for
 * deletion**. Exporting this union would turn migration debt into permanent
 * API: `'stored'` and `'async-source'` would be frozen public strings naming
 * APIs v15 is removing.
 *
 * ⚠️ And `source` is partly REDUNDANT with `operation` where it is live:
 *
 * ```text
 * source = 'link'   operation = 'link:set'
 * ```
 *
 * So `source` is not obviously earned as public information even for the one
 * member that survives.
 *
 * ## Disposition
 *
 * **OUTCOME B for the union; the reporter itself is repairable.** The failure is
 * not that a central reporter is the wrong idea — the delivery semantics below
 * all hold. It is that the EVENT is not yet a truthful public contract:
 *
 * ```text
 * MISSING   owner attribution, without which a process-global observer cannot
 *           route or attribute anything in a multi-tree application
 * UNEARNED  a 7-member source union whose live producers are 2/3 retiring and
 *           whose surviving member duplicates `operation`
 * ```
 *
 * ⚠️ Recorded, NOT fixed, and NOT exported. Adding owner attribution to the
 * event is a real change with its own question — which stable tree identity,
 * given PositionIds are deliberately tree-local and must not become public
 * global identity — and it belongs to whoever takes the decision, not to a
 * measurement.
 *
 * Until then the claim stays worded as "reports to the internal reporter".
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

const makeTree = () =>
  signalTree(
    { settings: { theme: 'light' } },
    { enhancers: [restoration(), transactions()] }
  );

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

// ───────────────────────────────────────────────────────────────────────────
// P0 — two-tree attribution
// ───────────────────────────────────────────────────────────────────────────

describe('ERROR-SURFACE-1: can a listener attribute an event to its tree?', () => {
  it('⚠️ NO — two same-shaped trees produce INDISTINGUISHABLE events', async () => {
    const cap = capture();

    const a = makeTree();
    const b = makeTree();
    await flush();

    // Deliberately identical: same message, same operation, same source, same
    // path. The question is whether the EVENT can separate them.
    const fail = () => Promise.reject(new Error('endpoint down'));
    const la = link(a.$.settings.theme, { set: fail });
    const lb = link(b.$.settings.theme, { set: fail });

    a.$.settings.theme.set('dark');
    b.$.settings.theme.set('dark');
    await flush();
    await la.settled();
    await lb.settled();

    expect(cap.seen).toHaveLength(2);

    // ⚠️ THE MEASUREMENT. Only the public event is inspected — no closure
    // knowledge, no private registry.
    const asPublicFacts = cap.seen.map((e) => ({
      operation: e.operation,
      path: e.path,
      message: String((e.error as Error)?.message),
    }));

    // ⚠️ HISTORICAL: at the time this was measured the events were identical on
    // every public fact. They still are on OPERATION and PATH — which is the
    // point — but `treeId` now separates them. See ERROR-SURFACE-2.
    expect(asPublicFacts[0]).toEqual(asPublicFacts[1]);
    expect(cap.seen[0].treeId).not.toBe(cap.seen[1].treeId);

    // And there is no owner field to fall back on — not even the `ownerId` the
    // notifier invariant already requires of every notification.
    // The original finding: no owner field of ANY name existed.
    for (const e of cap.seen) {
      expect((e as Record<string, unknown>)['ownerId']).toBeUndefined();
      expect((e as Record<string, unknown>)['owner']).toBeUndefined();
    }

    la.dispose();
    lb.dispose();
    cap.stop();
  });

  it('⚠️ RESOLVED — Link now supplies the path it always knew', async () => {
    const cap = capture();
    const tree = makeTree();
    await flush();

    const l = link(tree.$.settings.theme, {
      set: () => Promise.reject(new Error('down')),
    });
    tree.$.settings.theme.set('dark');
    await flush();
    await l.settled();

    expect(cap.seen).toHaveLength(1);
    // WAS `toBeUndefined()`. `ownerPath` was known at the reporting site and
    // simply dropped — needless information loss, fixed by ERROR-SURFACE-2.
    // Location, never identity: the two-tree case proves the same string
    // belongs to both trees.
    expect(cap.seen[0].path).toBe('settings.theme');

    l.dispose();
    cap.stop();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Taxonomy
// ───────────────────────────────────────────────────────────────────────────

const SRC = (() => {
  for (const c of [join(process.cwd(), 'packages/core/src'), join(process.cwd(), 'src')]) {
    try {
      readFileSync(join(c, 'lib/signal-tree.ts'), 'utf8');
      return c;
    } catch {
      /* next */
    }
  }
  throw new Error('ERROR-SURFACE-1: could not locate packages/core/src');
})();

describe('ERROR-SURFACE-1: the taxonomy is mostly unproduced and mostly retiring', () => {
  it('⚠️ RESOLVED — the union is deleted, and only two producers remain', () => {
    const reporter = readFileSync(
      join(SRC, 'lib/internals/error-reporter.ts'),
      'utf8'
    );

    // The measured finding was 7 members / 2 live producers / 1 survivor, with
    // 4 members having no producer at all. ERROR-SURFACE-2 deleted the union
    // rather than freezing migration debt into public API.
    expect(reporter).not.toContain('TreeErrorSource');

    // Two producers, both able to attribute.
    for (const f of ['lib/link.ts', 'lib/markers/stored.ts']) {
      expect(readFileSync(join(SRC, f), 'utf8')).toContain('reportTreeError(');
    }
    expect(
      readFileSync(join(SRC, 'lib/markers/async-source.ts'), 'utf8')
    ).not.toContain('reportTreeError(');
  });

  it('⚠️ RESOLVED — `source` is gone; attribution is treeId', async () => {
    const cap = capture();
    const tree = makeTree();
    await flush();

    const l = link(tree.$.settings.theme, {
      set: () => Promise.reject(new Error('down')),
    });
    tree.$.settings.theme.set('dark');
    await flush();
    await l.settled();

    // It duplicated `operation` and nothing branched on it, so it was deleted
    // from the DELIVERED object — not merely hidden from TypeScript. The
    // reporter hands listeners the same object it is given, so a type-only
    // narrowing would have left it inspectable from JavaScript.
    expect(
      (cap.seen[0] as unknown as Record<string, unknown>)['source']
    ).toBeUndefined();
    expect(cap.seen[0].operation).toBe('link:set');
    expect(cap.seen[0].treeId).toBeDefined();

    l.dispose();
    cap.stop();
  });

  it('the reporter is NOT exported from the package root — the claim is not yet public', () => {
    const index = readFileSync(join(SRC, 'index.ts'), 'utf8');
    expect(index).not.toContain('onTreeError');
    expect(index).not.toContain('TreeErrorEvent');
    expect(index).not.toContain('error-reporter');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Delivery semantics — these all HOLD, and are what makes the reporter
// repairable rather than wrong
// ───────────────────────────────────────────────────────────────────────────

describe('ERROR-SURFACE-1: delivery semantics', () => {
  it('one reported failure invokes a listener exactly once', async () => {
    const cap = capture();
    const tree = makeTree();
    await flush();

    const l = link(tree.$.settings.theme, {
      set: () => Promise.reject(new Error('down')),
    });
    tree.$.settings.theme.set('dark');
    await flush();
    await l.settled();

    expect(cap.seen).toHaveLength(1);
    l.dispose();
    cap.stop();
  });

  it('a throwing listener damages neither the link nor other listeners', async () => {
    clearTreeErrorListenersForTesting();
    const seen: TreeErrorEvent[] = [];
    const offBad = onTreeError(() => {
      throw new Error('listener exploded');
    });
    const offGood = onTreeError((e) => seen.push(e));

    const tree = makeTree();
    await flush();
    let fail = true;
    const sent: string[] = [];
    const l = link(tree.$.settings.theme, {
      set: (v) => {
        if (fail) return Promise.reject(new Error('down'));
        sent.push(v as string);
        return Promise.resolve();
      },
    });

    tree.$.settings.theme.set('dark');
    await flush();
    await l.settled();

    // The other listener still received it...
    expect(seen).toHaveLength(1);

    // ...and the link still works.
    fail = false;
    tree.$.settings.theme.set('blue');
    await flush();
    await l.settled();
    expect(sent).toEqual(['blue']);

    l.dispose();
    offBad();
    offGood();
    clearTreeErrorListenersForTesting();
  });

  it('unsubscribe is clean, and reporting with no listeners is harmless', () => {
    clearTreeErrorListenersForTesting();
    const seen: TreeErrorEvent[] = [];
    const off = onTreeError((e) => seen.push(e));

    reportTreeError({ source: 'link', operation: 'link:set', error: new Error('one') });
    expect(seen).toHaveLength(1);

    off();
    reportTreeError({ source: 'link', operation: 'link:set', error: new Error('two') });
    expect(seen).toHaveLength(1);

    // No listeners at all: the reporter returns early and nothing throws.
    expect(() =>
      reportTreeError({ source: 'link', operation: 'link:set', error: new Error('three') })
    ).not.toThrow();

    clearTreeErrorListenersForTesting();
  });

  it('multiple listeners are independent', () => {
    clearTreeErrorListenersForTesting();
    const a: TreeErrorEvent[] = [];
    const b: TreeErrorEvent[] = [];
    const offA = onTreeError((e) => a.push(e));
    const offB = onTreeError((e) => b.push(e));

    reportTreeError({ source: 'link', operation: 'link:set', error: new Error('x') });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);

    offA();
    reportTreeError({ source: 'link', operation: 'link:set', error: new Error('y') });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);

    offB();
    clearTreeErrorListenersForTesting();
  });

  it('a failed send leaves X authored, the queue usable, and settled() resolving', async () => {
    const cap = capture();
    const tree = makeTree();
    await flush();
    let fail = true;
    const sent: string[] = [];

    const l = link(tree.$.settings.theme, {
      set: (v) => {
        if (fail) return Promise.reject(new Error('down'));
        sent.push(v as string);
        return Promise.resolve();
      },
    });

    tree.$.settings.theme.set('dark');
    await flush();

    // LINK-2's contract: settled() RESOLVES, it does not throw.
    await expect(l.settled()).resolves.toBeUndefined();
    expect(tree.$.settings.theme()).toBe('dark');

    fail = false;
    tree.$.settings.theme.set('blue');
    await flush();
    await l.settled();
    expect(sent).toEqual(['blue']);

    expect(cap.seen).toHaveLength(1);
    l.dispose();
    cap.stop();
  });
});
