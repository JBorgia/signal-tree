// Prewritten independent controls for the reviewed authored-removal successor.
// Private publication subscribers model the supported recipient preparation seam;
// they do not replace native installers or inject primitive storage failures.
import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import { getEntityPublicationBinding } from './internals/entity-publication';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';

type Row = { id: string; n: number | undefined };
type Receipt = { read(): Readonly<{ state: string; basis?: string }> };
type Experimental = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' }, work: () => unknown): Receipt;
};
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 120; i++) await Promise.resolve();
};
const make = () => signalTree(
  { rows: entityMap<Row, string>() }, { enhancers: [transactions()] }
);
const inspect = (work: () => void) =>
  withWriteContext({ participation: 'inspection' }, work);
const caught = (work: () => unknown) => {
  try { work(); } catch (error) { return error; }
  return undefined;
};
const connect = (tree: ReturnType<typeof make>) => {
  const sent: unknown[] = [];
  const connection = link(tree.$.rows, {
    set: value => { sent.push(structuredClone(value)); },
  });
  return { sent, connection };
};
const seed = async (tree: ReturnType<typeof make>, n: number | undefined = 9) => {
  tree.$.rows.addOne({ id: 'a', n: 1 });
  inspect(() => tree.$.rows.addOne({ id: 'x', n }));
  await flush();
};
const publication = (tree: ReturnType<typeof make>) => {
  const binding = getEntityPublicationBinding(tree.$.rows);
  if (!binding) throw new Error('Missing native entity publication binding');
  return binding.source;
};

describe('independent authored removal preparation and completion', () => {
  it('throwing recipient preparation installs neither removal nor absence proof; retry delivers', async () => {
    const tree = make(); await seed(tree);
    const recipient = connect(tree); const source = publication(tree);
    const beforeNegative = source.inspect()['negativePresence'];
    const failure = new Error('recipient preparation refused');
    let attempts = 0;
    const off = source.subscribe({
      prepare(packet) {
        if (packet.physical.some(edit => edit.structural?.kind === 'remove')) {
          attempts++; throw failure;
        }
        return undefined;
      },
      complete() { /* This participant has no completion side effect. */ },
    });
    try {
      expect(caught(() => tree.$.rows.removeOne('x'))).toBe(failure);
      expect(attempts).toBe(1);
      expect(tree.$.rows.byIdOrFail('x')()).toEqual({ id: 'x', n: 9 });
      expect(source.inspect()['negativePresence']).toBe(beforeNegative);
      await flush(); expect(recipient.sent).toEqual([]);
      off(); tree.$.rows.removeOne('x'); await flush();
      expect(recipient.sent).toEqual([[{ id: 'a', n: 1 }]]);
      await recipient.connection.settled();
    } finally { off(); recipient.connection.dispose(); tree.destroy(); }
  });

  it('reentrant sibling write survives thrown outer removal and its useful retry', async () => {
    const tree = make(); await seed(tree);
    const recipient = connect(tree); const failure = new Error('outer preparation after reentry');
    let entered = false;
    const off = publication(tree).subscribe({
      prepare(packet) {
        if (!entered && packet.physical.some(edit => edit.structural?.kind === 'remove')) {
          entered = true;
          tree.$.rows.updateOne('a', { n: 2 });
          throw failure;
        }
        return undefined;
      },
      complete() { /* This participant has no completion side effect. */ },
    });
    try {
      expect(caught(() => tree.$.rows.removeOne('x'))).toBe(failure);
      expect(entered).toBe(true);
      await flush();
      expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 2 }, { id: 'x', n: 9 }]);
      expect(recipient.sent).toEqual([[{ id: 'a', n: 2 }, { id: 'x', n: 9 }]]);
      off(); tree.$.rows.removeOne('x'); await flush();
      expect(recipient.sent.at(-1)).toEqual([{ id: 'a', n: 2 }]);
      expect(recipient.sent).toHaveLength(2);
      await recipient.connection.settled();
    } finally { off(); recipient.connection.dispose(); tree.destroy(); }
  });

  it('recipient enrolled during failed preparation retains its baseline and receives the retry', async () => {
    const tree = make(); await seed(tree);
    const first = connect(tree); const failure = new Error('after enrollment');
    let enrolled: ReturnType<typeof connect> | undefined;
    const off = publication(tree).subscribe({
      prepare(packet) {
        if (!enrolled && packet.physical.some(edit => edit.structural?.kind === 'remove')) {
          enrolled = connect(tree); throw failure;
        }
        return undefined;
      },
      complete() { /* This participant has no completion side effect. */ },
    });
    try {
      expect(caught(() => tree.$.rows.removeOne('x'))).toBe(failure);
      expect(enrolled).toBeDefined();
      await flush(); expect(first.sent).toEqual([]); expect(enrolled!.sent).toEqual([]);
      expect(tree.$.rows.byIdOrFail('x')()).toEqual({ id: 'x', n: 9 });
      off(); tree.$.rows.removeOne('x'); await flush();
      expect(first.sent).toEqual([[{ id: 'a', n: 1 }]]);
      expect(enrolled!.sent).toEqual(first.sent);
      await Promise.all([first.connection.settled(), enrolled!.connection.settled()]);
    } finally { off(); enrolled?.connection.dispose(); first.connection.dispose(); tree.destroy(); }
  });

  it('disposal during failed preparation cannot revive its draft or prevent survivor retry', async () => {
    const tree = make(); await seed(tree);
    const disposed = connect(tree); const survivor = connect(tree);
    const failure = new Error('after disposal'); let attempted = false;
    const off = publication(tree).subscribe({
      prepare(packet) {
        if (!attempted && packet.physical.some(edit => edit.structural?.kind === 'remove')) {
          attempted = true; disposed.connection.dispose(); throw failure;
        }
        return undefined;
      },
      complete() { /* This participant has no completion side effect. */ },
    });
    try {
      expect(caught(() => tree.$.rows.removeOne('x'))).toBe(failure);
      expect(attempted).toBe(true);
      await flush(); expect(survivor.sent).toEqual([]); expect(disposed.sent).toEqual([]);
      off(); tree.$.rows.removeOne('x'); await flush();
      expect(survivor.sent).toEqual([[{ id: 'a', n: 1 }]]);
      expect(disposed.sent).toEqual([]);
      await Promise.all([survivor.connection.settled(), disposed.connection.settled()]);
    } finally { off(); disposed.connection.dispose(); survivor.connection.dispose(); tree.destroy(); }
  });

  it('enrollment without a callback error is coherently admitted or refused before useful retry', async () => {
    const tree = make(); await seed(tree);
    const first = connect(tree); const source = publication(tree);
    const beforeNegative = source.inspect()['negativePresence'];
    let enrolled: ReturnType<typeof connect> | undefined;
    let baseline: Row[] | undefined;
    const off = source.subscribe({
      prepare(packet) {
        if (!enrolled && packet.physical.some(edit => edit.structural?.kind === 'remove')) {
          baseline = structuredClone(tree.$.rows.all());
          enrolled = connect(tree);
        }
        return undefined;
      },
      complete() { /* This participant has no completion side effect. */ },
    });
    try {
      const error = caught(() => tree.$.rows.removeOne('x'));
      expect(enrolled).toBeDefined();
      expect(baseline).toEqual([{ id: 'a', n: 1 }, { id: 'x', n: 9 }]);
      // Both permitted strategies must preserve the new relationship: reprepare
      // against its baseline, or refuse the whole uninstalled unit and retry.
      if (error !== undefined) {
        expect(error).toBeInstanceOf(Error);
        expect(tree.$.rows.byIdOrFail('x')()).toEqual({ id: 'x', n: 9 });
        expect(source.inspect()['negativePresence']).toBe(beforeNegative);
        await flush(); expect(first.sent).toEqual([]); expect(enrolled!.sent).toEqual([]);
        off(); tree.$.rows.removeOne('x');
      }
      await flush();
      expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 1 }]);
      expect(first.sent).toEqual([[{ id: 'a', n: 1 }]]);
      expect(enrolled!.sent).toEqual([[{ id: 'a', n: 1 }]]);
      await Promise.all([first.connection.settled(), enrolled!.connection.settled()]);
    } finally { off(); enrolled?.connection.dispose(); first.connection.dispose(); tree.destroy(); }
  });

  it('disposal without a callback error cannot reinstall a disposed recipient draft', async () => {
    const tree = make(); await seed(tree);
    const disposed = connect(tree); const survivor = connect(tree); const source = publication(tree);
    const beforeNegative = source.inspect()['negativePresence']; let attempted = false;
    const off = source.subscribe({
      prepare(packet) {
        if (!attempted && packet.physical.some(edit => edit.structural?.kind === 'remove')) {
          attempted = true; disposed.connection.dispose();
        }
        return undefined;
      },
      complete() { /* This participant has no completion side effect. */ },
    });
    try {
      const error = caught(() => tree.$.rows.removeOne('x'));
      expect(attempted).toBe(true);
      if (error !== undefined) {
        expect(error).toBeInstanceOf(Error);
        expect(tree.$.rows.byIdOrFail('x')()).toEqual({ id: 'x', n: 9 });
        expect(source.inspect()['negativePresence']).toBe(beforeNegative);
        await flush(); expect(survivor.sent).toEqual([]); expect(disposed.sent).toEqual([]);
        off(); tree.$.rows.removeOne('x');
      }
      await flush();
      expect(tree.$.rows.all()).toEqual([{ id: 'a', n: 1 }]);
      expect(survivor.sent).toEqual([[{ id: 'a', n: 1 }]]);
      expect(disposed.sent).toEqual([]);
      let done = false;
      const idle = disposed.connection.settled().then(() => { done = true; });
      await flush(); expect(done).toBe(true);
      await Promise.all([survivor.connection.settled(), idle]);
    } finally { off(); disposed.connection.dispose(); survivor.connection.dispose(); tree.destroy(); }
  });

  it('onRemove reentry keeps a new same-key lifetime after older removal completion', async () => {
    const tree = make(); await seed(tree);
    const old = tree.$.rows.byIdOrFail('x'); const recipient = connect(tree);
    let calls = 0;
    const off = tree.$.rows.tap({ onRemove: id => {
      if (id === 'x') { calls++; tree.$.rows.addOne({ id: 'x', n: 22 }); }
    } });
    try {
      tree.$.rows.removeOne('x'); await flush();
      expect(calls).toBe(1); expect(old()).toBeUndefined();
      expect(tree.$.rows.byIdOrFail('x')).not.toBe(old);
      expect(tree.$.rows.byIdOrFail('x')()).toEqual({ id: 'x', n: 22 });
      expect(recipient.sent.length).toBeGreaterThan(0);
      expect(recipient.sent.at(-1)).toEqual([{ id: 'a', n: 1 }, { id: 'x', n: 22 }]);
      await recipient.connection.settled();
      expect(recipient.sent.at(-1)).toEqual([{ id: 'a', n: 1 }, { id: 'x', n: 22 }]);
    } finally { off(); recipient.connection.dispose(); tree.destroy(); }
  });

  it('undefined field removal completes a held support revision and useful absence delivery', async () => {
    const tree = make();
    tree.$.rows.addOne({ id: 'a', n: 1 });
    inspect(() => tree.$.rows.addOne({ id: 'x', n: undefined }));
    await flush();
    const held = tree.$.rows.byIdOrFail('x'); const sent: unknown[] = [];
    const connection = link(held.n, { set: value => { sent.push(value); } }) as Experimental;
    let receipt: Receipt | undefined;
    try {
      expect(held.n()).toBeUndefined();
      const p = tree.transact(() => {
        receipt = connection.declare({ kind: 'independent' }, () => tree.$.rows.removeOne('x'));
      });
      await flush(); expect(sent).toEqual([]);
      expect(receipt?.read()).toMatchObject({ state: 'held' });
      expect(held()).toBeUndefined();
      p.confirm(); await flush();
      expect(sent).toEqual([undefined]);
      expect(receipt?.read()).toMatchObject({ state: 'started' });
      await connection.settled();
    } finally { connection.dispose(); tree.destroy(); }
  });
});
