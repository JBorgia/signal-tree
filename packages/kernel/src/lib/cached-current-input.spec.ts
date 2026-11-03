import { appendFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { leaf, link, signalTree, transactions } from '../index';
const drain = async () => { for (let i = 0; i < 120; i++) await Promise.resolve(); };

it('fresh current updater cannot reuse a cached certificate preceding equal support refresh', async () => {
  const source = signalTree({ pair: { x: 7 } });
  const foreign = signalTree({ q: 0 }, { enhancers: [transactions()] });
  const target = signalTree({ y: 0 });
  const savedTarget = signalTree({ y: 0 });
  const sent: number[] = [], savedSent: number[] = [];
  const c = link(target.$.y, { set: value => { sent.push(value); } });
  const savedLink = link(savedTarget.$.y, { set: value => { savedSent.push(value); } });
  const saved = source.$();
  const holder = signalTree({ input: leaf(saved) });
  let q: ReturnType<typeof foreign.transact> | undefined;
  try {
    expect(saved).toEqual({ pair: { x: 7 } });
    q = foreign.transact(() => foreign.$.q(7));
    const ownership = q.inspect();
    let authorCalls = 0;
    foreign.updateAndReport(current => {
      authorCalls++;
      source.$.pair.x(current.q); // Equal value, genuinely new pending input.
      return {};
    });
    await drain();
    let freshCalls = 0, savedCalls = 0;
    let freshError: unknown, savedError: unknown, sameSnapshot = false;
    try {
      c.declare({ kind: 'independent' }, () => {
        source.updateAndReport(current => {
          freshCalls++; sameSnapshot = current === saved;
          target.$.y(current.pair.x);
          return {}; // No later source admission can create the contradiction.
        });
      });
    } catch (error) { freshError = error; }
    try {
      savedLink.declare({ kind: 'independent' }, () => {
        holder.updateAndReport(current => {
          savedCalls++; expect(current.input).toBe(saved);
          savedTarget.$.y(current.input.pair.x);
          return {};
        });
      });
    } catch (error) { savedError = error; }
    await drain();
    const before = [...sent], savedBefore = [...savedSent];
    const ownerUnchanged = JSON.stringify(q.inspect()) === JSON.stringify(ownership);
    q.confirm();
    await drain();
    await Promise.all([c.settled(), savedLink.settled()]);
    await drain();
    const describe = (error: unknown) => error instanceof Error
      ? Object.assign({ name: error.name, message: error.message }, error) : error ?? null;
    const observation = { authorCalls, freshCalls, savedCalls, sameSnapshot, ownerUnchanged,
      freshError: describe(freshError), savedError: describe(savedError),
      before, savedBefore, after: sent, savedAfter: savedSent, saved };
    const sink = process.env.ST_CACHED_INPUT_OUTPUT;
    if (sink) appendFileSync(sink, JSON.stringify(observation) + '\n');
    expect([authorCalls, freshCalls, savedCalls]).toEqual([1, 1, 1]);
    expect(ownerUnchanged).toBe(true);
    expect(target.$.y()).toBe(7);
    expect(saved).toEqual({ pair: { x: 7 } });
    expect(sent).toEqual([7]); // Useful post-confirm delivery, no duplicates.
    expect(before).toEqual([]); // Fresh current input must not lose pending q.
    expect(freshError).toMatchObject({
      code: 'SIGNALTREE_PUBLICATION_DECLARATION_INVALID',
      stage: 'after-callback', reason: 'contradiction',
    });
    // Saved-object behavior is an intentional contrast, recorded rather than
    // assigning a new cross-version historical-snapshot oracle here.
  } finally {
    c.dispose(); savedLink.dispose(); holder.destroy();
    target.destroy(); savedTarget.destroy(); source.destroy(); foreign.destroy();
  }
});
