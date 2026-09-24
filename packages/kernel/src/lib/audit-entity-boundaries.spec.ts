import { describe, expect, it } from 'vitest';
import { signalTree, entityMap, link, restoration } from '../index';

type Row = { id: number; value: number };
const rows: Row[] = [
  { id: 1, value: 1 },
  { id: 2, value: 2 },
  { id: 3, value: 3 },
];
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('audit entity boundaries', () => {
  it.each([false, true])(
    'root replacement preserves partial reorder, bare array=%s',
    (bare) => {
      const tree = signalTree({ rows: entityMap<Row, number>() });
      try {
        tree.$.rows.setAll(rows);
        const next = [rows[1], rows[0], rows[2]];
        if (bare) {
          // Runtime also admits the documented bare-array hydrate form.
          (tree.$ as unknown as (value: unknown) => void)({ rows: next });
      } else {
        // Root replacement types still name the construction marker; this
        // regression checks the runtime's canonical snapshot input.
        (tree.$ as unknown as (value: unknown) => void)({ rows: { all: next } });
      }
        expect(tree.$.rows.ids()).toEqual([2, 1, 3]);
      } finally {
        tree.destroy();
      }
    }
  );

  it('root replacement keeps custom keys and changed rows in incoming order', () => {
    const tree = signalTree({
      rows: entityMap<{ key: number; value: number }, number>({
        selectId: (row) => row.key,
      }),
    });
    const initial = rows.map((row) => ({ key: row.id, value: row.value }));
    try {
      tree.$.rows.setAll(initial);
      (tree.$ as unknown as (value: unknown) => void)({
        rows: { all: [initial[1], { ...initial[0], value: 9 }, initial[2]] },
      });
      expect(tree.$.rows.ids()).toEqual([2, 1, 3]);
      expect(tree.$.rows.byIdOrFail(1).value()).toBe(9);
    } finally {
      tree.destroy();
    }
  });

  it('setAll reorder reaches a collection link', async () => {
    const tree = signalTree({ rows: entityMap<Row, number>() });
    let dispose: () => void = () => undefined;
    try {
      tree.$.rows.setAll(rows);
      await flush();
      const sent: Row[][] = [];
      const relationship = link(tree.$.rows, {
        set: (value) => {
          sent.push(value);
        },
      });
      dispose = relationship.dispose;
      tree.$.rows.setAll([rows[2], rows[0], rows[1]]);
      await flush();
      await relationship.settled();
      expect(sent).toEqual([[rows[2], rows[0], rows[1]]]);
    } finally {
      dispose();
      tree.destroy();
    }
  });

  it.each([false, true])(
    'row and field links retain ownership, enhanced=%s',
    async (enhanced) => {
      const tree = signalTree(
        { rows: entityMap<Row, number>() },
        { enhancers: enhanced ? [restoration()] : [] }
      );
      const disposers: Array<() => void> = [];
      try {
        tree.$.rows.setAll(rows);
        await flush();
        const row = tree.$.rows.byIdOrFail(1);
        const rowSent: Row[] = [];
        const rowLink = link(row, {
          set: (value) => {
            rowSent.push(value);
          },
        });
        disposers.push(rowLink.dispose);
        row.value(7);
        await flush();
        await rowLink.settled();
        expect(rowSent).toEqual([{ id: 1, value: 7 }]);
        rowLink.dispose();
        const sent: number[] = [];
        const fieldLink = link(row.value, {
          set: (value) => {
            sent.push(value);
          },
        });
        disposers.push(fieldLink.dispose);
        row.value(8);
        await flush();
        await fieldLink.settled();
        expect(sent).toEqual([8]);
      } finally {
        disposers.forEach((dispose) => dispose());
        tree.destroy();
      }
    }
  );
});

// Keys and lifetime identity must survive exactly; no string-path decoding.
describe('entity link ownership controls', () => {
  it('retained field follows rekey, then retires instead of following key reuse', async () => {
    const tree = signalTree({
      rows: entityMap<{ id: string; 'a.b': number }, string>(),
    });
    let dispose: () => void = () => undefined;
    try {
      tree.$.rows.addOne({ id: 'row.with.dots', 'a.b': 1 });
      await flush();
      const field = tree.$.rows.byIdOrFail('row.with.dots')['a.b'];
      const sent: Array<number | undefined> = [];
      const relationship = link(field, {
        set: (value) => {
          sent.push(value);
        },
      });
      dispose = relationship.dispose;
      tree.$.rows.changeId('row.with.dots', 'new.key');
      field(2);
      await flush();
      await relationship.settled();
      expect(sent).toEqual([2]);
      tree.$.rows.removeOne('new.key');
      await flush();
      await relationship.settled();
      expect(sent).toEqual([2, undefined]);
      tree.$.rows.addOne({ id: 'new.key', 'a.b': 9 });
      await flush();
      await relationship.settled();
      expect(sent).toEqual([2, undefined]);
    } finally {
      dispose();
      tree.destroy();
    }
  });

  it('bare field ignores another row, collection, and tree', async () => {
    const state = () => ({
      rows: entityMap<Row, number>(),
      other: entityMap<Row, number>(),
    });
    const tree = signalTree(state());
    const otherTree = signalTree(state());
    let dispose: () => void = () => undefined;
    try {
      tree.$.rows.setAll(rows);
      tree.$.other.setAll(rows);
      otherTree.$.rows.setAll(rows);
      await flush();
      const sent: number[] = [];
      const relationship = link(tree.$.rows.byIdOrFail(1).value, {
        set: (value) => {
          sent.push(value);
        },
      });
      dispose = relationship.dispose;
      tree.$.rows.updateOne(2, { value: 20 });
      tree.$.other.updateOne(1, { value: 10 });
      otherTree.$.rows.updateOne(1, { value: 30 });
      await flush();
      await relationship.settled();
      expect(sent).toEqual([]);
      tree.$.rows.updateOne(1, { value: 40 });
      await flush();
      await relationship.settled();
      expect(sent).toEqual([40]);
    } finally {
      dispose();
      tree.destroy();
      otherTree.destroy();
    }
  });

  it('reorder after an unflushed add preserves complete outbound order', async () => {
    const tree = signalTree({ rows: entityMap<Row, number>() });
    let dispose: () => void = () => undefined;
    try {
      tree.$.rows.setAll(rows.slice(0, 2));
      await flush();
      const sent: Row[][] = [];
      const relationship = link(tree.$.rows, {
        set: (value) => {
          sent.push(value);
        },
      });
      dispose = relationship.dispose;
      tree.$.rows.addOne(rows[2]);
      tree.$.rows.setAll([rows[2], rows[0], rows[1]]);
      await flush();
      await relationship.settled();
      expect(sent.at(-1)).toEqual([rows[2], rows[0], rows[1]]);
    } finally {
      dispose();
      tree.destroy();
    }
  });
});
