import { expect, it } from 'vitest';
import { link, signalTree, transactions } from '../index';
import { diagnostics } from './experimental-publication/lifecycle';
import { preparePublicationMutations } from './internals/intrinsic-mutation';
import { getPathNotifier } from './path-notifier';

const flush = async () => { getPathNotifier().flushSync(); for (let i = 0; i < 48; i++) await Promise.resolve(); };
const make = () => signalTree({ x: 0 }, { enhancers: [transactions()] });

it('failed scalar preparation installs neither value nor publication obligation; retry uses its own window', async () => {
  const source = make(); const late = make(); const target = make();
  const sent: number[] = []; const c = link(target.$.x, { set: value => { sent.push(value); } });
  const failure = new Error('controlled publication preparation'); let calls = 0;
  let release = preparePublicationMutations(target.$.x, () => { calls++; throw failure; }, () => { /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ })!;
  try {
    const p = source.transact(() => source.$.x(1));
    const before = diagnostics();
    for (let i = 0; i < 5; i++) expect(() => target.$.x(7)).toThrow(failure);
    await flush(); expect(target.$.x()).toBe(0); expect(sent).toEqual([]);
    expect(calls).toBe(5); expect(diagnostics().operations).toBe(before.operations);
    release(); release = () => { /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ };
    const q = late.transact(() => late.$.x(2));
    target.$.x(7); await flush(); expect(sent).toEqual([]);
    p.confirm(); await flush(); expect(sent).toEqual([]);
    q.confirm(); await flush(); expect(sent).toEqual([7]); await c.settled();
  } finally { release(); c.dispose(); target.destroy(); late.destroy(); source.destroy(); }
});

it('scalar preparation reentry captures the install-time window without replaying the updater', async () => {
  const source = make(); const reentrant = make(); const later = make(); const target = make();
  const sent: number[] = []; const c = link(target.$.x, { set: value => { sent.push(value); } });
  let q: { confirm(): void } | undefined; let preparationCalls = 0; let updaterCalls = 0;
  const release = preparePublicationMutations(target.$.x, () => {
    preparationCalls++; q = reentrant.transact(() => reentrant.$.x(2)); return undefined;
  }, () => { /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ })!;
  try {
    const p = source.transact(() => source.$.x(1));
    target.$.x(value => { updaterCalls++; expect(value).toBe(0); return 7; });
    const r = later.transact(() => later.$.x(3)); const pendingR = r.inspect();
    expect(updaterCalls).toBe(1); expect(preparationCalls).toBe(1); expect(q).toBeDefined();
    await flush(); expect(sent).toEqual([]);
    p.confirm(); await flush(); expect(sent).toEqual([]);
    q!.confirm(); await flush(); expect(sent).toEqual([7]);
    expect(r.inspect()).toEqual(pendingR); await c.settled();
  } finally { release(); c.dispose(); target.destroy(); later.destroy(); reentrant.destroy(); source.destroy(); }
});

it('owner settled by scalar preparation does not remain a pending installation obligation', async () => {
  const source = make(); const later = make(); const target = make();
  const sent: number[] = []; const c = link(target.$.x, { set: value => { sent.push(value); } });
  const p = source.transact(() => source.$.x(1)); let calls = 0;
  const release = preparePublicationMutations(target.$.x, () => { calls++; p.confirm(); return undefined; }, () => { /* Intentionally inert fixture hook; the surrounding protocol is asserted. */ })!;
  try {
    target.$.x(7);
    const q = later.transact(() => later.$.x(2)); const pendingQ = q.inspect();
    await flush(); expect(calls).toBe(1); expect(sent).toEqual([7]);
    expect(q.inspect()).toEqual(pendingQ); await c.settled();
  } finally { release(); c.dispose(); target.destroy(); later.destroy(); source.destroy(); }
});

// SPEC admission3 applies to unobserved undeclared authored facts. Authentic
// transaction ownership identifies who may settle a write; it does not certify
// that the callback had no hidden input from another still-pending owner.
it('native transaction authorship does not certify independence from a hidden foreign pending input', async () => {
  const source = make(); const later = make(); const target = make();
  const sent: number[] = []; const c = link(target.$.x, { set: value => { sent.push(value); } });
  try {
    const q = source.transact(() => source.$.x(7));
    const p = target.transact(() => target.$.x(source.$.x()));
    const r = later.transact(() => later.$.x(9)); const pendingR = r.inspect();
    await flush(); expect(target.$.x()).toBe(7); expect(sent).toEqual([]);
    p.confirm(); await flush(); expect(sent).toEqual([]);
    q.confirm(); await flush(); expect(sent).toEqual([7]);
    expect(r.inspect()).toEqual(pendingR); await c.settled();
  } finally { c.dispose(); target.destroy(); later.destroy(); source.destroy(); }
});
