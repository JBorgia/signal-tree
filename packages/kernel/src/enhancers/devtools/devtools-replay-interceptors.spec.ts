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

const make = (aggregated: boolean) =>
  signalTree(
    { rows: entityMap<Row, string>({ selectId: (row) => row.id }) },
    {
      enhancers: [
        devTools({
          enabled: true,
          enableBrowserDevTools: true,
          name: 'T',
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
