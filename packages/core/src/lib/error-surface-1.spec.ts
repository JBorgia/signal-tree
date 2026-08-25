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
      source: e.source,
      operation: e.operation,
      path: e.path,
      message: String((e.error as Error)?.message),
    }));

    expect(asPublicFacts[0]).toEqual(asPublicFacts[1]);

    // And there is no owner field to fall back on — not even the `ownerId` the
    // notifier invariant already requires of every notification.
    for (const e of cap.seen) {
      expect((e as Record<string, unknown>)['ownerId']).toBeUndefined();
      expect((e as Record<string, unknown>)['tree']).toBeUndefined();
      expect((e as Record<string, unknown>)['owner']).toBeUndefined();
    }

    la.dispose();
    lb.dispose();
    cap.stop();
  });

  it('and Link failures carry no path either, so location is unavailable too', async () => {
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
    // ⚠️ `path` is optional on the event and Link does not supply it, though
    // `ownerPath` IS known at the reporting site. Recorded as a measured gap,
    // not fixed here: path alone is not tree identity, and adding it without
    // deciding attribution would give a false sense of addressability.
    expect(cap.seen[0].path).toBeUndefined();

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
  it('⚠️ 7 members, 3 live producers, 1 not scheduled for deletion', () => {
    const reporter = readFileSync(
      join(SRC, 'lib/internals/error-reporter.ts'),
      'utf8'
    );
    const union = reporter.slice(
      reporter.indexOf('export type TreeErrorSource'),
      reporter.indexOf('export interface TreeErrorEvent')
    );
    const members = [...union.matchAll(/\|\s*'([a-z-]+)'/g)].map((m) => m[1]);

    expect(members.sort()).toEqual([
      'async-query',
      'async-source',
      'effect',
      'entity-loader',
      'link',
      'persistence',
      'stored',
    ]);

    // Only three files call the reporter at all.
    const producers = ['lib/link.ts', 'lib/markers/async-source.ts', 'lib/markers/stored.ts'];
    for (const f of producers) {
      expect(readFileSync(join(SRC, f), 'utf8')).toContain('reportTreeError(');
    }

    // ⚠️ So four members have NO producer, and of the three that do, `stored`
    // and `async-source` are both being removed. Freezing this union publicly
    // would make migration debt permanent API.
  });

  it('⚠️ `source` duplicates `operation` for the one member that survives', async () => {
    const cap = capture();
    const tree = makeTree();
    await flush();

    const l = link(tree.$.settings.theme, {
      set: () => Promise.reject(new Error('down')),
    });
    tree.$.settings.theme.set('dark');
    await flush();
    await l.settled();

    // `source: 'link'` carries no information `operation: 'link:set'` lacks.
    // That is not proof the field is useless in general, but it IS evidence it
    // is not earned as PUBLIC information by the surviving producer.
    expect(cap.seen[0].source).toBe('link');
    expect(cap.seen[0].operation).toBe('link:set');
    expect(cap.seen[0].operation.startsWith(cap.seen[0].source)).toBe(true);

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
