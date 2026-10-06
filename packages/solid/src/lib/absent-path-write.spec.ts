import { createMemo, createRoot } from 'solid-js';
import { describe, expect, it } from 'vitest';

import { restoration, signalTree, transactions, undoable } from '../index';

/**
 * Reads and writes under an omitted member through the Solid adapter (v16
 * integration slice 8d (a); kernel carrier
 * `packages/kernel/src/lib/absent-path-write.spec.ts`). A held Solid memo
 * under an omitted branch reads absent, never retained storage. A write
 * through a held handle re-adds its path and leaves the branch's other
 * members absent. Undo, redo, jumpTo and rollback of that write make the
 * branch absent again.
 */

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
const ORDERS = [
  ['transactions first', () => [transactions(), restoration()]],
  ['restoration first', () => [restoration(), transactions()]],
] as const;

/** Run `body` inside a reactive root and dispose it afterwards. */
const inRoot = async (body: () => Promise<void>) => {
  let dispose = () => undefined as void;
  const done = createRoot((release) => {
    dispose = release;
    return body();
  });
  try {
    await done;
  } finally {
    dispose();
  }
};

type State = {
  a?: { b: { value: number; keep: number }; side: number };
  count: number;
};
type Cell = {
  (): unknown;
  set(value: unknown): void;
  update(updater: (current: unknown) => unknown): void;
};
type Handles = {
  a: {
    (): unknown;
    b: { (): unknown; (value: unknown): void; keep: Cell };
    side: Cell;
  };
};

describe.each(ORDERS)('absent-path writes — Solid (%s)', (_, enhancers) => {
  const build = () => {
    const initial: State = {
      a: { b: { value: 0, keep: 0 }, side: 0 },
      count: 0,
    };
    const tree = signalTree(initial, { enhancers: enhancers() });
    const { a } = tree.$ as unknown as Handles;
    const view = createMemo(() => [
      JSON.stringify(tree.$()),
      JSON.stringify(a.b()),
      a.b.keep(),
      a.side(),
    ]);
    const omit = () => tree.$({ count: 0 } as never);
    return { tree, a, view, omit };
  };
  const absent = ['{"count":0}', undefined, undefined, undefined];
  const readded = [
    '{"a":{"b":{"keep":9}},"count":0}',
    '{"keep":9}',
    9,
    undefined,
  ];

  it('held consumers read absent; a held leaf write re-adds only its path', () =>
    inRoot(async () => {
      const { tree, a, view, omit } = build();
      try {
        expect(view()).toEqual([
          '{"a":{"b":{"value":0,"keep":0},"side":0},"count":0}',
          '{"value":0,"keep":0}',
          0,
          0,
        ]);
        // An earlier designated turn, so jumpTo has a position before the write.
        undoable(() => tree.$.count.set(1));
        await flush();
        omit();
        await flush();
        expect(view()).toEqual(absent);
        undoable(() => a.b.keep.set(9));
        await flush();
        expect(view()).toEqual(readded);
        tree.undo();
        await flush();
        expect(view()).toEqual(absent);
        tree.redo();
        await flush();
        expect(view()).toEqual(readded);
        tree.jumpTo(tree.getCurrentIndex() - 1);
        await flush();
        expect(view()).toEqual(absent);
      } finally {
        tree.destroy();
      }
    }));

  it('a held branch write re-adds with its whole value; undo omits it again', () =>
    inRoot(async () => {
      const { tree, a, view, omit } = build();
      try {
        omit();
        await flush();
        undoable(() => a.b({ keep: 9 }));
        await flush();
        expect(view()).toEqual(readded);
        tree.undo();
        await flush();
        expect(view()).toEqual(absent);
      } finally {
        tree.destroy();
      }
    }));

  it('a held leaf updater receives undefined and re-adds with its result', () =>
    inRoot(async () => {
      const { tree, a, view, omit } = build();
      try {
        omit();
        await flush();
        undoable(() => a.side.update((current) => (current ?? 40) as number));
        await flush();
        expect(view()).toEqual([
          '{"a":{"side":40},"count":0}',
          undefined,
          undefined,
          40,
        ]);
        tree.undo();
        await flush();
        expect(view()).toEqual(absent);
      } finally {
        tree.destroy();
      }
    }));

  it('undo of a designated omission brings back every held reader below it', () =>
    inRoot(async () => {
      const { tree, view } = build();
      try {
        const present = view();
        undoable(() => tree.$({ count: 0 } as never));
        await flush();
        expect(view()).toEqual(absent);
        tree.undo();
        await flush();
        expect(view()).toEqual(present);
      } finally {
        tree.destroy();
      }
    }));

  it('undo of a turn that omits the branch and writes under it is exact', () =>
    inRoot(async () => {
      const { tree, a, view } = build();
      try {
        const before = view();
        undoable(() => {
          tree.$({ count: 0 } as never);
          a.b.keep.set(9);
        });
        await flush();
        expect(view()).toEqual(readded);
        tree.undo();
        await flush();
        // History recorded what storage held, not the absent value (8e).
        expect(view()).toEqual(before);
      } finally {
        tree.destroy();
      }
    }));

  it('rollback of a re-adding write makes the branch absent again', () =>
    inRoot(async () => {
      const { tree, a, view, omit } = build();
      try {
        omit();
        await flush();
        const pending = tree.transaction(() => a.b.keep.set(9));
        await flush();
        expect(view()).toEqual(readded);
        pending.rollback();
        await flush();
        expect(view()).toEqual(absent);
      } finally {
        tree.destroy();
      }
    }));
});

describe('absent-path writes — Solid (no enhancers)', () => {
  it('a held leaf updater under an omitted member receives undefined', () =>
    inRoot(async () => {
      const initial: State = {
        a: { b: { value: 0, keep: 0 }, side: 0 },
        count: 0,
      };
      const tree = signalTree(initial);
      try {
        const { a } = tree.$ as unknown as Handles;
        tree.$({ count: 0 } as never);
        const seen: unknown[] = [];
        a.side.update((current) => (seen.push(current), 40));
        expect(seen).toEqual([undefined]);
        expect(tree.$()).toEqual({ a: { side: 40 }, count: 0 });
      } finally {
        tree.destroy();
      }
    }));
});
