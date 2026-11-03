import { describe, expect, it } from 'vitest';
import { signalTree, createSignalTreeFactory } from '../signal-tree';
import { transactions } from '../../enhancers/transactions/transactions';
import { getPathNotifier } from '../path-notifier';
import { getActiveWriteContext, withWriteContext } from '../write-context';
import type { WriteMetadata } from '../types';
import { createTreeScalarLeafRuntime } from './tree-scalar-leaf-runtime';
import { createNativeTreeScalarLeafRuntime } from './native-tree-scalar-leaf-runtime';
import { prepareTerminalMutations, preparePublicationMutations } from './intrinsic-mutation';
import { replaceLocation } from './location-runtime';
import type { ObservationAdapter } from './observation-adapter';
import type { WritableCell } from './cell-runtime';
import { scalarAdmissionMetadata } from './scalar-admission-metadata';
import { getTreeScalarSlotRuntime } from './tree-scalar-slot-port';
import { getOwnedPositionIds } from './owned-mutation';

// Existing a1-publication-installation pattern: actual native kernel carrier,
// controlled observation adapter; not a claim about framework UI scheduling.
const observation: ObservationAdapter = {
  createToken: () => ({ observe: () => undefined, invalidate: () => undefined }),
  runInvalidationGroup: run => run(),
  createWritableCell: <T>(read: () => T) => {
    const cell: WritableCell<T> = Object.assign(() => read(), {
      set: (_value: T) => undefined,
      update: (_fn: (current: T) => T) => undefined,
      asReadonly: () => read,
    });
    return { cell, peek: read, token: { observe: () => undefined, invalidate: () => undefined } };
  },
};
const nativeTree = createSignalTreeFactory(observation, clock => createNativeTreeScalarLeafRuntime(clock, observation));
const ambient: WriteMetadata = { transactionId: 73, transactionOwner: {}, participation: 'authored' };

for (const native of [false, true]) describe(`realization admission (${native ? 'native' : 'neutral'})`, () => {
  for (const method of ['prepareCommit', 'commit'] as const) {
    it(`${method} keeps realized B outside outer authored A/C`, () => {
      const tree = (native ? nativeTree : signalTree)({ a: 0, b: 0, c: 0 }, { enhancers: [transactions()] });
      const seen: Array<string | undefined> = [];
      const release = preparePublicationMutations(tree.$.b, mutation => {
        seen.push(mutation.admissionParticipation);
        return undefined;
      }, () => undefined)!;
      try {
        const runtime = getTreeScalarSlotRuntime(tree.$)!;
        const position = getOwnedPositionIds(tree.$.b)![0];
        const slot = runtime.resolveScalarSlot(position)!;
        const pending = tree.transact(() => {
          replaceLocation(tree.$.a, 1);
          const context = getActiveWriteContext();
          const frame = runtime.beginFrame(); frame.set(slot, 2);
          if (method === 'prepareCommit') frame.prepareCommit!({ admissionParticipation: 'realized' })();
          else frame.commit({ admissionParticipation: 'realized' });
          expect(getActiveWriteContext()).toBe(context);
          replaceLocation(tree.$.c, 3);
        });
        getPathNotifier().flushSync();
        expect(tree.$()).toEqual({ a: 1, b: 2, c: 3 });
        expect(seen).toEqual(['realized']);
        pending.rollback(); getPathNotifier().flushSync();
        expect(tree.$()).toEqual({ a: 0, b: 2, c: 0 });
        replaceLocation(tree.$.b, 4); getPathNotifier().flushSync();
        expect(tree.$.b()).toBe(4);
        expect(seen).toEqual(['realized', undefined]);
      } finally { release(); tree.destroy(); }
    });
  }

  for (const sameSource of [false, true]) it(`preparation reentry to ${sameSource ? 'same' : 'other'} source stays authored and survives outer refusal`, () => {
    const runtime = native ? createNativeTreeScalarLeafRuntime(undefined, observation) : createTreeScalarLeafRuntime(undefined);
    const leaf = runtime.createLeaf<number>(0, Object.is, 10);
    const other = runtime.createLeaf<number>(0, Object.is, 11);
    const records = new Map<string, number>();
    const seen: Array<{ source: string; flag: string | undefined; participation: string | undefined }> = [];
    const releases = [ ['leaf', leaf], ['other', other] ] .map(([name, node]) => {
      const source = name as string;
      return prepareTerminalMutations(node as object, mutation => {
        expect(getActiveWriteContext()).toBe(ambient);
        const meta = scalarAdmissionMetadata(getActiveWriteContext(), mutation);
        seen.push({ source, flag: mutation.admissionParticipation, participation: meta.participation });
        return { writes: [{ map: records, key: source, value: mutation.after }], adds: [] };
      })!;
    });
    let entered = 0;
    const release = preparePublicationMutations(leaf, mutation => {
      expect(getActiveWriteContext()).toBe(ambient);
      if (mutation.after === 7) {
        entered++;
        replaceLocation(sameSource ? leaf : other, 9);
      }
      return undefined;
    }, () => undefined)!;
    try {
      withWriteContext(ambient, () => {
        const frame = runtime.beginFrame(); frame.set(runtime.resolveScalarSlot(10)!, 7);
        expect(() => frame.prepareCommit!({ admissionParticipation: 'realized' })).toThrow('Reentrant scalar preparation');
        expect(getActiveWriteContext()).toBe(ambient);
        expect(entered).toBe(1);
        expect(leaf()).toBe(sameSource ? 9 : 0); expect(other()).toBe(sameSource ? 0 : 9);
        expect([...records]).toEqual([[sameSource ? 'leaf' : 'other', 9]]);
        expect(seen).toEqual([
          { source: 'leaf', flag: 'realized', participation: 'realized' },
          { source: sameSource ? 'leaf' : 'other', flag: undefined, participation: 'authored' },
        ]);
        replaceLocation(other, 10);
        expect(records.get('other')).toBe(10);
        expect(seen.at(-1)).toEqual({ source: 'other', flag: undefined, participation: 'authored' });
      });
      expect(getActiveWriteContext()).toBeUndefined();
    } finally { release(); for (const stop of releases) stop(); }
  });

  it('equality sees caller context; thrown undefined preserves value and allows later authored work', () => {
    const runtime = native ? createNativeTreeScalarLeafRuntime(undefined, observation) : createTreeScalarLeafRuntime(undefined);
    let armed = true, calls = 0;
    const leaf = runtime.createLeaf<number>(0, (a, b) => {
      expect(getActiveWriteContext()).toBe(ambient); calls++;
      if (armed) { armed = false; throw undefined; }
      return Object.is(a, b);
    }, 10);
    const flags: Array<string | undefined> = [];
    const release = prepareTerminalMutations(leaf, mutation => { flags.push(mutation.admissionParticipation); return undefined; })!;
    try {
      withWriteContext(ambient, () => {
        const frame = runtime.beginFrame(); frame.set(runtime.resolveScalarSlot(10)!, 7);
        let threw = false;
        try { frame.commit({ admissionParticipation: 'realized' }); }
        catch (error) { threw = true; expect(error).toBeUndefined(); }
        expect(threw).toBe(true); expect(leaf()).toBe(0); expect(flags).toEqual([]);
        expect(getActiveWriteContext()).toBe(ambient);
        replaceLocation(leaf, 8); expect(leaf()).toBe(8); expect(flags).toEqual([undefined]);
        expect(calls).toBeGreaterThanOrEqual(2);
      });
      expect(getActiveWriteContext()).toBeUndefined();
    } finally { release(); }
  });
});
