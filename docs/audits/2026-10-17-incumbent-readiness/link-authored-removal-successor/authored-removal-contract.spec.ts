import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { withWriteContext } from './write-context';
import { getPathNotifier } from './path-notifier';

type Row = { id: string; n: number };
const inspect = (work: () => void) => withWriteContext({ participation: 'inspection' }, work);
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
const make = () => signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });

describe('authored removal source domain and recipient baselines', () => {
  for (const route of ['removeOne', 'removeMany', 'removeWhere', 'clear', 'setAll'] as const) {
    it(`${route} removes authored physical targets without purging recipient-latent lifetimes`, async () => {
      const tree = make();
      const rows = tree.$.rows;
      rows.addOne({ id: 'a', n: 1 });
      inspect(() => rows.addMany([{ id: 'x', n: 9 }, { id: 'z', n: 8 }]));
      await flush();
      const sent: Row[][] = [];
      const c = link(rows, { set: value => { sent.push(structuredClone(value)); } });
      try {
        inspect(() => rows.removeOne('z'));
        await flush(); expect(sent).toEqual([]);
        if (route === 'removeOne') rows.removeOne('x');
        if (route === 'removeMany') rows.removeMany(['x']);
        if (route === 'removeWhere') rows.removeWhere(row => row.id === 'x');
        if (route === 'clear') rows.clear();
        if (route === 'setAll') rows.setAll([{ id: 'a', n: 1 }]);
        await flush();
        await c.settled();
        expect(sent.length).toBeGreaterThan(0);
        expect(sent.at(-1)).toEqual(route === 'clear'
          ? [{ id: 'z', n: 8 }]
          : [{ id: 'a', n: 1 }, { id: 'z', n: 8 }]);
        expect(rows.byId('x')).toBeUndefined();
      } finally { c.dispose(); tree.destroy(); }
    });
  }

  for (const projection of ['root', 'row', 'field'] as const) {
    it(`authored removal reaches the ${projection} recipient with its exact lifetime`, async () => {
      const tree = make();
      tree.$.rows.addOne({ id: 'a', n: 1 });
      inspect(() => tree.$.rows.addOne({ id: 'x', n: 9 }));
      await flush();
      const old = tree.$.rows.byIdOrFail('x');
      const sent: unknown[] = [];
      const endpoint = { set: (value: unknown) => { sent.push(structuredClone(value)); } };
      const c = projection === 'root' ? link(tree.$ as never, endpoint as never)
        : projection === 'row' ? link(old, endpoint) : link(old.n, endpoint);
      try {
        tree.$.rows.removeOne('x'); await flush(); await c.settled();
        expect(sent.length).toBeGreaterThan(0);
        expect(sent.at(-1)).toEqual(projection === 'root'
          ? { rows: { all: [{ id: 'a', n: 1 }] } } : undefined);
        tree.$.rows.addOne({ id: 'x', n: 22 }); await flush(); await c.settled();
        expect(old()).toBeUndefined();
        expect(tree.$.rows.byIdOrFail('x')).not.toBe(old);
        expect(sent.at(-1)).toEqual(projection === 'root'
          ? { rows: { all: [{ id: 'a', n: 1 }, { id: 'x', n: 22 }] } } : undefined);
      } finally { c.dispose(); tree.destroy(); }
    });
  }
});
