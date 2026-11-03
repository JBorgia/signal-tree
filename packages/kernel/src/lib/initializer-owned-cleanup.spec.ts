import { expect, it, vi } from 'vitest';
import { signalTree, restoration } from '../index';
import { getOrCreateInternalTransactionRuntime } from '../enhancers/transactions/transactions';
import { getPathNotifier } from './path-notifier';
import { getMutationCaptureRuntime } from './internals/mutation-capture-runtime';
import { prepareTerminalMutations } from './internals/intrinsic-mutation';

it('unwinds only failed initializer registrations and leaves the caller tree and terminal owner usable', () => {
  const tree = signalTree({ a: 0, b: 0 }, { enhancers: [restoration()] });
  const notifier = getPathNotifier();
  const capture = getMutationCaptureRuntime(tree)!;
  let ownerCalls = 0;
  const owner = prepareTerminalMutations(tree.$.b, () => {
    ownerCalls++;
    return { writes: [], adds: [] };
  })!;
  const active = { subscribe: 0, reset: 0, enqueue: 0, structural: 0, order: 0 };
  const registered = { ...active };
  const track = (key: keyof typeof active, off: () => void) => {
    active[key]++; registered[key]++;
    let live = true;
    return () => { if (!live) return; live = false; active[key]--; off(); };
  };
  const subscribe = notifier.subscribe.bind(notifier);
  const reset = notifier.onReset!.bind(notifier);
  const enqueue = notifier.observeEnqueue.bind(notifier);
  const structural = capture.subscribeStructuralWitness!.bind(capture);
  const order = capture.subscribeCollectionOrder!.bind(capture);
  const spies = [
    vi.spyOn(notifier, 'subscribe').mockImplementation((...args) => track('subscribe', subscribe(...args))),
    vi.spyOn(notifier, 'onReset').mockImplementation((...args) => track('reset', reset(...args))),
    vi.spyOn(notifier, 'observeEnqueue').mockImplementation((...args) => track('enqueue', enqueue(...args))),
    vi.spyOn(capture, 'subscribeStructuralWitness').mockImplementation((...args) => track('structural', structural(...args))),
    vi.spyOn(capture, 'subscribeCollectionOrder').mockImplementation((...args) => track('order', order(...args))),
  ];
  try {
    expect(() => getOrCreateInternalTransactionRuntime(tree)).toThrow('Terminal preparation already owned');
    for (const key of Object.keys(active) as Array<keyof typeof active>) {
      // Enqueue observation is demand-enrolled only once a pending turn exists.
      if (key === 'enqueue') expect(registered[key]).toBe(0);
      else expect(registered[key], key).toBeGreaterThan(0);
      expect(active[key], key).toBe(0);
    }
    expect(capture.prepareScalarResponsibility).toBeUndefined();
    expect(capture.prepareMemberResponsibility).toBeUndefined();
    expect(capture.prepareEntityResponsibility).toBeUndefined();
    const aOwner = prepareTerminalMutations(tree.$.a, () => ({ writes: [], adds: [] }));
    expect(aOwner).toBeDefined(); aOwner!();
    tree.$.b(1);
    expect(tree.$()).toEqual({ a: 0, b: 1 });
    expect(ownerCalls).toBe(1);
    tree.destroy(); tree.destroy();
    expect(Object.values(active)).toEqual([0, 0, 0, 0, 0]);
  } finally {
    owner(); tree.destroy();
    for (const spy of spies) spy.mockRestore();
  }
});
