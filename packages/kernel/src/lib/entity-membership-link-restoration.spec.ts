import { describe, expect, it } from 'vitest';

import {
  entityMap,
  link,
  restoration,
  signalTree,
  transactions,
  undoable,
  type EntitySignal,
} from '../index';

type Row = { id: string; n: number };
type Change = 'remove' | 'add' | 'replace';
const initial: Row[] = [
  { id: 'a', n: 1 },
  { id: 'b', n: 2 },
  { id: 'c', n: 3 },
];
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

function change(rows: EntitySignal<Row, string>, operation: Change): Row[] {
  if (operation === 'remove') {
    rows.removeOne('b');
    return [initial[0], initial[2]];
  }
  if (operation === 'replace') rows.removeOne('b');
  const added = { id: operation === 'add' ? 'd' : 'b', n: 4 };
  rows.addOne(added);
  return operation === 'add'
    ? [...initial, added]
    : [initial[0], initial[2], added];
}

async function setup(nested: boolean) {
  const tree = signalTree(
    {
      rows: entityMap<Row, string>(),
      data: { rows: entityMap<Row, string>() },
    },
    { enhancers: [transactions(), restoration()] }
  );
  const rows = nested ? tree.$.data.rows : tree.$.rows;
  rows.setAll(initial);
  await flush();
  const sent: Row[][] = [];
  const connection = link(rows, {
    set: (value) => {
      sent.push(value.map((row) => ({ ...row })));
    },
  });
  return { tree, rows, sent, connection };
}

describe.each([false, true])(
  'linked restored membership (nested=%s)',
  (nested) => {
    it.each<Change>(['remove', 'add', 'replace'])(
      'rollback of %s publishes the original members, values and order',
      async (operation) => {
        const { tree, rows, sent, connection } = await setup(nested);
        try {
          const pending = tree.transaction(() => change(rows, operation));
          await flush();
          expect(sent).toEqual([]);
          pending.rollback();
          await flush();
          await connection.settled();
          expect(rows.all()).toEqual(initial);
          // Non-vacuous: require delivery, not merely absence of speculative rows.
          expect(sent).toEqual([initial]);
        } finally {
          connection.dispose();
          tree.destroy();
        }
      }
    );

    it.each<Change>(['remove', 'add', 'replace'])(
      'undo and redo of %s publish the restored membership each time',
      async (operation) => {
        const { tree, rows, sent, connection } = await setup(nested);
        try {
          const changed = undoable(() => change(rows, operation));
          await flush();
          await connection.settled();
          expect(sent).toEqual([changed]);
          sent.length = 0;

          tree.undo();
          await flush();
          await connection.settled();
          expect(rows.all()).toEqual(initial);
          expect(sent).toEqual([initial]);
          sent.length = 0;

          tree.redo();
          await flush();
          await connection.settled();
          expect(rows.all()).toEqual(changed);
          expect(sent).toEqual([changed]);
        } finally {
          connection.dispose();
          tree.destroy();
        }
      }
    );
  }
);
