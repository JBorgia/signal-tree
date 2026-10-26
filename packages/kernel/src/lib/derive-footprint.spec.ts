import { describe, expect, it, vi } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';

type Row = { id: string; x: number; y: number; extra?: number | undefined };
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const setup = async (extra = false) => {
  const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
  tree.$.rows.addOne({ id: 'r', x: 0, y: 0, ...(extra ? { extra: 3 } : {}) });
  await flush();
  const row = tree.$.rows.byIdOrFail('r');
  const sent: unknown[] = [];
  const connection = link(tree.$.rows, { set: value => { sent.push(structuredClone(value)); } });
  withWriteContext({ participation: 'inspection' }, () => row.x(99));
  await flush();
  return { tree, row, sent, connection };
};

describe('derived row authored physical footprint', () => {
  it('captures only derived y and rolls back without owning inspected x', async () => {
    const { tree, row, sent, connection } = await setup();
    try {
      const pending = tree.transact(() => row(current => ({ ...current, y: 2 })));
      expect(pending.inspect().changes.some(change => change.path.endsWith('.x'))).toBe(false);
      pending.rollback();
      expect(row()).toEqual({ id: 'r', x: 99, y: 0 });
      row(current => ({ ...current, y: 2 }));
      await flush(); await connection.settled();
      expect(sent.at(-1)).toEqual([{ id: 'r', x: 0, y: 2 }]);
    } finally { connection.dispose(); tree.destroy(); }
  });
  it.each(['same-reference', 'same-fields'] as const)('identity derive %s does not adopt inspection', async kind => {
    const { tree, row, sent, connection } = await setup();
    try {
      const pending = tree.transact(() => row(current => kind === 'same-reference' ? current : { ...current }));
      expect(pending.inspect().changes).toEqual([]);
      pending.confirm(); await flush(); await connection.settled();
      expect(sent).toEqual([]);
      expect(row.x()).toBe(99);
    } finally { connection.dispose(); tree.destroy(); }
  });
  it.each(['add', 'delete', 'undefined'] as const)('preserves physical field presence for %s', async kind => {
    const { tree, row, sent, connection } = await setup(kind === 'delete');
    try {
      row(current => {
        const next = { ...current };
        if (kind === 'delete') delete next.extra;
        else next.extra = kind === 'undefined' ? undefined : 4;
        return next;
      });
      await flush(); await connection.settled();
      expect(sent.at(-1)).toEqual([{ id: 'r', x: 0, y: 0, ...(kind === 'delete' ? {} : { extra: kind === 'undefined' ? undefined : 4 }) }]);
      expect(Object.prototype.hasOwnProperty.call((sent.at(-1) as Row[])[0], 'extra')).toBe(kind !== 'delete');
    } finally { connection.dispose(); tree.destroy(); }
  });
  it('explicit same-display replacement adopts and its rollback restores ordinary x', async () => {
    const { tree, row, connection } = await setup();
    try {
      const pending = tree.transact(() => row(row()));
      expect(pending.inspect().changes.some(change => change.path.endsWith('.x'))).toBe(true);
      pending.rollback(); expect(row.x()).toBe(0);
    } finally { connection.dispose(); tree.destroy(); }
  });
  it('throwing updater installs nothing and later derived change remains useful', async () => {
    const { tree, row, sent, connection } = await setup();
    try {
      expect(() => row(() => { throw new Error('derive failure'); })).toThrow('derive failure');
      expect(row()).toEqual({ id: 'r', x: 99, y: 0 });
      row(current => ({ ...current, y: 2 }));
      await flush(); await connection.settled();
      expect(sent.at(-1)).toEqual([{ id: 'r', x: 0, y: 2 }]);
    } finally { connection.dispose(); tree.destroy(); }
  });
  it('getter failure during physical comparison installs no outer value', async () => {
    const { tree, row, connection } = await setup();
    try {
      expect(() => row(current => ({ ...current, get y(): number { throw new Error('getter failure'); } }))).toThrow('getter failure');
      expect(row()).toEqual({ id: 'r', x: 99, y: 0 });
    } finally { connection.dispose(); tree.destroy(); }
  });
  it('getter reentry cannot silently overwrite independently installed truth', async () => {
    const { tree, row, connection } = await setup();
    try {
      let entered = false;
      expect(() => row(current => ({ ...current, get y(): number {
        if (!entered) { entered = true; row.y(7); }
        return 2;
      } }))).toThrow(/reenter/i);
      expect(entered).toBe(true);
      expect(row.y()).toBe(7);
    } finally { connection.dispose(); tree.destroy(); }
  });

  it('uses one staged getter value for physical, ordinary and published derive facts', async () => {
    const { tree, row, sent, connection } = await setup();
    try {
      let reads = 0;
      row(current => ({ ...current, get y(): number { return ++reads; } }));
      expect(reads).toBe(1);
      expect(row()).toEqual({ id: 'r', x: 99, y: 1 });
      await flush(); await connection.settled();
      expect(reads).toBe(1);
      expect(sent.at(-1)).toEqual([{ id: 'r', x: 0, y: 1 }]);
    } finally { connection.dispose(); tree.destroy(); }
  });

  it('retains data-only return reference and identity derive physical row', async () => {
    const { tree, row, connection } = await setup();
    try {
      const next = { ...row(), y: 2 };
      row(() => next);
      expect(row()).toBe(next);
      row(current => current);
      expect(row()).toBe(next);
    } finally { connection.dispose(); tree.destroy(); }
  });
  it('preserves prototype, symbols and nonenumerables while staging original-receiver getter', async () => {
    const { tree, row, connection } = await setup();
    try {
      const symbol = Symbol('physical');
      const prototype = { inherited: 42 };
      const next = Object.assign(Object.create(prototype) as Row, row());
      Object.defineProperty(next, 'hidden', { value: 7, enumerable: false });
      Object.defineProperty(next, symbol, { value: 8, enumerable: false });
      const getter = vi.fn(function (this: Row) { return 2; });
      Object.defineProperty(next, 'y', { get: getter, enumerable: true });
      row(() => next);
      expect(getter.mock.contexts).toEqual([next]);
      expect(Object.getPrototypeOf(row())).toBe(prototype);
      expect(Object.getOwnPropertyDescriptor(row(), 'hidden')).toEqual(Object.getOwnPropertyDescriptor(next, 'hidden'));
      expect(Object.getOwnPropertyDescriptor(row(), symbol)).toEqual(Object.getOwnPropertyDescriptor(next, symbol));
      expect(row.y()).toBe(2);
    } finally { connection.dispose(); tree.destroy(); }
  });
  it('preserves null prototype and own special names during accessor staging', async () => {
    const { tree, row, connection } = await setup();
    try {
      const next = Object.assign(Object.create(null) as Row, row());
      Object.defineProperty(next, '__proto__', { value: 7, enumerable: true });
      Object.defineProperty(next, 'y', { get() { return 2; }, enumerable: true });
      row(() => next);
      expect(Object.getPrototypeOf(row())).toBeNull();
      expect(Object.getOwnPropertyDescriptor(row(), '__proto__')?.value).toBe(7);
      expect(row.y()).toBe(2);
    } finally { connection.dispose(); tree.destroy(); }
  });

});
