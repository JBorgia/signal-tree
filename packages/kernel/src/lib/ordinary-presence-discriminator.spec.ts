import { describe, expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';

type Receipt = { read(): Readonly<{ state: string; reason?: string; basis?: string }> };
type Declaration = { kind: 'independent' | 'unknown' } | { kind: 'dependent'; owners: readonly object[] };
type Experimental = { declare(input: Declaration, work: () => unknown): Receipt };
const experimental = (connection: ReturnType<typeof link>) => connection as ReturnType<typeof link> & Experimental;
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 48; i++) await Promise.resolve();
};
const make = () => signalTree({ x: 0, y: 0, z: 0 }, { enhancers: [transactions()] });
const publicationError = (work: () => unknown) => {
  try { work(); } catch (error) { return error; }
  return undefined;
};

describe('A1 installed scalar publication operations (prewritten contract)', () => {
  it('publishes an independent existing value while unrelated owner remains pending', async () => {
    const tree = make(); const sends: number[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    const p = tree.transact(() => tree.$.x(7));
    try {
      const receipt = c.declare({ kind: 'independent' }, () => tree.$.y(8));
      await flush();
      expect(sends).toEqual([8]); expect(receipt.read()).toMatchObject({ state: 'started' });
      expect(tree.$.x()).toBe(7); expect(tree.$.y()).toBe(8);
      p.rollback(); expect(tree.$.x()).toBe(0); expect(tree.$.y()).toBe(8);
    } finally { c.dispose(); tree.destroy(); }
  });

  it('holds a declared dependent copy then publishes after authentic confirmation', async () => {
    const tree = make(); const sends: number[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    const p = tree.transact(() => tree.$.x(7));
    try {
      const receipt = c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.y(tree.$.x()));
      await flush(); expect(sends).toEqual([]); expect(receipt.read()).toMatchObject({ state: 'held' });
      p.confirm(); await flush(); expect(sends).toEqual([7]);
      expect(receipt.read()).toMatchObject({ state: 'started' });
      await c.settled();
    } finally { c.dispose(); tree.destroy(); }
  });

  it('reauthors surviving equal7 after rejection while q stays pending, without a value event; waiter completes', async () => {
    const tree = make(); const sends: number[] = []; const values: unknown[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    const p = tree.transact(() => tree.$.x(7));
    const q = tree.transact(() => tree.$.z(9));
    const off = getPathNotifier().subscribe('y', value => { values.push(value); });
    try {
      c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.y(7));
      await flush(); expect(sends).toEqual([]);
      p.rollback(); await flush(); expect(tree.$.y()).toBe(7); expect(tree.$.z()).toBe(9);
      expect(sends).toEqual([]); values.length = 0;
      let done = false; const settled = c.settled().then(() => { done = true; });
      const fresh = c.declare({ kind: 'independent' }, () => tree.$.y(7));
      await flush();
      expect(sends).toEqual([7]); expect(values).toEqual([]);
      expect(fresh.read()).toMatchObject({ state: 'started' }); expect(done).toBe(true);
      await settled;
      q.rollback(); expect(tree.$.z()).toBe(0); expect(tree.$.y()).toBe(7);
    } finally { off(); c.dispose(); tree.destroy(); }
  });

  it('true equal/equal-support and a declaration without setter stay no-write, no duplicate send', async () => {
    const tree = make(); const sends: number[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    try {
      c.declare({ kind: 'independent' }, () => tree.$.y(7)); await flush(); expect(sends).toEqual([7]);
      const noop = c.declare({ kind: 'independent' }, () => tree.$.y(7));
      const empty = c.declare({ kind: 'independent' }, () => undefined);
      await flush(); expect(noop.read()).toMatchObject({ state: 'no-write' });
      expect(empty.read()).toMatchObject({ state: 'no-write' }); expect(sends).toEqual([7]);
      await c.settled();
    } finally { c.dispose(); tree.destroy(); }
  });

  it('outer independent cannot erase inner dependent admission with later literal overwrite', async () => {
    const tree = make(); const sends: number[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    const p = tree.transact(() => tree.$.x(7)); let inner: Receipt | undefined;
    try {
      const error = publicationError(() => c.declare({ kind: 'independent' }, () => {
        inner = c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.y(7));
        tree.$.y(8);
      }));
      expect(error).toMatchObject({ code: 'SIGNALTREE_PUBLICATION_DECLARATION_INVALID', stage: 'after-callback', reason: 'contradiction' });
      await flush(); expect(sends).toEqual([]); expect(tree.$.y()).toBe(8);
      expect(inner?.read().state).not.toBe('started');
      p.rollback(); await flush(); expect(tree.$.x()).toBe(0); expect(tree.$.y()).toBe(8);
    } finally { c.dispose(); tree.destroy(); }
  });

  it('explicitly complete outer dependency preserves nested writes and confirms usefully', async () => {
    const tree = make(); const sends: number[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    const p = tree.transact(() => tree.$.x(7));
    try {
      const receipt = c.declare({ kind: 'dependent', owners: [p] }, () => {
        c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.y(7)); tree.$.y(8);
      });
      await flush(); expect(sends).toEqual([]); expect(receipt.read()).toMatchObject({ state: 'held' });
      p.confirm(); await flush(); expect(sends).toEqual([8]); expect(tree.$.y()).toBe(8); await c.settled();
    } finally { c.dispose(); tree.destroy(); }
  });

  it('fresh outside-scope overwrite supersedes declared receipt but keeps conservative gate', async () => {
    const tree = make(); const sends: number[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    const p = tree.transact(() => tree.$.x(7));
    try {
      const receipt = c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.y(7));
      tree.$.y(9); await flush(); expect(sends).toEqual([]);
      expect(receipt.read()).toMatchObject({ state: 'superseded' });
      p.confirm(); await flush(); expect(sends).toEqual([9]); await c.settled();
    } finally { c.dispose(); tree.destroy(); }
  });

  it('retains authentic confirmed outcome after owner source destroy', async () => {
    const owner = make(); const tree = make(); const sends: number[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    const p = owner.transact(() => owner.$.x(7)); p.confirm(); owner.destroy();
    const q = tree.transact(() => tree.$.z(9));
    try {
      const receipt = c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.y(7));
      await flush(); expect(sends).toEqual([7]); expect(receipt.read()).toMatchObject({ state: 'started' });
      expect(tree.$.z()).toBe(9); q.rollback(); expect(tree.$.y()).toBe(7);
    } finally { c.dispose(); owner.destroy(); tree.destroy(); }
  });

  it('unresolved destroyed owner stays conservative rather than becoming confirmed', async () => {
    const owner = make(); const tree = make(); const sends: number[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    const p = owner.transact(() => owner.$.x(7)); owner.destroy();
    try {
      const receipt = c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.y(7));
      await flush(); expect(tree.$.y()).toBe(7); expect(sends).toEqual([]);
      expect(['held', 'conservative']).toContain(receipt.read().state);
    } finally { c.dispose(); owner.destroy(); tree.destroy(); }
  });
  it('preserves primary error when nested dependency contradicts the outer declaration', async () => {
    const tree = make(); const sends: number[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    const p = tree.transact(() => tree.$.x(7)); const primary = Object.freeze({ primary: true });
    try {
      const error = publicationError(() => c.declare({ kind: 'independent' }, () => {
        c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.y(7));
        tree.$.y(8); throw primary;
      }));
      expect(error).toBe(primary); await flush(); expect(tree.$.y()).toBe(8); expect(sends).toEqual([]);
      p.rollback(); expect(tree.$.x()).toBe(0); expect(tree.$.y()).toBe(8);
    } finally { c.dispose(); tree.destroy(); }
  });

  it('keeps return-shape getter reentry inside outer validation horizon', async () => {
    const tree = make(); const sends: number[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    const p = tree.transact(() => tree.$.x(7));
    try {
      const error = publicationError(() => c.declare({ kind: 'independent' }, () => ({
        get then() { c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.y(7)); return undefined; },
      })));
      expect(error).toMatchObject({ code: 'SIGNALTREE_PUBLICATION_DECLARATION_INVALID', stage: 'after-callback', reason: 'contradiction' });
      await flush(); expect(sends).toEqual([]); expect(tree.$.y()).toBe(7); p.confirm();
    } finally { c.dispose(); tree.destroy(); }
  });

  it('cross-connection child validation cannot publish before contradictory outer completion', async () => {
    const tree = make(); const sentY: number[] = []; const sentZ: number[] = [];
    const y = experimental(link(tree.$.y, { set: value => { sentY.push(value); } }));
    const z = experimental(link(tree.$.z, { set: value => { sentZ.push(value); } }));
    const p = tree.transact(() => tree.$.x(7)); let child: Receipt | undefined;
    try {
      const error = publicationError(() => y.declare({ kind: 'independent' }, () => {
        child = z.declare({ kind: 'dependent', owners: [p] }, () => tree.$.z(8));
        expect(child.read()).toMatchObject({ state: 'validating' }); tree.$.y(9);
      }));
      expect(error).toMatchObject({ stage: 'after-callback', reason: 'contradiction' });
      await flush(); expect(sentY).toEqual([]); expect(sentZ).toEqual([]);
      expect(tree.$.y()).toBe(9); expect(tree.$.z()).toBe(8); p.confirm();
    } finally { y.dispose(); z.dispose(); tree.destroy(); }
  });

  it('inner independent contradicts inherited known parent dependency', async () => {
    const tree = make(); const sends: number[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    const p = tree.transact(() => tree.$.x(7));
    try {
      const error = publicationError(() => c.declare({ kind: 'dependent', owners: [p] }, () => {
        c.declare({ kind: 'independent' }, () => tree.$.y(8));
      }));
      expect(error).toMatchObject({ code: 'SIGNALTREE_PUBLICATION_DECLARATION_INVALID', stage: 'after-callback', reason: 'contradiction' });
      await flush(); expect(sends).toEqual([]); expect(tree.$.y()).toBe(8);
      p.confirm(); await flush(); expect(sends).toEqual([8]); await c.settled();
    } finally { c.dispose(); tree.destroy(); }
  });

  it('unknown outer context stays conservative without asserting an empty owner set', async () => {
    const tree = make(); const sends: number[] = [];
    const c = experimental(link(tree.$.y, { set: value => { sends.push(value); } }));
    const p = tree.transact(() => tree.$.x(7));
    try {
      const receipt = c.declare({ kind: 'unknown' }, () => {
        c.declare({ kind: 'dependent', owners: [p] }, () => tree.$.y(8));
      });
      await flush(); expect(sends).toEqual([]); expect(receipt.read()).toMatchObject({ state: 'conservative', reason: 'unknown' });
      p.confirm(); await flush(); expect(sends).toEqual([8]); await c.settled();
    } finally { c.dispose(); tree.destroy(); }
  });

  it('ordinary omission then equal retained readd publishes absence and supplied value', async () => {
    const tree = signalTree({ a: { y: 7, keep: 9 } as { y?: number; keep?: number } });
    const a = tree.$.a; const y = a.y!; const sends: (number | undefined)[] = [];
    const c = experimental(link(y, { set: value => { sends.push(value); } }));
    try {
      a({ keep: 9 }); await flush(); expect(y()).toBeUndefined(); expect(sends).toEqual([undefined]); await c.settled();
      const receipt = c.declare({ kind: 'independent' }, () => y(7));
      await flush(); expect(y()).toBe(7); expect(sends).toEqual([undefined, 7]);
      expect(receipt.read()).toMatchObject({ state: 'started' }); await c.settled();
    } finally { c.dispose(); tree.destroy(); }
  });

  it('inspection readd cannot replace hidden ordinary component; explicit ordinary readd remains useful', async () => {
    const tree = signalTree({ a: { y: 7, keep: 9 } as { y?: number; keep?: number } });
    const a = tree.$.a; const y = a.y!; const sends: (number | undefined)[] = [];
    const c = experimental(link(y, { set: value => { sends.push(value); } }));
    try {
      a({ keep: 9 }); await flush(); expect(sends).toEqual([undefined]);
      withWriteContext({ participation: 'inspection' }, () => y(99));
      await flush(); expect(y()).toBe(99); expect(sends).toEqual([undefined]);
      c.declare({ kind: 'independent' }, () => y(7));
      await flush(); expect(y()).toBe(7); expect(sends).toEqual([undefined, 7]); await c.settled();
    } finally { c.dispose(); tree.destroy(); }
  });

  it('connection created during absence adopts that baseline then useful supplied readd', async () => {
    const tree = signalTree({ a: { y: 7, keep: 9 } as { y?: number; keep?: number } });
    const a = tree.$.a; const y = a.y!; a({ keep: 9 }); await flush();
    const sends: (number | undefined)[] = [];
    const c = experimental(link(y, { set: value => { sends.push(value); } }));
    try {
      await flush(); expect(sends).toEqual([]);
      c.declare({ kind: 'independent' }, () => y(7));
      await flush(); expect(sends).toEqual([7]); await c.settled();
    } finally { c.dispose(); tree.destroy(); }
  });

  it('membership trie keeps different registries with same literal address isolated', async () => {
    const left = signalTree({ a: { y: 7, keep: 9 } as { y?: number; keep?: number } });
    const right = signalTree({ a: { y: 7, keep: 9 } as { y?: number; keep?: number } });
    const sends: (number | undefined)[] = [];
    const c = experimental(link(left.$.a.y!, { set: value => { sends.push(value); } }));
    try {
      right.$.a({ keep: 9 }); await flush(); expect(sends).toEqual([]); expect(left.$.a.y!()).toBe(7);
      left.$.a({ keep: 9 }); await flush(); expect(sends).toEqual([undefined]); await c.settled();
    } finally { c.dispose(); left.destroy(); right.destroy(); }
  });

  it.each([false, true])('ordinary readd after inspection captures existence for rollback (defaultLink=%s)', async (withLink) => {
    const tree = signalTree({ a: { y: 7, keep: 9 } as { y?: number; keep?: number } }, { enhancers: [transactions()] });
    const a = tree.$.a; const y = a.y!; const sends: (number | undefined)[] = [];
    const c = withLink ? link(y, { set: value => { sends.push(value); } }) : undefined;
    try {
      a({ keep: 9 }); await flush();
      withWriteContext({ participation: 'inspection' }, () => y(99)); await flush();
      const p = tree.transact(() => y(7)); await flush();
      console.log('A1-ORDINARY-PRESENCE', JSON.stringify({ withLink, phase: 'pending', exposed: y(), branch: a(), inspection: p.inspect(), sends }));
      p.rollback(); await flush();
      console.log('A1-ORDINARY-PRESENCE', JSON.stringify({ withLink, phase: 'rolled-back', exposed: y(), branch: a(), sends }));
      // The authored ordinary existence is the footprint; rejection restores
      // its prior ordinary absence, independently of a Link's installation.
      expect(y()).toBeUndefined(); expect(a()).toEqual({ keep: 9 });
    } finally { c?.dispose(); tree.destroy(); }
  });

});
