import { afterEach, describe, expect, it } from 'vitest';
import { devTools } from './devtools';
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';

/**
 * v15 port review of 67012241..12187613, item 5. A devtools jump to a state
 * the tree recorded replays it exactly, members it left out included: a
 * merge of the recorded state left an omitted member present (review probe
 * d5). JUMP_TO_STATE, JUMP_TO_ACTION and ROLLBACK replay; IMPORT_STATE
 * applies new input and keeps merging, so a key it leaves out stays as it
 * is.
 *
 * The states are the ones the stub extension received from the tree.
 */
type Row = { id: string; n: number };
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

let listeners: Array<(message: unknown) => void> = [];
let sent: unknown[] = [];
const originalWindow = (globalThis as { window?: unknown }).window;
afterEach(() => {
  (globalThis as { window?: unknown }).window = originalWindow;
  listeners = [];
  sent = [];
});
const installExtension = () => {
  (globalThis as { window?: unknown }).window = {
    __REDUX_DEVTOOLS_EXTENSION__: {
      connect: () => ({
        send: (_action: unknown, state: unknown) => {
          sent.push(state);
        },
        init: (state: unknown) => {
          sent.push(state);
        },
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
const replay = (type: string, state: unknown) => ({
  type: 'DISPATCH',
  payload: { type },
  state: JSON.stringify(state),
});
const importState = (state: unknown) => ({
  type: 'DISPATCH',
  payload: {
    type: 'IMPORT_STATE',
    nextLiftedState: { computedStates: [{ state }], currentStateIndex: 0 },
  },
});

const make = (aggregated: boolean) =>
  signalTree(
    {
      a: {
        value: 1,
        keep: 2,
        rows: entityMap<Row, string>({ selectId: (row) => row.id }),
      },
      count: 0,
    },
    {
      enhancers: [
        devTools({
          enabled: true,
          enableBrowserDevTools: true,
          name: 'T',
          ...(aggregated
            ? { aggregatedReduxInstance: { id: 'omission-group', name: 'G' } }
            : {}),
        }),
      ] as never,
    }
  );
type Tree = ReturnType<typeof make>;
const read = (tree: Tree) => JSON.stringify(tree.$());

describe.each([
  ['per-tree instance', false],
  ['aggregated instance', true],
] as const)(
  'devtools replays reproduce omissions (%s)',
  (_name, aggregated) => {
    /** Record three states: full, `a` omitted, `a` re-added with only `keep`. */
    const record = async (tree: Tree) => {
      const states: Array<{ sent: unknown; read: string }> = [];
      const mark = async () => {
        await flush();
        states.push({ sent: sent[sent.length - 1], read: read(tree) });
      };
      tree.$.a.rows.setAll([{ id: 'r', n: 1 }]);
      await mark();
      tree.$({ count: 1 } as never);
      await mark();
      tree.$.a.keep(9);
      await mark();
      return states;
    };

    it.each(['JUMP_TO_STATE', 'JUMP_TO_ACTION', 'ROLLBACK'])(
      '%s to each recorded state gives that state, members left out included',
      async (type) => {
        installExtension();
        const tree = make(aggregated);
        try {
          const [full, omitted, readded] = await record(tree);
          expect(omitted.read).toBe('{"count":1}');
          expect(readded.read).toBe('{"a":{"keep":9},"count":1}');
          for (const target of [omitted, full, readded, omitted, full]) {
            dispatch(replay(type, target.sent));
            await flush();
            expect(read(tree)).toBe(target.read);
          }
          // Reads follow, and a re-adding write still re-adds.
          expect(tree.$.a.rows.all()).toStrictEqual([{ id: 'r', n: 1 }]);
          dispatch(replay(type, omitted.sent));
          await flush();
          expect(tree.$.a.rows.all()).toStrictEqual([]);
          tree.$.a.value(5);
          await flush();
          expect(read(tree)).toBe('{"a":{"value":5},"count":1}');
        } finally {
          tree.destroy();
        }
      }
    );

    it('IMPORT_STATE merges: a member the imported state leaves out stays as it is', async () => {
      installExtension();
      const tree = make(aggregated);
      try {
        const [full, omitted] = await record(tree);
        dispatch(replay('JUMP_TO_STATE', full.sent));
        await flush();
        dispatch(importState(omitted.sent));
        await flush();
        expect(JSON.parse(read(tree))).toStrictEqual({
          ...JSON.parse(full.read),
          count: 1,
        });
      } finally {
        tree.destroy();
      }
    });
  }
);
