import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { getPathNotifier } from './path-notifier';

type Experimental = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' }, work: () => unknown): unknown;
};
const make = () => signalTree({ x: 0 }, { enhancers: [transactions()] });
const flush = async () => { getPathNotifier().flushSync(); for (let i = 0; i < 48; i++) await Promise.resolve(); };

it('validation failure retains the installation window without including an owner opened afterward', async () => {
  const source = make(); const target = make(); const late = make();
  const sent: number[] = [];
  const c = link(target.$.x, { set: value => { sent.push(value); } }) as Experimental;
  let caught: unknown;
  try {
    const q = source.transact(() => source.$.x(7));
    const p = target.transact(() => {
      try {
        c.declare({ kind: 'independent' }, () => {
          target.$.x(8);
          return { get then() {
            throw new Error('return validation');
          } };
        });
      } catch (error) { caught = error; }
    });
    expect(caught).toMatchObject({ stage: 'after-callback', reason: 'validation-threw' });
    expect(target.$.x()).toBe(8);
    // Nested transact() inside p is deliberately unsupported. Open the later
    // owner after p's callback, still before any delivery or settlement.
    const later = late.transact(() => late.$.x(9));
    const pendingLater = later.inspect();
    await flush(); expect(sent).toEqual([]);
    p.confirm(); await flush(); expect(sent).toEqual([]);
    q.confirm(); await flush(); expect(sent).toEqual([8]);
    expect(later.inspect()).toEqual(pendingLater);
    expect(late.$.x()).toBe(9);
    await c.settled();
  } finally { c.dispose(); target.destroy(); source.destroy(); late.destroy(); }
});
