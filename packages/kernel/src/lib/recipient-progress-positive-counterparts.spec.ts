import { expect, it, vi } from 'vitest';
import { link, signalTree, transactions } from '../index';
import * as lifecycle from './experimental-publication/lifecycle';
import { getPathNotifier } from './path-notifier';

type Receipt = {
  read(): Readonly<{ state: string; basis?: string; reason?: string }>;
};
type Declared = ReturnType<typeof link> & {
  declare(input: { kind: 'independent' }, work: () => unknown): Receipt;
};
const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 100; i++) await Promise.resolve();
};
function admissionWitness() {
  const registrations = vi.spyOn(lifecycle, 'registerConnection');
  const original = lifecycle.started;
  const admissions: Array<{
    channel: object;
    declared: boolean;
    basis: string | undefined;
  }> = [];
  const starts = vi
    .spyOn(lifecycle, 'started')
    .mockImplementation((...args) => {
      // Sample permission before started can retire the operation; preserve the real call.
      admissions.push({
        channel: args[0],
        declared: lifecycle.hasDeclaration(args[0], args[1]),
        basis: args[2],
      });
      return original(...args);
    });
  return {
    channel: () => registrations.mock.calls.at(-1)![0],
    forChannel: (channel: object) =>
      admissions.filter((entry) => entry.channel === channel),
    dispose: () => {
      starts.mockRestore();
      registrations.mockRestore();
    },
  };
}

// Separate counterparts: the original six first-failure bodies remain untouched.
for (const mode of ['branch', 'root'] as const)
  for (const enrollment of ['before-pending', 'during-pending'] as const)
    for (const terminal of ['confirm', 'rollback'] as const)
      it(`aggregate exact progress ${mode}/${enrollment}/${terminal}`, async () => {
        const witness = admissionWitness();
        const owner = signalTree({ z: 0 }, { enhancers: [transactions()] });
        const tree = signalTree(
          { pair: { x: 0, y: 0 }, x: 0, y: 0 },
          { enhancers: [transactions()] }
        );
        const sent: unknown[] = [],
          secondary: unknown[] = [];
        const source = mode === 'branch' ? tree.$.pair : tree.$;
        const primary = link(source, {
          set: (value) => {
            sent.push(value);
          },
        }) as Declared;
        const primaryChannel = witness.channel();
        let other: ReturnType<typeof link> | undefined;
        let secondaryChannel!: object;
        const enroll = () => {
          other = link(source, {
            set: (value) => {
              secondary.push(value);
            },
          });
          secondaryChannel = witness.channel();
        };
        if (enrollment === 'before-pending') enroll();
        const p = owner.transact(() => owner.$.z(7));
        if (enrollment === 'during-pending') enroll();
        try {
          await flush();
          expect(sent).toEqual([]);
          expect(secondary).toEqual([]);
          const before = p.inspect();
          let calls = 0;
          const receipt = primary.declare({ kind: 'independent' }, () => {
            if (mode === 'branch')
              tree.$.pair((input) => {
                calls++;
                return { x: input.x + 1, y: input.y };
              });
            else
              tree.$((input) => {
                calls++;
                return { ...input, x: input.x + 1 };
              });
          });
          const expected =
            mode === 'branch'
              ? { x: 1, y: 0 }
              : { pair: { x: 0, y: 0 }, x: 1, y: 0 };
          await flush();
          expect(calls).toBe(1);
          expect(source()).toEqual(expected);
          expect(sent).toEqual([expected]);
          expect(secondary).toEqual([expected]);
          expect(receipt.read()).toEqual({
            state: 'started',
            basis: 'declared',
          });
          expect(witness.forChannel(primaryChannel)).toEqual([
            { channel: primaryChannel, declared: true, basis: 'declared' },
          ]);
          expect(witness.forChannel(secondaryChannel)).toEqual([
            { channel: secondaryChannel, declared: false, basis: 'surviving' },
          ]);
          expect(p.inspect()).toEqual(before);
          expect(owner.$.z()).toBe(7);
          await primary.settled();
          await other!.settled();
          p[terminal]();
          await flush();
          expect(owner.$.z()).toBe(terminal === 'confirm' ? 7 : 0);
          expect(source()).toEqual(expected);
          expect(sent).toEqual([expected]);
          expect(secondary).toEqual([expected]);
          expect(witness.forChannel(primaryChannel)).toHaveLength(1);
          expect(witness.forChannel(secondaryChannel)).toHaveLength(1);
          expect(receipt.read()).toEqual({
            state: 'started',
            basis: 'declared',
          });
          await primary.settled();
          await other!.settled();
        } finally {
          primary.dispose();
          other?.dispose();
          tree.destroy();
          owner.destroy();
          witness.dispose();
        }
      });

for (const nativeWindow of [false, true])
  for (const terminal of ['confirm', 'rollback'] as const)
    it(`${
      nativeWindow ? 'actual native window' : 'domain-only'
    } root input / branch output ${terminal}`, async () => {
      const witness = admissionWitness();
      const owner = signalTree({ z: 0 }, { enhancers: [transactions()] });
      const lateOwner = signalTree({ z: 0 }, { enhancers: [transactions()] });
      const tree = signalTree({ x: 0, pair: { x: 0, y: 0 } });
      const sent: unknown[] = [],
        secondary: unknown[] = [];
      const primary = link(tree.$.pair, {
        set: (value) => {
          sent.push(value);
        },
      }) as Declared;
      const primaryChannel = witness.channel();
      const other = link(tree.$.pair, {
        set: (value) => {
          secondary.push(value);
        },
      });
      const secondaryChannel = witness.channel();
      const p = owner.transact(() => owner.$.z(7));
      const evidence: lifecycle.RecipientUncertainty[] = [],
        proofs: lifecycle.Proof[] = [];
      const prepare = lifecycle.prepareRevision,
        project = lifecycle.projectRevision;
      const preparation = vi
        .spyOn(lifecycle, 'prepareRevision')
        .mockImplementation((...args) => {
          if (args[3]) evidence.push(args[3]);
          return prepare(...args);
        });
      const projection = vi
        .spyOn(lifecycle, 'projectRevision')
        .mockImplementation((...args) => {
          const proof = project(...args);
          proofs.push(proof);
          return proof;
        });
      let late: ReturnType<typeof lateOwner.transact> | undefined;
      try {
        if (nativeWindow) tree.$.x(7); // Capture genuine possible support in the root input, outside either recipient.
        await flush();
        expect(sent).toEqual([]);
        expect(secondary).toEqual([]);
        const ownership = p.inspect();
        let calls = 0;
        const receipt = primary.declare({ kind: 'independent' }, () =>
          tree.$((input) => {
            calls++;
            return { ...input, pair: { x: input.x + 1, y: input.pair.y } };
          })
        );
        const expected = { x: nativeWindow ? 8 : 1, y: 0 };
        await flush();
        expect(calls).toBe(1);
        expect(tree.$.pair()).toEqual(expected);
        expect(tree.$.x()).toBe(nativeWindow ? 7 : 0);
        expect(p.inspect()).toEqual(ownership);
        expect(owner.$.z()).toBe(7);
        expect(evidence.some((entry) => entry.recipientDomain)).toBe(true);
        expect(
          evidence.every(
            (entry) =>
              !entry.unobservedOrigin &&
              !entry.invalidAttribution &&
              !entry.uncapturedUpdaterInput
          )
        ).toBe(true);
        expect(proofs.some((proof) => proof.unknown)).toBe(true);
        if (nativeWindow) {
          expect(sent).toEqual([]);
          expect(secondary).toEqual([]);
          expect(witness.forChannel(primaryChannel)).toEqual([]);
          expect(witness.forChannel(secondaryChannel)).toEqual([]);
          expect(receipt.read()).toMatchObject({
            state: 'conservative',
            reason: 'unknown',
          });
          expect(
            proofs.some((proof) =>
              proof.possible?.some((cell) => cell.outcome === 'pending')
            )
          ).toBe(true);
        } else {
          expect(sent).toEqual([expected]);
          expect(secondary).toEqual([expected]);
          expect(receipt.read()).toEqual({
            state: 'started',
            basis: 'surviving',
          });
          expect(witness.forChannel(primaryChannel)).toEqual([
            { channel: primaryChannel, declared: true, basis: 'surviving' },
          ]);
          expect(witness.forChannel(secondaryChannel)).toEqual([
            { channel: secondaryChannel, declared: false, basis: 'surviving' },
          ]);
          await primary.settled();
          await other.settled();
        }
        // Preserve the classifier's unrelated later operation and later pending-owner isolation.
        const transient = owner.transact(() => owner.$.z(8));
        transient.confirm();
        late = lateOwner.transact(() => lateOwner.$.z(9));
        const lateInspection = late.inspect();
        let settled = false;
        const wait = other.settled().then(() => {
          settled = true;
        });
        await flush();
        expect(settled).toBe(!nativeWindow);
        expect(sent).toEqual(nativeWindow ? [] : [expected]);
        expect(secondary).toEqual(nativeWindow ? [] : [expected]);
        p[terminal]();
        await flush();
        expect(sent).toEqual([expected]);
        expect(secondary).toEqual([expected]);
        expect(tree.$.pair()).toEqual(expected);
        expect(tree.$.x()).toBe(nativeWindow ? 7 : 0);
        expect(receipt.read()).toEqual({
          state: 'started',
          basis: 'surviving',
        });
        expect(witness.forChannel(primaryChannel)).toEqual([
          { channel: primaryChannel, declared: true, basis: 'surviving' },
        ]);
        expect(witness.forChannel(secondaryChannel)).toEqual([
          { channel: secondaryChannel, declared: false, basis: 'surviving' },
        ]);
        expect(settled).toBe(true);
        await wait;
        await primary.settled();
        expect(late.inspect()).toEqual(lateInspection);
        expect(lateOwner.$.z()).toBe(9);
        late.confirm();
        late = undefined;
        await flush();
        expect(sent).toEqual([expected]);
        expect(secondary).toEqual([expected]);
        expect(witness.forChannel(primaryChannel)).toHaveLength(1);
        expect(witness.forChannel(secondaryChannel)).toHaveLength(1);
      } finally {
        preparation.mockRestore();
        projection.mockRestore();
        primary.dispose();
        other.dispose();
        late?.confirm();
        tree.destroy();
        owner.destroy();
        lateOwner.destroy();
        witness.dispose();
      }
    });
