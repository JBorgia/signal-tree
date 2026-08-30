import { describe, expect, it } from 'vitest';
import { signalTree, batching, restoration, undoable } from './index';

/**
 * BATCHING-OWNERSHIP-0 — the BO-B falsifier.
 *
 * Batching may change WHEN observers are told. It may not independently own
 * causal truth. So equivalent authored work must agree, batched vs unbatched,
 * on the authoritative value and on RESTORATION ELIGIBILITY — the semantic fact
 * a second commit authority would be most likely to mint differently.
 *
 * Deliberately NOT asserted: notification counts. Coalescing publication is the
 * enhancer's declared job, so differing delivery is correct, not a violation.
 */
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
type Tree = {
  $: { a: { (): number; set(v: number): void }; b: { (): number; set(v: number): void } };
  batch(fn: () => void): void;
  canUndo(): boolean;
  undo(): void;
};
const make = () =>
  signalTree(
    { a: 0, b: 0 },
    { enhancers: [batching(), restoration()], capabilities: ['causal-runtime'] }
  ) as unknown as Tree;

describe('batching does not own causal truth', () => {
  it('final authoritative value agrees, batched vs unbatched', async () => {
    const plain = make();
    plain.$.a.set(1); plain.$.b.set(2); await tick();

    const batched = make();
    batched.batch(() => { batched.$.a.set(1); batched.$.b.set(2); });
    await tick();

    expect([batched.$.a(), batched.$.b()]).toEqual([plain.$.a(), plain.$.b()]);
  });

  it('batching cannot mint restoration eligibility', async () => {
    const t = make();
    await tick();
    // undesignated work inside a batch stays undesignated: batching must not
    // manufacture the authored-activity fact the kernel alone owns.
    t.batch(() => { t.$.a.set(1); t.$.b.set(2); });
    await tick();
    expect(t.canUndo()).toBe(false);
  });

  it('batching cannot strip restoration eligibility', async () => {
    const t = make();
    await tick();
    undoable(() => { t.batch(() => { t.$.a.set(5); }); });
    await tick();
    expect(t.canUndo()).toBe(true);
    t.undo(); await tick();
    expect(t.$.a()).toBe(0);
  });
});
