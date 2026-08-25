import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { link, onTreeError, signalTree } from '../index';
// ⚠️ `stored` is NOT a package-root export — it is being retired, and this file
// does not resurrect it. Imported from its module purely to exercise the
// REPORTER's path semantics for a second producer.
import { stored } from './markers/stored';
import type { TreeErrorEvent } from '../index';
import { clearTreeErrorListenersForTesting } from './internals/error-reporter';
import { flushAllStoredSignals } from './markers/stored';
import { restoration } from '../enhancers/restoration/restoration';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * TREE ERROR — PUBLIC CONTRACT and DELIVERY, through the PACKAGE ROOT.
 *
 * Consolidated from ERROR-SURFACE-2-PUBLIC plus the delivery semantics that
 * ERROR-SURFACE-1 and ERROR-SURFACE-0 had been carrying. The historical
 * reasoning lives in `v15-production-surface-audit.md`.
 *
 * ⚠️ Everything here imports from `../index`, not from the internals. The
 * earned semantics were all proven internally first; this proves the SHIPPED
 * surface actually carries them.
 *
 * Only three symbols became public:
 *
 * ```text
 * onTreeError      the observer
 * TreeErrorEvent   what it receives
 * TreeId           only because the event names it
 * ```
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

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

const makeTree = () =>
  signalTree(
    { settings: { theme: 'light' } },
    { enhancers: [restoration(), transactions()] }
  );

const failing = () => Promise.reject(new Error('endpoint down'));

const writeFails = (): Storage => ({
  length: 0,
  clear: () => void 0,
  key: () => null,
  getItem: () => null,
  removeItem: () => void 0,
  setItem: () => {
    throw new Error('quota exceeded');
  },
});

describe('PUBLIC: attribution', () => {
  it('⚠️ two identical trees are distinguishable through the public API', async () => {
    const cap = capture();
    const a = makeTree();
    const b = makeTree();
    await flush();

    const la = link(a.$.settings.theme, { set: failing });
    const lb = link(b.$.settings.theme, { set: failing });
    a.$.settings.theme.set('dark');
    b.$.settings.theme.set('dark');
    await flush();
    await la.settled();
    await lb.settled();

    expect(cap.seen).toHaveLength(2);
    expect(cap.seen[0].path).toBe(cap.seen[1].path);
    expect(cap.seen[0].operation).toBe(cap.seen[1].operation);
    expect(cap.seen[0].treeId).not.toBe(cap.seen[1].treeId);

    la.dispose();
    lb.dispose();
    cap.stop();
  });

  it('the same tree is stable', async () => {
    const cap = capture();
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings.theme, { set: failing });

    tree.$.settings.theme.set('one');
    await flush();
    await l.settled();
    tree.$.settings.theme.set('two');
    await flush();
    await l.settled();

    expect(new Set(cap.seen.map((e) => e.treeId)).size).toBe(1);
    l.dispose();
    cap.stop();
  });

  it('path is the state location for BOTH producers', async () => {
    const cap = capture();
    const tree = signalTree({
      settings: {
        theme: stored('public-key', 'light', {
          storage: writeFails(),
          debounceMs: 0,
        }),
      },
    });
    await flush();
    (tree.$.settings.theme as unknown as { set(v: string): void }).set('dark');
    flushAllStoredSignals();
    await flush();

    // NOT `public-key`.
    expect(cap.seen.find((e) => e.operation === 'write')?.path).toBe(
      'settings.theme'
    );
    cap.stop();
  });
});

describe('PUBLIC: delivery semantics', () => {
  it('one failure -> one event', async () => {
    const cap = capture();
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings.theme, { set: failing });
    tree.$.settings.theme.set('dark');
    await flush();
    await l.settled();

    expect(cap.seen).toHaveLength(1);
    l.dispose();
    cap.stop();
  });

  it('a throwing listener damages neither the link nor its peers', async () => {
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
    expect(seen).toHaveLength(1);

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

  it('unsubscribe is clean, zero listeners are harmless, listeners are independent', async () => {
    clearTreeErrorListenersForTesting();
    const a: TreeErrorEvent[] = [];
    const b: TreeErrorEvent[] = [];
    const offA = onTreeError((e) => a.push(e));
    const offB = onTreeError((e) => b.push(e));

    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings.theme, { set: failing });

    tree.$.settings.theme.set('one');
    await flush();
    await l.settled();
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);

    offA();
    tree.$.settings.theme.set('two');
    await flush();
    await l.settled();
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(2);

    offB();
    // No listeners at all — nothing throws.
    tree.$.settings.theme.set('three');
    await flush();
    await expect(l.settled()).resolves.toBeUndefined();

    l.dispose();
    clearTreeErrorListenersForTesting();
  });

  it('⚠️ a failed send: observable, X authored, queue alive, settled() RESOLVES', async () => {
    const cap = capture();
    const tree = makeTree();
    await flush();
    let fail = true;
    const sent: string[] = [];
    const l = link(tree.$.settings.theme, {
      set: (v) => {
        if (fail) return Promise.reject(new Error('endpoint down'));
        sent.push(v as string);
        return Promise.resolve();
      },
    });

    tree.$.settings.theme.set('doomed');
    await flush();
    await expect(l.settled()).resolves.toBeUndefined();

    expect(cap.seen).toHaveLength(1);
    expect(tree.$.settings.theme()).toBe('doomed');

    fail = false;
    tree.$.settings.theme.set('recovered');
    await flush();
    await l.settled();
    expect(sent).toEqual(['recovered']);

    l.dispose();
    cap.stop();
  });

  it('the Link handle is still exactly three members', async () => {
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings.theme, { set: failing });

    expect(Object.keys(l).sort()).toEqual(['dispose', 'retrieve', 'settled']);
    l.dispose();
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
  throw new Error('ERROR-SURFACE-2-PUBLIC: could not locate packages/core/src');
})();

describe('PUBLIC: the surface is exactly three symbols', () => {
  it('⚠️ internal machinery stays internal', () => {
    const index = readFileSync(join(SRC, 'index.ts'), 'utf8');

    // ⚠️ Asserted against EXPORT STATEMENTS, not raw file text. A first draft
    // matched the whole file and failed on this spec's own explanatory comment
    // — a test that cannot distinguish an export from prose about an export.
    const exported = [...index.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)]
      .flatMap((m) => m[1].split(','))
      .map((n) => n.trim().replace(/^type\s+/, ''))
      .filter(Boolean);

    expect(exported).toContain('onTreeError');
    expect(exported).toContain('TreeErrorEvent');
    expect(exported).toContain('TreeId');

    // Library code reports; applications observe.
    expect(exported).not.toContain('reportTreeError');
    expect(exported).not.toContain('clearTreeErrorListenersForTesting');
    // Deleted entirely, so it cannot leak.
    expect(exported).not.toContain('TreeErrorSource');
    // NOT dragged public merely because TreeId is.
    expect(exported).not.toContain('PositionRegistry');
    expect(exported).not.toContain('treeIdBrand');
    // And `stored` is still absent, as its retirement requires.
    expect(exported).not.toContain('stored');
  });
});
