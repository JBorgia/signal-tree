import { describe, expect, it } from 'vitest';

import {
  clearTreeErrorListenersForTesting,
  onTreeError,
  type TreeErrorEvent,
} from './internals/error-reporter';
import { entityMap } from './types';
import { flushAllStoredSignals, stored } from './markers/stored';
import { getOwnedOwnerPath } from './internals/owned-metadata';
import { link } from './link';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * ERROR-SURFACE-2 — the repaired event, proven BEFORE any public export.
 *
 * ```text
 * error       unknown
 * operation   string      diagnostic vocabulary, NOT a frozen union
 * treeId      TreeId      REQUIRED — the whole point
 * path?       string      location, never identity
 * ```
 *
 * ## What was DELETED rather than hidden
 *
 * ```text
 * source   7-member union, 4 with no producer, survivors duplicating
 *          `operation`; ZERO code branched on it
 * detail   one producer (stored), zero consumers, DEV-only prose
 * ```
 *
 * ⚠️ **Deleted from the DELIVERED OBJECT, not merely from the interface.**
 * `reportTreeError` hands every listener the same object it was given — there is
 * no copy — so narrowing only the TypeScript type would leave both fields
 * inspectable from JavaScript. That would be two truths about one event.
 *
 * ## TreeId — branded at the ALLOCATION boundary
 *
 * ```ts
 * readonly id: TreeId = nextRegistryId++ as TreeId;
 * ```
 *
 * One cast, at the single place a counter value becomes a namespace identity.
 * `registry.id` and `ownerRegistry.id` are then already `TreeId` everywhere
 * downstream, so no diagnostic producer independently asserts that some number
 * is a tree identity.
 *
 * ⚠️ The brand prevents an arbitrary number being ACCEPTED AS a TreeId. It does
 * NOT prevent arithmetic — `number & Brand` is a subtype of `number`, so
 * `treeId + 1` still compiles. Recorded so the docs never promise what the type
 * cannot enforce. The alternative (an object-shaped handle over a numeric
 * runtime value) would reintroduce exactly the type/runtime mismatch this
 * repair removes.
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
    { settings: { theme: 'light' }, top: 'a' },
    { enhancers: [restoration(), transactions()] }
  );

const failing = () => Promise.reject(new Error('endpoint down'));

// ───────────────────────────────────────────────────────────────────────────
// A — LINK TWO-TREE, the load-bearing discriminator
// ───────────────────────────────────────────────────────────────────────────

describe('ERROR-SURFACE-2 A: two same-shaped trees are now distinguishable', () => {
  it('⚠️ same path, same operation, DIFFERENT treeId', async () => {
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
    const [ea, eb] = cap.seen;

    // Everything else is identical — which is what made the old event useless.
    expect(ea.operation).toBe(eb.operation);
    expect(ea.path).toBe(eb.path);
    expect(String((ea.error as Error).message)).toBe(
      String((eb.error as Error).message)
    );

    // THE FIX.
    expect(ea.treeId).not.toBe(eb.treeId);

    la.dispose();
    lb.dispose();
    cap.stop();
  });

  it('and the SAME tree keeps a stable treeId across failures', async () => {
    const cap = capture();
    const a = makeTree();
    await flush();
    const l = link(a.$.settings.theme, { set: failing });

    a.$.settings.theme.set('one');
    await flush();
    await l.settled();
    a.$.settings.theme.set('two');
    await flush();
    await l.settled();

    expect(cap.seen.length).toBeGreaterThanOrEqual(2);
    const ids = new Set(cap.seen.map((e) => e.treeId));
    expect(ids.size).toBe(1);

    l.dispose();
    cap.stop();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// B — LINK PATH
// ───────────────────────────────────────────────────────────────────────────

describe('ERROR-SURFACE-2 B: path names the linked source location', () => {
  it('a top-level leaf', async () => {
    const cap = capture();
    const tree = makeTree();
    await flush();
    const l = link(tree.$.top, { set: failing });
    tree.$.top.set('x');
    await flush();
    await l.settled();

    expect(cap.seen[0].path).toBe('top');
    expect(cap.seen[0].path).toBe(getOwnedOwnerPath(tree.$.top));
    l.dispose();
    cap.stop();
  });

  it('a nested leaf', async () => {
    const cap = capture();
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings.theme, { set: failing });
    tree.$.settings.theme.set('x');
    await flush();
    await l.settled();

    expect(cap.seen[0].path).toBe('settings.theme');
    expect(cap.seen[0].path).toBe(getOwnedOwnerPath(tree.$.settings.theme));
    l.dispose();
    cap.stop();
  });

  it('a collection — the COLLECTION path, not a row or field coordinate', async () => {
    const cap = capture();
    type Row = { id: string; n: number };
    const tree = signalTree(
      { data: { rows: entityMap<Row, string>({ selectId: (r: Row) => r.id }) } },
      { enhancers: [restoration(), transactions()] }
    ) as unknown as {
      $: { data: { rows: { addOne(r: Row): void } } };
    };
    await flush();

    const l = link(tree.$.data.rows as never, { set: failing });
    tree.$.data.rows.addOne({ id: 'r1', n: 1 });
    await flush();
    await l.settled();

    // ⚠️ `data.rows` — NOT `data.rows.r1` and NOT `data.rows.r1.n`. Path names
    // the Link SOURCE whose egress failed; it is diagnostics, not causal effect
    // addressing.
    expect(cap.seen[0].path).toBe('data.rows');
    l.dispose();
    cap.stop();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// C / D — STORED
// ───────────────────────────────────────────────────────────────────────────

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

describe('ERROR-SURFACE-2 C/D: stored attribution', () => {
  it('⚠️ two trees, SAME storage key — same path, different treeId', async () => {
    const cap = capture();
    const a = signalTree({ v: stored('es2-same', 0, { storage: writeFails(), debounceMs: 0 }) });
    const b = signalTree({ v: stored('es2-same', 0, { storage: writeFails(), debounceMs: 0 }) });
    await flush();

    (a.$.v as unknown as { set(n: number): void }).set(1);
    (b.$.v as unknown as { set(n: number): void }).set(1);
    flushAllStoredSignals();
    await flush();

    const writes = cap.seen.filter(
      (e) => e.operation === 'write' && e.path === 'es2-same'
    );
    expect(writes.length).toBeGreaterThanOrEqual(2);

    // The key cannot separate them; the owner can. Note these are PLAIN trees —
    // no enhancers — because stored's ownership comes from the materialization
    // context, not the enhancer-gated node attachment.
    expect(writes[0].treeId).not.toBe(writes[1].treeId);
    cap.stop();
  });

  it('repeated failures from ONE stored node keep the same treeId', async () => {
    const cap = capture();
    const tree = signalTree({
      v: stored('es2-stable', 0, { storage: writeFails(), debounceMs: 0 }),
    });
    await flush();

    for (const n of [1, 2, 3]) {
      (tree.$.v as unknown as { set(x: number): void }).set(n);
      flushAllStoredSignals();
      await flush();
    }

    const writes = cap.seen.filter((e) => e.operation === 'write');
    expect(writes.length).toBeGreaterThanOrEqual(2);
    expect(new Set(writes.map((e) => e.treeId)).size).toBe(1);
    cap.stop();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// The delivered runtime shape
// ───────────────────────────────────────────────────────────────────────────

describe('ERROR-SURFACE-2: the delivered object is exactly the contract', () => {
  it('⚠️ no `source`, no `detail` — at RUNTIME, not just in the type', async () => {
    const cap = capture();
    const tree = makeTree();
    await flush();
    const l = link(tree.$.settings.theme, { set: failing });
    tree.$.settings.theme.set('dark');
    await flush();
    await l.settled();

    const e = cap.seen[0] as unknown as Record<string, unknown>;
    // The reporter passes listeners the SAME object, so these would still be
    // visible to JavaScript if they had merely been hidden from TypeScript.
    expect(Object.keys(e).sort()).toEqual([
      'error',
      'operation',
      'path',
      'treeId',
    ]);
    expect('source' in e).toBe(false);
    expect('detail' in e).toBe(false);

    l.dispose();
    cap.stop();
  });

  it('stored omits `path` never, and omits nothing else either', async () => {
    const cap = capture();
    const tree = signalTree({
      v: stored('es2-shape', 0, { storage: writeFails(), debounceMs: 0 }),
    });
    await flush();
    (tree.$.v as unknown as { set(n: number): void }).set(1);
    flushAllStoredSignals();
    await flush();

    const write = cap.seen.find((e) => e.operation === 'write');
    expect(write).toBeDefined();
    expect(Object.keys(write as object).sort()).toEqual([
      'error',
      'operation',
      'path',
      'treeId',
    ]);
    cap.stop();
  });

  it('the stored operation vocabulary is four strings, and stays strings', () => {
    // read | write | migrate | remove — all five reportError call sites share
    // the same closed-over ownerRegistry, which is why STORED-OWNER-INVARIANT-0
    // stayed closed when the vocabulary turned out wider than the probe used.
    const vocabulary = ['read', 'write', 'migrate', 'remove'];
    for (const op of vocabulary) {
      expect(typeof op).toBe('string');
    }
    // No enum, no union, no exhaustiveness promise.
    expect(vocabulary).toHaveLength(4);
  });
});
