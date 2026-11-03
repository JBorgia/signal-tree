import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { diagnostics } from './experimental-publication/private';
import { withWriteContext } from './write-context';

const drain = async () => {
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Seeded field handle missing');
  return value;
}
type Row = { id: string; value?: number };
const setup = async (enhanced = false) => {
  const tree = signalTree(
    { rows: entityMap<Row, string>() },
    { enhancers: enhanced ? [transactions()] : [] }
  );
  tree.$.rows.addOne({ id: 'a', value: 1 });
  await drain();
  return tree;
};

describe('Link uses native entity source address without metadata enhancement', () => {
  for (const enhanced of [false, true])
    for (const kind of ['update', 'omit'] as const) {
      it(`${
        enhanced ? 'enhanced' : 'bare'
      } ${kind} sends and settles`, async () => {
        const tree = await setup(enhanced);
        const row = tree.$.rows.byIdOrFail('a');
        const sent: unknown[] = [];
        const connection = link(required(row.value), {
          set: (value) => {
            sent.push(value);
          },
        });
        try {
          if (kind === 'update') required(row.value)(2);
          else tree.$.rows.replaceOne('a', { id: 'a' });
          let settled = false;
          const waiting = connection.settled().then(() => {
            settled = true;
          });
          await drain();
          expect(required(row.value)()).toBe(kind === 'update' ? 2 : undefined);
          expect(sent).toEqual([kind === 'update' ? 2 : undefined]);
          expect(settled).toBe(true);
          await waiting;
        } finally {
          connection.dispose();
          tree.destroy();
        }
      });
    }
  it('does not confuse identical subject numbers in different collections', async () => {
    const tree = signalTree({
      a: entityMap<Row, string>(),
      b: entityMap<Row, string>(),
    });
    tree.$.a.addOne({ id: 'r', value: 1 });
    tree.$.b.addOne({ id: 'r', value: 2 });
    await drain();
    const a: unknown[] = [],
      b: unknown[] = [];
    const ca = link(tree.$.a.byIdOrFail('r').value, {
      set: (v) => {
        a.push(v);
      },
    });
    const cb = link(tree.$.b.byIdOrFail('r').value, {
      set: (v) => {
        b.push(v);
      },
    });
    try {
      tree.$.a.updateOne('r', { value: 3 });
      await drain();
      expect(a).toEqual([3]);
      expect(b).toEqual([]);
    } finally {
      ca.dispose();
      cb.dispose();
      tree.destroy();
    }
  });
  it('preserves lifetime isolation through rekey and same-key recreation', async () => {
    const tree = await setup();
    const rows = tree.$.rows;
    const held = rows.byIdOrFail('a');
    const sent: unknown[] = [];
    const c = link(required(held.value), {
      set: (v) => {
        sent.push(v);
      },
    });
    try {
      rows.changeId('a', 'b');
      required(held.value)(2);
      await drain();
      expect(sent).toEqual([2]);
      rows.removeOne('b');
      await drain();
      expect(sent).toEqual([2, undefined]);
      rows.addOne({ id: 'b', value: 9 });
      rows.updateOne('b', { value: 10 });
      await drain();
      expect(required(held.value)()).toBeUndefined();
      expect(sent).toEqual([2, undefined]);
    } finally {
      c.dispose();
      tree.destroy();
    }
  });
  it('retains inspection separation and later useful ordinary publication', async () => {
    const tree = await setup();
    const row = tree.$.rows.byIdOrFail('a');
    const sent: unknown[] = [];
    const c = link(required(row.value), {
      set: (v) => {
        sent.push(v);
      },
    });
    try {
      withWriteContext({ participation: 'inspection' }, () =>
        required(row.value)(99)
      );
      await drain();
      expect(sent).toEqual([]);
      required(row.value)(2);
      await drain();
      expect(sent).toEqual([2]);
    } finally {
      c.dispose();
      tree.destroy();
    }
  });
  it('does not turn unknown cross-tree dependency into early permission', async () => {
    const source = signalTree({ x: 1 }, { enhancers: [transactions()] });
    const tree = await setup();
    const sent: unknown[] = [];
    const c = link(tree.$.rows.byIdOrFail('a').value, {
      set: (v) => {
        sent.push(v);
      },
    });
    const pending = source.transact(() => source.$.x(7));
    try {
      required(tree.$.rows.byIdOrFail('a').value)(source.$.x());
      await drain();
      expect(sent).toEqual([]);
      pending.confirm();
      await drain();
      expect(sent).toEqual([7]);
      await c.settled();
    } finally {
      c.dispose();
      tree.destroy();
      source.destroy();
    }
  });
  it('serializes a corrective send after an in-flight omitted value', async () => {
    const tree = await setup();
    const row = tree.$.rows.byIdOrFail('a');
    const sent: unknown[] = [];
    let acknowledge!: () => void;
    const first = new Promise<void>((r) => {
      acknowledge = r;
    });
    const c = link(required(row.value), {
      set: (v) => {
        sent.push(v);
        return sent.length === 1 ? first : undefined;
      },
    });
    try {
      tree.$.rows.replaceOne('a', { id: 'a' });
      await drain();
      expect(sent).toEqual([undefined]);
      required(row.value)(4);
      await drain();
      expect(sent).toEqual([undefined]);
      acknowledge();
      await drain();
      expect(sent).toEqual([undefined, 4]);
      await c.settled();
    } finally {
      acknowledge();
      c.dispose();
      tree.destroy();
    }
  });
  it('retires connection metadata and releases waits on disposal', async () => {
    await drain();
    const before = diagnostics();
    for (let i = 0; i < 3; i++) {
      const tree = await setup();
      let started = false;
      const c = link(tree.$.rows.byIdOrFail('a').value, {
        set: () => {
          started = true;
          return new Promise<void>(() => {
            /* endpoint intentionally stays in flight */
          });
        },
      });
      try {
        tree.$.rows.updateOne('a', { value: 2 });
        await drain();
        expect(started).toBe(true);
        const wait = c.settled();
        c.dispose();
        await wait;
      } finally {
        c.dispose();
        tree.destroy();
        await drain();
      }
    }
    const after = diagnostics();
    for (const key of [
      'connections',
      'bindings',
      'equalListeners',
      'listeners',
      'latest',
      'operations',
    ] as const)
      expect(after[key]).toBe(before[key]);
  });
});
