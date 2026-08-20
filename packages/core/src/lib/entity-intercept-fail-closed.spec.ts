import { describe, expect, it, vi } from 'vitest';

import { entityMap, signalTree } from '../index';

/**
 * An `intercept()` handler that returns a Promise cannot block.
 *
 * `InterceptHandlers` declares every hook as `=> void | Promise<void>`, so the
 * published type invites the async form, and every call site runs handlers in a
 * plain synchronous loop. An async handler's `ctx.block()` therefore arrives
 * AFTER the write has committed: the guard fails open and the mutation silently
 * succeeds. That is the shape an async permission or uniqueness check naturally
 * takes, and a guard that silently permits is worse than no guard.
 *
 * The mutation is now REFUSED instead, in every build. These rows pin that, and
 * pin that the synchronous path and `tap` are unaffected.
 */
type Row = { id: string; n: number };

const asyncBlocker = () => ({
  onAdd: async (_e: Row, ctx: { block: (r?: string) => void }) => {
    await Promise.resolve();
    // Wrapped because the throw lands NOWHERE — that is the defect. Without the
    // catch it surfaces as an unhandled rejection, which is the only trace the
    // original failure ever left.
    try {
      ctx.block('too late to matter');
    } catch {
      /* swallowed by the promise, exactly as in production */
    }
  },
  onUpdate: async (
    _id: string,
    _c: Partial<Row>,
    ctx: { block: (r?: string) => void }
  ) => {
    await Promise.resolve();
    try {
      ctx.block('too late to matter');
    } catch {
      /* swallowed by the promise */
    }
  },
  onRemove: async (
    _id: string,
    _e: Row,
    ctx: { block: (r?: string) => void }
  ) => {
    await Promise.resolve();
    try {
      ctx.block('too late to matter');
    } catch {
      /* swallowed by the promise */
    }
  },
});

const seeded = () => {
  const tree = signalTree({
    rows: entityMap<Row, string>({ selectId: (r) => r.id }),
  });
  tree.$.rows.addMany([
    { id: 'a', n: 1 },
    { id: 'b', n: 2 },
  ]);
  return tree;
};

describe('intercept() — an async handler REFUSES the mutation', () => {
  it('addOne is refused and the collection is unchanged', () => {
    const tree = seeded();
    tree.$.rows.intercept(asyncBlocker());

    expect(() => tree.$.rows.addOne({ id: 'c', n: 3 })).toThrow(/ST2033/);
    expect(tree.$.rows.ids()).toEqual(['a', 'b']);
  });

  it('every ADD path is refused', () => {
    for (const mutate of [
      (t: ReturnType<typeof seeded>) => t.$.rows.addOne({ id: 'c', n: 3 }),
      (t: ReturnType<typeof seeded>) => t.$.rows.addMany([{ id: 'c', n: 3 }]),
      (t: ReturnType<typeof seeded>) => t.$.rows.prependOne({ id: 'c', n: 3 }),
      (t: ReturnType<typeof seeded>) => t.$.rows.upsertOne({ id: 'c', n: 3 }),
      (t: ReturnType<typeof seeded>) => t.$.rows.upsertMany([{ id: 'c', n: 3 }]),
      (t: ReturnType<typeof seeded>) => t.$.rows.setAll([{ id: 'c', n: 3 }]),
    ]) {
      const tree = seeded();
      tree.$.rows.intercept(asyncBlocker());
      expect(() => mutate(tree)).toThrow(/ST2033/);
      expect(tree.$.rows.byId('c')).toBeUndefined();
    }
  });

  it('every UPDATE path is refused and the value does not change', () => {
    for (const mutate of [
      (t: ReturnType<typeof seeded>) => t.$.rows.updateOne('a', { n: 99 }),
      (t: ReturnType<typeof seeded>) => t.$.rows.updateMany(['a'], { n: 99 }),
      (t: ReturnType<typeof seeded>) =>
        t.$.rows.replaceOne('a', { id: 'a', n: 99 }),
      (t: ReturnType<typeof seeded>) =>
        t.$.rows.updateWhere((r) => r.id === 'a', { n: 99 }),
      (t: ReturnType<typeof seeded>) => t.$.rows.upsertOne({ id: 'a', n: 99 }),
    ]) {
      const tree = seeded();
      tree.$.rows.intercept(asyncBlocker());
      expect(() => mutate(tree)).toThrow(/ST2033/);
      expect(tree.$.rows.byId('a')?.n()).toBe(1);
    }
  });

  it('every REMOVE path is refused and the member survives', () => {
    for (const mutate of [
      (t: ReturnType<typeof seeded>) => t.$.rows.removeOne('a'),
      (t: ReturnType<typeof seeded>) => t.$.rows.removeMany(['a']),
      (t: ReturnType<typeof seeded>) =>
        t.$.rows.removeWhere((r) => r.id === 'a'),
    ]) {
      const tree = seeded();
      tree.$.rows.intercept(asyncBlocker());
      expect(() => mutate(tree)).toThrow(/ST2033/);
      expect(tree.$.rows.byId('a')?.n()).toBe(1);
    }
  });

  it('a thenable that is not a real Promise is also refused', () => {
    const tree = seeded();
    tree.$.rows.intercept({
      onAdd: () => ({ then: () => undefined }) as unknown as void,
    });
    expect(() => tree.$.rows.addOne({ id: 'c', n: 3 })).toThrow(/ST2033/);
    expect(tree.$.rows.ids()).toEqual(['a', 'b']);
  });
});

describe('intercept() — the synchronous path is unaffected', () => {
  it('a sync block still blocks with its own message', () => {
    const tree = seeded();
    tree.$.rows.intercept({
      onAdd: (e, ctx) => {
        if (e.n < 0) ctx.block('negative');
      },
    });

    expect(() => tree.$.rows.addOne({ id: 'bad', n: -1 })).toThrow(/negative/);
    expect(tree.$.rows.byId('bad')).toBeUndefined();

    tree.$.rows.addOne({ id: 'ok', n: 5 });
    expect(tree.$.rows.byId('ok')?.n()).toBe(5);
  });

  it('a sync transform still transforms', () => {
    const tree = seeded();
    tree.$.rows.intercept({
      onAdd: (e, ctx) => ctx.transform({ ...e, n: e.n * 10 }),
    });

    tree.$.rows.addOne({ id: 'c', n: 3 });
    expect(tree.$.rows.byId('c')?.n()).toBe(30);
  });

  it('a handler returning undefined is fine', () => {
    const tree = seeded();
    tree.$.rows.intercept({ onAdd: () => undefined });
    tree.$.rows.addOne({ id: 'c', n: 3 });
    expect(tree.$.rows.byId('c')?.n()).toBe(3);
  });
});

describe('tap() — NOT affected: it never promised to block', () => {
  it('an async tap handler does not refuse the mutation', () => {
    const tree = seeded();
    const seen = vi.fn();
    tree.$.rows.tap({
      onAdd: (async (e: Row) => {
        await Promise.resolve();
        seen(e.id);
      }) as unknown as (e: Row, id: string) => void,
    });

    // tap is notified AFTER the write and cannot block, so an async observer is
    // a legitimate (if fire-and-forget) usage. It must keep working.
    tree.$.rows.addOne({ id: 'c', n: 3 });
    expect(tree.$.rows.byId('c')?.n()).toBe(3);
  });
});
