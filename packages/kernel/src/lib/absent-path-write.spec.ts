import { afterEach, describe, expect, it } from 'vitest';

import { createReactiveTestRealization } from '../reactive-test-realization';
import { restoration, signalTree, transactions, undoable } from '../index';
import {
  materializeMember,
  ordinaryBranch,
  registerMarkerProcessor,
} from './internals/materialize-markers';
import { observeIntrinsicMutations } from './internals/intrinsic-mutation';
import { getPathNotifier } from './path-notifier';
import { createSignalTreeFactory } from './signal-tree';

/**
 * v16 integration slice 8d (a): reads and writes under an omitted member.
 *
 * Owner decision (2026-10-06): REACTIVATE ALONG THE PATH, LEAVING SIBLING
 * MEMBERS ABSENT. The rules it follows:
 *
 * - `whole-value-membership.spec.ts` 7: "WRITING AN ABSENT DESCENDANT
 *   REACTIVATES ITS MEMBERSHIP", and its header: "A DESCENDANT ABSENT FROM
 *   ITS PARENT'S CURRENT VALUE IS SEMANTICALLY ABSENT EVEN IF ITS PHYSICAL
 *   LOCATION IS RETAINED";
 * - its case 18: "DORMANT STORAGE MUST NOT SUPPLY THE REACTIVATED VALUE";
 * - `activateOne`: activation "MUST BE COUPLED TO AN AUTHORITATIVE SUPPLIED
 *   VALUE";
 * - `nested-absence-independent.spec.ts`: "A write must not vanish silently".
 *
 * Before 8d this held only for a member that was itself omitted. Under an
 * omitted ancestor a held or detached handle read retained storage, its write
 * went to hidden storage, and undo of that write re-added the ancestor as if
 * an omission had hidden the write. A direct member's re-adding write was
 * recorded without its membership, so undo and rollback left the key present
 * with `undefined`. A held consumer of an omitted branch kept its value.
 */

const trees: Array<{ destroy(): void }> = [];
afterEach(() => {
  for (const tree of trees.splice(0)) tree.destroy();
});
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

const realization = createReactiveTestRealization();
const reactiveTree = createSignalTreeFactory(realization);
const computed = realization.locations.createDerived;

type Leaf = { (): unknown; (value: unknown): void };
type Nested = {
  a?: { b: { value: number; keep: number }; side: number };
  count: number;
};
const initial = (): Nested => ({
  a: { b: { value: 0, keep: 0 }, side: 0 },
  count: 0,
});
type Handles = {
  root: Leaf;
  a: Leaf & {
    b: Leaf & { value: Leaf; keep: Leaf };
    side: Leaf;
  };
  count: Leaf;
};
const handles = (tree: { $: unknown }): Handles => {
  const $ = tree.$ as Leaf & Record<string, unknown>;
  return {
    root: $,
    a: $['a'] as Handles['a'],
    count: $['count'] as Leaf,
  };
};
/** Omit `a` with an ordinary whole-value write at the root. */
const omitA = (h: Handles) => h.root({ count: h.count() });

describe('reads under an omitted member', () => {
  it('held and detached handles read absent, never retained storage', () => {
    const tree = signalTree(initial());
    trees.push(tree);
    const held = handles(tree);
    omitA(held);
    const detached = handles(tree);
    for (const h of [held, detached]) {
      expect(h.a()).toBeUndefined();
      expect(h.a.b()).toBeUndefined();
      expect(h.a.b.value()).toBeUndefined();
      expect(h.a.b.keep()).toBeUndefined();
      expect(h.a.side()).toBeUndefined();
      expect(
        (h.a.b.keep as unknown as { peek(): unknown }).peek()
      ).toBeUndefined();
    }
    expect(tree.$()).toEqual({ count: 0 });
  });

  it('held consumers follow omission and re-add, at every depth', () => {
    const tree = reactiveTree(initial());
    trees.push(tree);
    const h = handles(tree);
    const read = {
      a: computed(() => JSON.stringify(h.a())),
      b: computed(() => JSON.stringify(h.a.b())),
      keep: computed(() => h.a.b.keep()),
      side: computed(() => h.a.side()),
    };
    const all = () => ({
      a: read.a(),
      b: read.b(),
      keep: read.keep(),
      side: read.side(),
    });
    expect(all()).toEqual({
      a: '{"b":{"value":0,"keep":0},"side":0}',
      b: '{"value":0,"keep":0}',
      keep: 0,
      side: 0,
    });
    omitA(h);
    expect(all()).toEqual({
      a: undefined,
      b: undefined,
      keep: undefined,
      side: undefined,
    });
    h.root({ a: { b: { value: 1, keep: 2 }, side: 3 }, count: 0 });
    expect(all()).toEqual({
      a: '{"b":{"value":1,"keep":2},"side":3}',
      b: '{"value":1,"keep":2}',
      keep: 2,
      side: 3,
    });
  });

  it('a held consumer of an omitted branch member follows it (direct member)', () => {
    const tree = reactiveTree({ box: { keep: { v: 1 }, drop: { v: 2 } } });
    trees.push(tree);
    const box = tree.$.box as unknown as Leaf & { drop: Leaf };
    const held = computed(() => JSON.stringify(box.drop()));
    expect(held()).toBe('{"v":2}');
    box({ keep: { v: 1 } });
    expect(held()).toBeUndefined();
    box({ keep: { v: 1 }, drop: { v: 9 } });
    expect(held()).toBe('{"v":9}');
  });

  it('updaters receive the semantic value, undefined, under an omitted member', () => {
    const tree = signalTree(initial());
    trees.push(tree);
    const h = handles(tree);
    omitA(h);
    const seen: unknown[] = [];
    h.a.b.keep(((current: unknown) => {
      seen.push(current);
      return 5;
    }) as unknown);
    omitA(h);
    h.a.b(((current: unknown) => {
      seen.push(current);
      return { value: 1, keep: 1 };
    }) as unknown);
    expect(seen).toEqual([undefined, undefined]);
  });
});

describe('writes under an omitted member re-add the path, siblings stay absent', () => {
  it.each(['held', 'detached'] as const)(
    'a leaf write through a %s handle',
    (kind) => {
      const tree = signalTree(initial());
      trees.push(tree);
      const held = handles(tree);
      omitA(held);
      const h = kind === 'held' ? held : handles(tree);
      h.a.b.keep(9);
      expect(tree.$()).toEqual({ a: { b: { keep: 9 } }, count: 0 });
      expect(h.a.b.keep()).toBe(9);
      expect(h.a.side()).toBeUndefined();
      expect(h.a.b.value()).toBeUndefined();
      expect(Object.keys(h.a)).toEqual(['b']);
      expect(Object.keys(h.a.b)).toEqual(['keep']);
    }
  );

  it('a leaf write equal to retained storage still re-adds', () => {
    const tree = signalTree(initial());
    trees.push(tree);
    const h = handles(tree);
    omitA(h);
    h.a.b.keep(0);
    expect(tree.$()).toEqual({ a: { b: { keep: 0 } }, count: 0 });
  });

  it('a leaf updater re-adds with its result', () => {
    const tree = signalTree(initial());
    trees.push(tree);
    const h = handles(tree);
    omitA(h);
    h.a.side(((current: unknown) => (current ?? 40) as number) as unknown);
    expect(tree.$()).toEqual({ a: { side: 40 }, count: 0 });
  });

  it('a branch write re-adds with the supplied whole value', () => {
    const tree = signalTree(initial());
    trees.push(tree);
    const h = handles(tree);
    omitA(h);
    h.a.b({ value: 3 });
    expect(tree.$()).toEqual({ a: { b: { value: 3 } }, count: 0 });
    expect(h.a.b.keep()).toBeUndefined();
  });

  it('a branch updater re-adds with its result', () => {
    const tree = signalTree(initial());
    trees.push(tree);
    const h = handles(tree);
    omitA(h);
    h.a.b(((current: unknown) => ({
      value: current === undefined ? 4 : -1,
      keep: 4,
    })) as unknown);
    expect(tree.$()).toEqual({ a: { b: { value: 4, keep: 4 } }, count: 0 });
  });

  it('a directly omitted branch member re-adds on its own write', () => {
    const tree = signalTree({ box: { keep: { v: 1 }, drop: { v: 2 } } });
    trees.push(tree);
    const box = tree.$.box as unknown as Leaf & { drop: Leaf };
    box({ keep: { v: 1 } });
    box.drop({ v: 9 });
    expect(tree.$()).toEqual({ box: { keep: { v: 1 }, drop: { v: 9 } } });
  });

  it('omitted members on the path are all re-added; others stay absent', () => {
    const tree = signalTree(initial());
    trees.push(tree);
    const h = handles(tree);
    // `b` omitted inside `a`, then `a` omitted at the root.
    h.a({ side: 1 });
    omitA(h);
    h.a.b.value(7);
    expect(tree.$()).toEqual({ a: { b: { value: 7 } }, count: 0 });
  });

  it('a whole value supplying undefined under an omitted member installs undefined', () => {
    const tree = signalTree(initial());
    trees.push(tree);
    const h = handles(tree);
    omitA(h);
    // The leaf reads undefined while absent, so an equal-value skip would
    // leave retained storage (0) to be re-added with it.
    h.root({
      a: { b: { value: undefined as unknown as number, keep: 1 }, side: 2 },
      count: 0,
    });
    expect(h.a.b.value()).toBeUndefined();
    expect(Object.keys(h.a.b)).toEqual(['value', 'keep']);
  });

  it('a member added after an omission above it was first linked is absent too', () => {
    const DYN = Symbol('spec.absent-path.dyn');
    registerMarkerProcessor(
      (v: unknown): v is { [DYN]: true } =>
        typeof v === 'object' && v !== null && DYN in (v as object),
      () => ordinaryBranch({ seed: { v: 0 } }, { keyedLookup: true })
    );
    const tree = signalTree({ g: { users: { [DYN]: true } }, count: 0 }, {
      capabilities: ['causal-runtime', 'position-topology'],
    } as never) as unknown as { $: Leaf & { g: { users: Leaf & { seed: { v: Leaf } } } }; destroy(): void };
    trees.push(tree);
    const users = tree.$.g.users;
    users();
    tree.$({ count: 0 });
    users.seed.v(1);
    expect(tree.$()).toEqual({ g: { users: { seed: { v: 1 } } }, count: 0 });
    const bob = materializeMember(users, 'bob', { name: 'Bob' }) as {
      name: Leaf;
    };
    expect(bob.name()).toBe('Bob');
    tree.$({ count: 0 });
    expect(bob.name()).toBeUndefined();
  });

  it('updateAndReport re-adds an omitted path it supplies and reports it', () => {
    const tree = signalTree(initial()) as unknown as {
      $: unknown;
      updateAndReport(partial: unknown): string[];
      destroy(): void;
    };
    trees.push(tree);
    const h = handles(tree);
    omitA(h);
    // Partial at the root: `count` is not supplied and stays.
    expect(tree.updateAndReport({ a: { b: { keep: 4 } } })).toEqual([
      'a.b.keep',
    ]);
    expect(h.root()).toEqual({ a: { b: { keep: 4 } }, count: 0 });
    expect(h.a.side()).toBeUndefined();
  });

  it('a whole value supplying undefined for an omitted member leaves it absent', () => {
    const tree = signalTree(initial());
    trees.push(tree);
    const h = handles(tree);
    omitA(h);
    h.root({ a: undefined, count: 0 });
    expect(h.root()).toEqual({ count: 0 });
    expect(h.a.side()).toBeUndefined();
  });

  it('updateAndReport does not re-add a supplied key it installs nothing for', () => {
    const tree = signalTree(initial()) as unknown as {
      $: unknown;
      updateAndReport(partial: unknown): string[];
      destroy(): void;
    };
    trees.push(tree);
    const h = handles(tree);
    omitA(h);
    expect(tree.updateAndReport({ a: undefined })).toEqual([]);
    expect(h.root()).toEqual({ count: 0 });
  });

  it('a write re-entering the same leaf keeps the outer re-add announced', async () => {
    const tree = signalTree(initial(), { enhancers: [restoration()] });
    trees.push(tree);
    const h = handles(tree);
    omitA(h);
    await flush();
    // An intrinsic observer runs inside the outer write, after its re-add.
    let reentered = false;
    const release = observeIntrinsicMutations(h.a.b.keep as object, () => {
      if (reentered) return;
      reentered = true;
      h.a.b.keep(10);
    });
    const paths: string[] = [];
    const off = getPathNotifier().subscribe('**', (_v, _p, path) => {
      paths.push(path);
    });
    try {
      undoable(() => h.a.b.keep(9));
      await flush();
    } finally {
      off();
      release?.();
    }
    expect(h.root()).toEqual({ a: { b: { keep: 10 } }, count: 0 });
    expect(paths).toContain('');
    (tree as unknown as HistoryTree).undo();
    expect(h.root()).toEqual({ count: 0 });
  });

  it('a branch updater inside a whole value receives undefined when absent', () => {
    const tree = signalTree(initial());
    trees.push(tree);
    const h = handles(tree);
    omitA(h);
    const seen: unknown[] = [];
    h.root({
      a: (current: unknown) => {
        seen.push(current);
        return { side: 1 };
      },
      count: 0,
    });
    expect(seen).toEqual([undefined]);
    expect(h.root()).toEqual({ a: { side: 1 }, count: 0 });
  });

  it('a held consumer sees the re-adding write', () => {
    const tree = reactiveTree(initial());
    trees.push(tree);
    const h = handles(tree);
    const whole = computed(() => JSON.stringify(h.root()));
    const side = computed(() => h.a.side());
    expect(side()).toBe(0);
    omitA(h);
    expect(whole()).toBe('{"count":0}');
    expect(side()).toBeUndefined();
    h.a.b.keep(9);
    expect(whole()).toBe('{"a":{"b":{"keep":9}},"count":0}');
    expect(side()).toBeUndefined();
  });

  it('path observers are told of the value, then of each level, innermost first', async () => {
    const tree = signalTree(initial(), { enhancers: [restoration()] });
    trees.push(tree);
    const h = handles(tree);
    omitA(h);
    await flush();
    const paths: string[] = [];
    const off = getPathNotifier().subscribe('**', (_v, _p, path) => {
      paths.push(path);
    });
    h.a.b.keep(9);
    await flush();
    off();
    // As a whole value `{ b: { keep: 9 } }` at `a` would announce it: `b`
    // drops `value`, `a` drops `side`, the root re-adds `a`.
    expect(paths).toEqual(['a.b.keep', 'a.b', 'a', '']);
  });
});

const historyOrders = {
  'restoration alone': () => [restoration()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};
const rollbackOrders = {
  'transactions alone': () => [transactions()],
  'transactions first': () => [transactions(), restoration()],
  'restoration first': () => [restoration(), transactions()],
};
type HistoryTree = {
  $: unknown;
  undo(): void;
  redo(): void;
  jumpTo(index: number): void;
  getCurrentIndex(): number;
  destroy(): void;
};
type TransactTree = {
  $: unknown;
  transact(run: () => void): { rollback(): void; confirm?(): void };
  destroy(): void;
};

/** Each write and the `a` it must produce from an omitted `a`. */
const writes: Record<
  string,
  { write: (h: Handles) => void; a: unknown; reads: (h: Handles) => unknown }
> = {
  'nested leaf': {
    write: (h) => h.a.b.keep(9),
    a: { b: { keep: 9 } },
    reads: (h) => [h.a(), h.a.b.keep(), h.a.side()],
  },
  'nested branch': {
    write: (h) => h.a.b({ value: 3 }),
    a: { b: { value: 3 } },
    reads: (h) => [h.a(), h.a.b.value(), h.a.b.keep()],
  },
  'omitted member itself': {
    write: (h) => h.a({ b: { value: 1, keep: 1 }, side: 1 }),
    a: { b: { value: 1, keep: 1 }, side: 1 },
    reads: (h) => [h.a(), h.a.side()],
  },
};

describe('undo, redo and jumpTo of a re-adding write restore absence', () => {
  for (const [order, enhancers] of Object.entries(historyOrders))
    for (const [label, { write, a, reads }] of Object.entries(writes)) {
      it(`${label} (${order})`, async () => {
        const tree = signalTree(initial(), {
          enhancers: enhancers() as never,
        }) as unknown as HistoryTree;
        trees.push(tree);
        const h = handles(tree);
        // An earlier designated turn, so jumpTo has a position before the write.
        undoable(() => h.count(1));
        await flush();
        omitA(h);
        await flush();
        const absent = reads(h);
        undoable(() => write(h));
        await flush();
        const after = { a, count: 1 };
        expect(h.root()).toEqual(after);
        const present = reads(h);

        tree.undo();
        expect(h.root()).toEqual({ count: 1 });
        expect(reads(h)).toEqual(absent);
        tree.redo();
        expect(h.root()).toEqual(after);
        expect(reads(h)).toEqual(present);
        const index = tree.getCurrentIndex();
        tree.jumpTo(index - 1);
        expect(h.root()).toEqual({ count: 1 });
        expect(reads(h)).toEqual(absent);
        tree.jumpTo(index);
        expect(h.root()).toEqual(after);
        tree.undo();
        expect(h.root()).toEqual({ count: 1 });
      });
    }

  for (const [order, enhancers] of Object.entries(historyOrders)) {
    it(`a directly omitted leaf: undo makes it absent again (${order})`, async () => {
      type User = { user: { name: string; age?: number } };
      const tree = signalTree<User>(
        { user: { name: 'Ada', age: 42 } },
        { enhancers: enhancers() as never }
      ) as unknown as HistoryTree & { $: { user: Leaf & { age: Leaf } } };
      trees.push(tree);
      tree.$.user({ name: 'Ada' });
      await flush();
      // An earlier designated turn, so jumpTo has a position before the write.
      undoable(() => tree.$.user({ name: 'Bo' }));
      await flush();
      undoable(() => tree.$.user.age(50));
      await flush();
      expect(tree.$.user()).toEqual({ name: 'Bo', age: 50 });
      tree.undo();
      expect(tree.$.user()).toEqual({ name: 'Bo' });
      expect(Object.keys(tree.$.user() as object)).toEqual(['name']);
      expect(tree.$.user.age()).toBeUndefined();
      tree.redo();
      expect(tree.$.user()).toEqual({ name: 'Bo', age: 50 });
      tree.jumpTo(tree.getCurrentIndex() - 1);
      expect(tree.$.user()).toEqual({ name: 'Bo' });
      expect(tree.$.user.age()).toBeUndefined();
    });

    it(`held consumers follow undo and redo of the write (${order})`, async () => {
      const tree = reactiveTree(initial(), {
        enhancers: enhancers() as never,
      }) as unknown as HistoryTree;
      trees.push(tree);
      const h = handles(tree);
      const keep = computed(() => h.a.b.keep());
      const b = computed(() => JSON.stringify(h.a.b()));
      omitA(h);
      await flush();
      undoable(() => h.a.b.keep(9));
      await flush();
      expect([keep(), b()]).toEqual([9, '{"keep":9}']);
      tree.undo();
      expect([keep(), b()]).toEqual([undefined, undefined]);
      tree.redo();
      expect([keep(), b()]).toEqual([9, '{"keep":9}']);
    });
  }
});

describe('reversal of a designated omission wakes held consumers below it', () => {
  // A reversal that re-adds or omits a branch installs retained-equal values
  // below it, which publish nothing by themselves; only the member's own
  // presence changes. Its observers and every present location below it must
  // still re-read (v16 8d).
  const shapes = {
    'omission alone': (h: Handles) => omitA(h),
    'omission with another change': (h: Handles) => h.root({ count: 1 }),
  };
  for (const [order, enhancers] of Object.entries(historyOrders))
    for (const [shape, omit] of Object.entries(shapes))
      it(`undo and redo (${shape}, ${order})`, async () => {
        const tree = reactiveTree(initial(), {
          enhancers: enhancers() as never,
        }) as unknown as HistoryTree;
        trees.push(tree);
        const h = handles(tree);
        const read = computed(() => [
          JSON.stringify(h.a()),
          JSON.stringify(h.a.b()),
          h.a.b.keep(),
          h.a.side(),
        ]);
        const present = [
          '{"b":{"value":0,"keep":0},"side":0}',
          '{"value":0,"keep":0}',
          0,
          0,
        ];
        const absent = [undefined, undefined, undefined, undefined];
        expect(read()).toEqual(present);
        undoable(() => omit(h));
        await flush();
        expect(read()).toEqual(absent);
        tree.undo();
        expect(read()).toEqual(present);
        tree.redo();
        expect(read()).toEqual(absent);
      });

  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`rollback (${order})`, async () => {
      const tree = reactiveTree(initial(), {
        enhancers: enhancers() as never,
      }) as unknown as TransactTree;
      trees.push(tree);
      const h = handles(tree);
      const read = computed(() => [JSON.stringify(h.a.b()), h.a.b.keep()]);
      expect(read()).toEqual(['{"value":0,"keep":0}', 0]);
      const pending = tree.transact(() => omitA(h));
      await flush();
      expect(read()).toEqual([undefined, undefined]);
      pending.rollback();
      await flush();
      expect(read()).toEqual(['{"value":0,"keep":0}', 0]);
    });

  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`redo of a re-adding leaf write announces the re-add once (${order})`, async () => {
      type User = { user: { name: string; age?: number } };
      const tree = signalTree<User>(
        { user: { name: 'Ada', age: 42 } },
        { enhancers: enhancers() as never }
      ) as unknown as HistoryTree & { $: { user: Leaf & { age: Leaf } } };
      trees.push(tree);
      tree.$.user({ name: 'Ada' });
      await flush();
      undoable(() => tree.$.user.age(50));
      await flush();
      tree.undo();
      await flush();
      const paths: string[] = [];
      const off = getPathNotifier().subscribe('**', (_v, _p, path) => {
        paths.push(path);
      });
      tree.redo();
      await flush();
      off();
      expect(tree.$.user()).toEqual({ name: 'Ada', age: 50 });
      expect(paths.filter((path) => path === 'user')).toHaveLength(1);
    });
});

describe('updateAndReport records the re-add it makes', () => {
  for (const [order, enhancers] of Object.entries(historyOrders))
    it(`undo makes the supplied omitted members absent again (${order})`, async () => {
      const tree = signalTree(
        { a: { b: { value: 0, keep: 0 }, side: 0 }, x: 1, count: 0 } as {
          a?: { b: { value: number; keep: number }; side: number };
          x?: number;
          count: number;
        },
        { enhancers: enhancers() as never }
      ) as unknown as HistoryTree & {
        $: Leaf;
        updateAndReport(partial: unknown): string[];
      };
      trees.push(tree);
      tree.$({ count: 0 });
      await flush();
      undoable(() => tree.updateAndReport({ a: { b: { keep: 4 } }, x: 2 }));
      await flush();
      expect(tree.$()).toEqual({ a: { b: { keep: 4 } }, x: 2, count: 0 });
      tree.undo();
      expect(tree.$()).toEqual({ count: 0 });
      tree.redo();
      expect(tree.$()).toEqual({ a: { b: { keep: 4 } }, x: 2, count: 0 });
    });
});

describe('rollback of a re-adding write restores absence', () => {
  for (const [order, enhancers] of Object.entries(rollbackOrders))
    for (const [label, { write, reads }] of Object.entries(writes)) {
      it(`${label} (${order})`, async () => {
        const tree = signalTree(initial(), {
          enhancers: enhancers() as never,
        }) as unknown as TransactTree;
        trees.push(tree);
        const h = handles(tree);
        omitA(h);
        await flush();
        const absent = reads(h);
        const pending = tree.transact(() => write(h));
        await flush();
        expect(h.root()).not.toEqual({ count: 0 });
        pending.rollback();
        await flush();
        expect(h.root()).toEqual({ count: 0 });
        expect(reads(h)).toEqual(absent);
      });
    }

  for (const [order, enhancers] of Object.entries(rollbackOrders))
    it(`a directly omitted leaf (${order})`, async () => {
      type User = { user: { name: string; age?: number } };
      const tree = signalTree<User>(
        { user: { name: 'Ada', age: 42 } },
        { enhancers: enhancers() as never }
      ) as unknown as TransactTree & { $: { user: Leaf & { age: Leaf } } };
      trees.push(tree);
      tree.$.user({ name: 'Ada' });
      await flush();
      const pending = tree.transact(() => tree.$.user.age(50));
      await flush();
      pending.rollback();
      await flush();
      expect(Object.keys(tree.$.user() as object)).toEqual(['name']);
      expect(tree.$.user.age()).toBeUndefined();
    });
});
