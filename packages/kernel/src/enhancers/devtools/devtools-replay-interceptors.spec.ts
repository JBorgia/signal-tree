import { afterEach, describe, expect, it } from 'vitest';
import { devTools } from './devtools';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';

/**
 * A devtools jump to a recorded state is a replay: like undo, it writes back
 * exactly what was recorded, so a collection's interceptors do not run on it
 * and cannot block it. JUMP_TO_STATE, JUMP_TO_ACTION and ROLLBACK (revert to
 * the last commit) replay states the timeline recorded. IMPORT_STATE applies
 * an imported, possibly hand-edited, state — new input — and keeps them.
 *
 * Before 15.4.4 every message was applied under `origin: 'devtools'` alone, so
 * interceptors ran on a jump, and a blocking one made devtools time travel
 * throw (reviewer's probeA2, devtools-impl.ts applyInspectionState).
 *
 * Delivered through the public enhancer from a stub browser extension, in
 * both the per-tree and the aggregated (one instance for several trees)
 * handlers.
 */
type Row = { id: string; n: number; p?: number };
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

let listeners: Array<(message: unknown) => void> = [];
const originalWindow = (globalThis as { window?: unknown }).window;
afterEach(() => {
  (globalThis as { window?: unknown }).window = originalWindow;
  listeners = [];
});
const installExtension = () => {
  (globalThis as { window?: unknown }).window = {
    __REDUX_DEVTOOLS_EXTENSION__: {
      connect: () => ({
        send: () => undefined,
        init: () => undefined,
        subscribe: (listener: (message: unknown) => void) => {
          listeners.push(listener);
          return () => undefined;
        },
      }),
    },
  };
};
const dispatch = (message: unknown) => {
  for (const listener of listeners) listener(message);
};

const messages = {
  JUMP_TO_STATE: (state: unknown) => ({
    type: 'DISPATCH',
    payload: { type: 'JUMP_TO_STATE' },
    state: JSON.stringify(state),
  }),
  JUMP_TO_ACTION: (state: unknown) => ({
    type: 'DISPATCH',
    payload: { type: 'JUMP_TO_ACTION' },
    state: JSON.stringify(state),
  }),
  ROLLBACK: (state: unknown) => ({
    type: 'DISPATCH',
    payload: { type: 'ROLLBACK' },
    state: JSON.stringify(state),
  }),
  IMPORT_STATE: (state: unknown) => ({
    type: 'DISPATCH',
    payload: {
      type: 'IMPORT_STATE',
      nextLiftedState: {
        computedStates: [{ state }],
        currentStateIndex: 0,
      },
    },
  }),
};
type Kind = keyof typeof messages;
const replays: Kind[] = ['JUMP_TO_STATE', 'JUMP_TO_ACTION', 'ROLLBACK'];

const make = (aggregated: boolean, maxAge?: number) =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    {
      enhancers: [
        devTools({
          enabled: true,
          enableBrowserDevTools: true,
          name: 'T',
          ...(maxAge === undefined ? {} : { maxAge }),
          ...(aggregated
            ? { aggregatedReduxInstance: { id: 'replay-group', name: 'G' } }
            : {}),
        }),
      ] as never,
    }
  );

const RECORDED: Row[] = [{ id: 'a', n: 1 }];
/** The recorded state, in the shape the extension hands back. */
const stateFor = (aggregated: boolean) => {
  const tree = { rows: { all: RECORDED } };
  return aggregated ? { T: tree } : tree;
};

/** Interceptors that log, and then either transform or block. */
const intercept = (tree: ReturnType<typeof make>, mode: 'transform' | 'block') => {
  const calls: string[] = [];
  tree.$.rows.intercept({
    onAdd: (row, ctx) => {
      calls.push(`add:${row.id}`);
      if (mode === 'block') ctx.block('no');
      else ctx.transform({ ...row, p: 9 });
    },
    onUpdate: (id, changes, ctx) => {
      calls.push(`update:${id}`);
      if (mode === 'block') ctx.block('no');
      else ctx.transform({ ...changes, p: 9 });
    },
    onRemove: (id, _row, ctx) => {
      calls.push(`remove:${id}`);
      if (mode === 'block') ctx.block('no');
    },
  });
  return calls;
};

describe.each([
  ['per-tree instance', false],
  ['aggregated instance', true],
] as const)('devtools replays skip interceptors (%s)', (_name, aggregated) => {
  it.each(
    replays.flatMap((kind) =>
      (['transform', 'block'] as const).map((mode) => [kind, mode] as const)
    )
  )('%s with %s interceptors: the recorded state applies exactly', async (kind, mode) => {
    installExtension();
    const tree = make(aggregated);
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      tree.$.rows.updateOne('a', { n: 2 });
      tree.$.rows.addOne({ id: 'b', n: 3 });
      await flush();
      const calls = intercept(tree, mode);
      expect(() => dispatch(messages[kind](stateFor(aggregated)))).not.toThrow();
      await flush();
      expect(tree.$.rows.all()).toStrictEqual(RECORDED);
      expect(calls).toStrictEqual([]);
    } finally {
      tree.destroy();
    }
  });

  it('IMPORT_STATE keeps the interceptors: an imported state is new input', async () => {
    installExtension();
    const tree = make(aggregated);
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      tree.$.rows.updateOne('a', { n: 2 });
      await flush();
      const calls = intercept(tree, 'transform');
      dispatch(messages.IMPORT_STATE(stateFor(aggregated)));
      await flush();
      expect(calls).toStrictEqual(['update:a']);
      expect(tree.$.rows.all()).toStrictEqual([{ id: 'a', n: 1, p: 9 }]);
    } finally {
      tree.destroy();
    }
  });

  it('a tap writing during a jump is intercepted', async () => {
    installExtension();
    const tree = make(aggregated);
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      tree.$.rows.updateOne('a', { n: 2 });
      await flush();
      let wrote = false;
      tree.$.rows.tap({
        onUpdate: () => {
          if (wrote) return;
          wrote = true;
          tree.$.rows.addOne({ id: 't', n: 0 });
        },
      });
      const calls = intercept(tree, 'transform');
      dispatch(messages.JUMP_TO_STATE(stateFor(aggregated)));
      await flush();
      expect(calls).toStrictEqual(['add:t']);
      expect(tree.$.rows.byId('t')?.()).toStrictEqual({ id: 't', n: 0, p: 9 });
    } finally {
      tree.destroy();
    }
  });
});

/**
 * Only a state the tree itself produced is replayed without interceptors. The
 * extension can hold imported or hand-edited states, and any client can send
 * a JUMP_TO_STATE: a state the tree never serialized is new input, so the
 * interceptors run — a transform applies and a block refuses it (round-3
 * review probe C: a forged JUMP_TO_STATE bypassed a blocking interceptor).
 */
describe.each([
  ['per-tree instance', false],
  ['aggregated instance', true],
] as const)('devtools: a jump to a state the tree never recorded (%s)', (_name, aggregated) => {
  const forged = (rows: Row[]) => {
    const tree = { rows: { all: rows } };
    return aggregated ? { T: tree } : tree;
  };

  it.each(replays)('%s of a forged state runs a blocking interceptor', async (kind) => {
    installExtension();
    const tree = make(aggregated);
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      const calls = intercept(tree, 'block');
      let refused: unknown;
      try {
        dispatch(messages[kind](forged([{ id: 'forged', n: -1 }])));
      } catch (error) {
        refused = error;
      }
      await flush();
      expect(calls.length).toBeGreaterThan(0);
      expect(String(refused)).toMatch(/no/);
      expect(tree.$.rows.all()).toStrictEqual([{ id: 'a', n: 1 }]);
    } finally {
      tree.destroy();
    }
  });

  it.each(replays)('%s of an edited recorded state runs a transforming interceptor', async (kind) => {
    installExtension();
    const tree = make(aggregated);
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      tree.$.rows.updateOne('a', { n: 2 });
      await flush();
      const calls = intercept(tree, 'transform');
      // The recorded { a: 1 } with one field edited.
      dispatch(messages[kind](forged([{ id: 'a', n: 7 }])));
      await flush();
      expect(calls).toStrictEqual(['update:a']);
      expect(tree.$.rows.all()).toStrictEqual([{ id: 'a', n: 7, p: 9 }]);
    } finally {
      tree.destroy();
    }
  });
});

/**
 * The recognition window and the fail-safe (round-4 review): a tree
 * remembers the states it serialized for its configured `maxAge` (default
 * 50, at most 1,000), and recognises only the exact JSON it produced. A state
 * older than the window, or one the extension hands back re-serialized
 * differently, reads as unrecorded: the interceptors run and a blocking one
 * refuses the jump.
 */
describe.each([
  ['per-tree instance', false],
  ['aggregated instance', true],
] as const)('devtools: the recognition window and the fail-safe (%s)', (_name, aggregated) => {
  const wrap = (rows: Row[]) => {
    const tree = { rows: { all: rows } };
    return aggregated ? { T: tree } : tree;
  };

  it('with maxAge 2, a state three writes back is outside the window', async () => {
    installExtension();
    const tree = make(aggregated, 2);
    try {
      for (const n of [1, 2, 3, 4]) {
        if (n === 1) tree.$.rows.addOne({ id: 'a', n });
        else tree.$.rows.updateOne('a', { n });
        await flush();
      }
      const calls = intercept(tree, 'transform');
      // Still inside the window: the state before the last.
      dispatch(messages.JUMP_TO_STATE(wrap([{ id: 'a', n: 3 }])));
      await flush();
      expect(calls).toStrictEqual([]);
      expect(tree.$.rows.all()).toStrictEqual([{ id: 'a', n: 3 }]);
      // Outside it: recorded once, forgotten since.
      dispatch(messages.JUMP_TO_STATE(wrap([{ id: 'a', n: 1 }])));
      await flush();
      expect(calls).toStrictEqual(['update:a']);
      expect(tree.$.rows.all()).toStrictEqual([{ id: 'a', n: 1, p: 9 }]);
    } finally {
      tree.destroy();
    }
  });

  it('a recorded state re-serialized with other key order is refused by a blocking interceptor', async () => {
    installExtension();
    const tree = make(aggregated);
    try {
      tree.$.rows.addOne({ id: 'a', n: 1 });
      await flush();
      tree.$.rows.updateOne('a', { n: 2 });
      await flush();
      const calls = intercept(tree, 'block');
      // The recorded { id: 'a', n: 1 }, keys reordered by a re-serializer.
      const reordered = wrap([{ n: 1, id: 'a' } as Row]);
      let refused: unknown;
      try {
        dispatch(messages.JUMP_TO_STATE(reordered));
      } catch (error) {
        refused = error;
      }
      await flush();
      expect(calls.length).toBeGreaterThan(0);
      expect(String(refused)).toMatch(/no/);
      expect(tree.$.rows.all()).toStrictEqual([{ id: 'a', n: 2 }]);
    } finally {
      tree.destroy();
    }
  });
});
