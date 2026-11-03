import { appendFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { link, signalTree, transactions, type PublicationReceipt } from '../index';

const drain = async () => {
  for (let i = 0; i < 120; i++) await Promise.resolve();
};

for (const mode of ['collapse', 'meaningful'] as const) {
  it(`public whole update retains correct sibling work: ${mode}`, async () => {
    const tree = signalTree({ pair: { x: 0, y: 0 }, q: 0 }, { enhancers: [transactions()] });
    const sent: { x: number; y: number }[] = [];
    const c = link(tree.$.pair, { set: value => { sent.push(value); } });
    const fresh: PublicationReceipt[] = [];
    const rows: { n: number; calls: number; receipt: ReturnType<PublicationReceipt['read']>; old: ReturnType<PublicationReceipt['read']>; sent: { x: number; y: number }[]; ownerUnchanged: boolean; settled: boolean }[] = [];
    let off = () => { /* Subscribe only after initial ownership is established. */ };
    try {
      const p = tree.transact(() => tree.$.pair.x(7));
      const a = tree.transact(() => tree.$.q(1));
      let historyCalls = 0;
      const earlier = c.declare({ kind: 'dependent', owners: [p, a] }, () => {
        tree.$(current => { historyCalls++; return { ...current, pair: { ...current.pair } }; });
      });
      a.confirm(); await drain();
      const saved = tree.$.pair();
      const historicalRead = earlier.read();
      const historicalReadValue = { ...historicalRead };
      const ownerBefore = p.inspect();
      let notices = 0, settled = false;
      off = tree.$.pair.x.subscribe(() => { notices++; });
      const waiting = c.settled().then(() => { settled = true; });
      for (let n = 1; n <= 2; n++) {
        const q = tree.transact(() => tree.$.q(n + 1));
        q.confirm(); await drain();
        let calls = 0;
        const receipt = c.declare({ kind: 'dependent', owners: [p, q] }, () => {
          tree.$(current => {
            calls++;
            expect(current.q).toBe(n + 1);
            // Existing source layout x,y: changed x and equal y in the meaningful
            // n2 arm. No claim that this observes private preparation order.
            return { ...current, pair: { x: mode === 'meaningful' && n === 2 ? 9 : current.pair.x, y: current.pair.y } };
          });
        });
        fresh.push(receipt); await drain();
        rows.push({ n, calls, receipt: receipt.read(), old: earlier.read(), sent: [...sent],
          ownerUnchanged: JSON.stringify(p.inspect()) === JSON.stringify(ownerBefore), settled });
      }
      p.confirm(); await drain(); await waiting; await c.settled(); await drain();
      const expected = { x: mode === 'meaningful' ? 9 : 7, y: 0 };
      const final = [...sent], finalFresh = fresh.map(receipt => receipt.read());
      const finalOld = earlier.read();
      c.dispose(); tree.$.pair.x(99); await drain();
      const sink = process.env.ST_PUBLIC_SIBLING_OUTPUT;
      if (sink) appendFileSync(sink, JSON.stringify({ mode, historyCalls, rows, notices,
        saved, final, finalFresh, finalOld, afterDispose: sent, settled }) + '\n');

      expect(historyCalls).toBe(1);
      expect(rows.map(row => row.calls)).toEqual([1, 1]);
      expect(rows.map(row => row.sent)).toEqual([[], []]);
      expect(rows.map(row => row.settled)).toEqual([false, false]);
      // A changed independent value can supersede old ownership; the meaningful
      // arm's hold follows its explicit dependency on p, not historical location.
      if (mode === 'collapse') expect(rows.map(row => row.ownerUnchanged)).toEqual([true, true]);
      expect(saved).toEqual({ x: 7, y: 0 });
      expect(historicalRead).toEqual(historicalReadValue);
      expect(Object.isFrozen(historicalRead)).toBe(true);
      expect(final).toEqual([expected]); expect(sent).toEqual([expected]);
      expect(settled).toBe(true);
      // Notices include the post-disposal local x99 write.
      expect(notices).toBe(mode === 'meaningful' ? 2 : 1);
      if (mode === 'collapse') {
        expect(rows.map(row => row.receipt)).toEqual([{ state: 'no-write' }, { state: 'no-write' }]);
        expect(rows.map(row => row.old.state)).not.toContain('superseded');
        expect(finalFresh).toEqual([{ state: 'no-write' }, { state: 'no-write' }]);
        expect(finalOld).toEqual({ state: 'started', basis: 'surviving' });
      } else {
        expect(rows[1].receipt.state).not.toBe('no-write');
        expect(finalFresh[1].state).toBe('started');
      }
      expect(fresh.map(receipt => receipt.read())).toEqual(finalFresh);
      expect(earlier.read()).toEqual(finalOld);
    } finally { off(); c.dispose(); tree.destroy(); }
  });
}
