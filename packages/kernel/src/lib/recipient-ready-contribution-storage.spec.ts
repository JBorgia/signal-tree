import { describe, expect, it } from 'vitest';
import { entityMap, link, signalTree, transactions } from '../index';
import * as lifecycle from './experimental-publication/lifecycle';
import { RecipientOccurrences } from './experimental-publication/recipient-occurrence';
import { getPathNotifier } from './path-notifier';

const owner = (id: number): lifecycle.OwnerCell => ({ owner: 912345, id, outcome: 'pending', dependents: new Set() });
const requirement = (proof: lifecycle.Proof): lifecycle.NativeRequirement => ({ ...lifecycle.initialRequirement(), proof });
const makeIndex = () => new RecipientOccurrences(() => { throw Error('Ready slots cannot schedule readiness work'); }, () => lifecycle.initialRequirement());
const storage = (index: RecipientOccurrences) => [...(index as unknown as {
  groups: Map<object, { entries: Map<unknown, { counts: unknown; onProof?: unknown; release?: unknown }> }>;
}).groups.values()].flatMap(group => [...group.entries].filter(([key]) => typeof key === 'string').map(([, entry]) => entry));

describe('ready recipient contribution storage', () => {
  it('keeps direct replacements on their original independent allocation path', () => {
    const tree = signalTree({ value: 0 }), index = makeIndex();
    try {
      const handle = index.enroll(tree.$.value), value = requirement({ owners: [owner(1)], unknown: true, invalid: false });
      index.replace(handle, 'one', value);
      index.replace(handle, 'two', value);
      expect(storage(index)[0]).not.toBe(storage(index)[1]);
      expect(storage(index)[0].counts).not.toBe(storage(index)[1].counts);
      expect(Object.isFrozen(storage(index)[0])).toBe(false);
    } finally { index.dispose(); tree.destroy(); }
  });

  it('isolates nested batches and never freezes the owner cells', () => {
    const tree = signalTree({ value: 0 }), index = makeIndex();
    const a = owner(1), b = owner(2);
    try {
      const handle = index.enroll(tree.$.value), outer = requirement({ owners: [a], unknown: false, invalid: false }), inner = requirement({ owners: [b], unknown: false, invalid: false });
      index.replaceEntries(handle, (function* (): IterableIterator<readonly [string, lifecycle.NativeRequirement]> {
        yield ['outer1', outer];
        index.replaceEntries(handle, [['inner1', inner], ['inner2', inner]]);
        yield ['outer2', outer];
      })());
      const entries = storage(index);
      expect(entries).toHaveLength(4);
      expect(entries[0]).toBe(entries[3]);
      expect(entries[1]).toBe(entries[2]);
      expect(entries[0]).not.toBe(entries[1]);
      expect(entries.every(Object.isFrozen)).toBe(true);
      expect(Object.isFrozen(a)).toBe(false);
      a.outcome = 'confirmed';
      expect(index.proof().owners).toEqual([a, b]);
    } finally { index.dispose(); tree.destroy(); }
  });

  it('rechecks disposed handles after an iterator resumes and preserves its first installed slot', () => {
    const tree = signalTree({ value: 0 }), index = makeIndex();
    try {
      const handle = index.enroll(tree.$.value), value = requirement({ owners: [owner(1)], unknown: true, invalid: false });
      let witnessed = false;
      expect(() => index.replaceEntries(handle, (function* (): IterableIterator<readonly [string, lifecycle.NativeRequirement]> {
        yield ['one', value];
        witnessed = storage(index).length === 1;
        index.dispose();
        yield ['two', value];
      })())).toThrow('Stale occurrence handle');
      expect(witnessed).toBe(true);
      expect(index.inspect().slots).toBe(0);
    } finally { index.dispose(); tree.destroy(); }
  });

  it('preserves an iterator throw without retaining its cache for a later batch', () => {
    const tree = signalTree({ value: 0 }), index = makeIndex();
    const failure = { exact: 'iterator' };
    try {
      const handle = index.enroll(tree.$.value), value = requirement({ owners: [owner(1)], unknown: true, invalid: false });
      let caught: unknown;
      try { index.replaceEntries(handle, (function* (): IterableIterator<readonly [string, lifecycle.NativeRequirement]> {
        yield ['old', value];
        throw failure;
      })()); } catch (error) { caught = error; }
      expect(caught).toBe(failure);
      expect(storage(index)).toHaveLength(1);
      const old = storage(index)[0];
      index.replaceEntries(handle, [['one', value], ['two', value]]);
      expect(storage(index)[1]).toBe(storage(index)[2]);
      expect(storage(index)[1]).not.toBe(old);
      expect(Object.isFrozen(old)).toBe(false);
    } finally { index.dispose(); tree.destroy(); }
  });

  it('shares the actual bulk rollback membership entries without removing any address', async () => {
    type Row = { id: string; value: number };
    const descriptor = Object.getOwnPropertyDescriptor(Map.prototype, 'set')!;
    const original = Map.prototype.set;
    const maps = new Set<Map<unknown, unknown>>();
    Object.defineProperty(Map.prototype, 'set', { ...descriptor, value: function(this: Map<unknown, unknown>, key: unknown, value: unknown) {
      const result = Reflect.apply(original, this, [key, value]);
      if (value && typeof value === 'object' && 'counts' in value) maps.add(this);
      return result;
    } });
    const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
    const sent: unknown[] = [];
    const connection = link(tree.$.rows, { set: value => { sent.push(value); } });
    const flush = async () => { getPathNotifier().flushSync(); for (let n = 0; n < 160; n++) await Promise.resolve(); };
    try {
      const pending = tree.transact(() => tree.$.rows.setAll(Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, value: i }))));
      await flush();
      expect(sent).toEqual([]);
      pending.rollback();
      await flush();
      expect(sent).toEqual([[]]);
      const membershipMaps = [...maps].filter(map => map.size === 20 && [...map.keys()].every(key => typeof key === 'string' && /^\d+:m$/.test(key)));
      expect(membershipMaps).toHaveLength(1);
      expect(new Set(membershipMaps[0].values()).size).toBe(1);
      expect([...membershipMaps[0].keys()]).toHaveLength(20);
    } finally {
      Object.defineProperty(Map.prototype, 'set', descriptor);
      connection.dispose();
      tree.destroy();
    }
  });

  for (const acquire of [false, true]) {
    it(`preserves the empty inbound baseline and exact later receipt: acquire=${acquire}`, async () => {
      type Row = { id: string; value: number };
      const tree = signalTree({ rows: entityMap<Row, string>() }, { enhancers: [transactions()] });
      const sent: unknown[] = [];
      let incoming!: (rows: Row[]) => void;
      const connection = link(tree.$.rows, {
        set: rows => { sent.push(rows); },
        subscribe: next => { incoming = next; return () => { /* The fixture has no external subscription. */ }; },
      }) as ReturnType<typeof link> & { declare(input: { kind: 'independent' }, work: () => unknown): { read(): { state: string; basis?: string } } };
      const flush = async () => { getPathNotifier().flushSync(); for (let n = 0; n < 160; n++) await Promise.resolve(); };
      try {
        const pending = tree.transact(() => tree.$.rows.setAll(Array.from({ length: 20 }, (_, i) => ({ id: `r${i}`, value: i }))));
        await flush();
        expect(sent).toEqual([]);
        pending.rollback();
        await flush();
        expect(sent).toEqual([[]]);
        if (acquire) incoming([]);
        await flush();
        expect(sent).toEqual([[]]);
        const receipt = connection.declare({ kind: 'independent' }, () => tree.$.rows.addOne({ id: 'new', value: 777 }));
        await flush();
        expect(sent).toEqual([[], [{ id: 'new', value: 777 }]]);
        expect(receipt.read()).toEqual({ state: 'started', basis: acquire ? 'declared' : 'surviving' });
      } finally { connection.dispose(); tree.destroy(); }
    });
  }

  for (const role of ['owners', 'destination', 'input', 'validation', 'possible'] as const) {
    it(`recaptures an in-place change only to ${role}`, () => {
      const tree = signalTree({ value: 0 }), index = makeIndex();
      const a = owner(1), b = owner(2);
      const proof = { owners: [a], destination: [a], input: [a], validation: [a], possible: [a], unknown: true, invalid: false };
      try {
        const handle = index.enroll(tree.$.value), value = requirement(proof);
        index.replaceEntries(handle, (function* (): IterableIterator<readonly [string, lifecycle.NativeRequirement]> {
          yield ['old', value];
          proof[role][0] = b;
          yield ['new', value];
        })());
        expect(storage(index)[0].counts).not.toBe(storage(index)[1].counts);
        index.replace(handle, 'old');
        expect(index.proof()[role]).toEqual([b]);
        index.replace(handle, 'new');
        expect(index.proof()[role]).toEqual([]);
      } finally { index.dispose(); tree.destroy(); }
    });
  }

  for (const flag of ['unknown', 'invalid', 'unavailableInput', 'historicalWindow'] as const) {
    it(`recaptures a change only to ${flag}`, () => {
      const tree = signalTree({ value: 0 }), index = makeIndex();
      const a = owner(1);
      const proof = { owners: [a], unknown: false, invalid: false, unavailableInput: false, historicalWindow: false };
      try {
        const handle = index.enroll(tree.$.value), value = requirement(proof);
        index.replaceEntries(handle, (function* (): IterableIterator<readonly [string, lifecycle.NativeRequirement]> {
          yield ['old', value];
          proof[flag] = true;
          yield ['new', value];
        })());
        expect(storage(index)[0].counts).not.toBe(storage(index)[1].counts);
        index.replace(handle, 'old');
        expect(index.proof()[flag]).toBe(true);
        index.replace(handle, 'new');
        expect(index.proof()[flag]).toBe(false);
      } finally { index.dispose(); tree.destroy(); }
    });
  }

  it('recaptures a change only to the rejected-role bits', () => {
    const tree = signalTree({ value: 0 }), index = makeIndex();
    const a = owner(1);
    const proof = { owners: [a], unknown: false, invalid: false, terminalRejectedRoles: 1 };
    try {
      const handle = index.enroll(tree.$.value), value = requirement(proof);
      index.replaceEntries(handle, (function* (): IterableIterator<readonly [string, lifecycle.NativeRequirement]> {
        yield ['old', value];
        proof.terminalRejectedRoles = 4;
        yield ['new', value];
      })());
      expect(storage(index)[0].counts).not.toBe(storage(index)[1].counts);
      index.replace(handle, 'old');
      expect(index.proof().terminalRejectedRoles).toBe(4);
      index.replace(handle, 'new');
      expect(index.proof().terminalRejectedRoles).toBe(0);
    } finally { index.dispose(); tree.destroy(); }
  });

  it('shares an exact ready snapshot while retaining independent addresses and multiplicities', () => {
    const tree = signalTree({ value: 0 }), index = makeIndex();
    const a = owner(1), b = owner(2);
    const proof: lifecycle.Proof = { owners: [a, a, b], destination: [a], input: [b], unknown: true, invalid: false };
    try {
      const handle = index.enroll(tree.$.value), value = requirement(proof);
      const inheritedSlots = index.inspect().slots;
      index.replaceEntries(handle, [['one', value], ['two', value]]);
      expect(index.inspect()).toMatchObject({ slots: inheritedSlots + 2, subscriptions: 0, finalized: 0 });
      expect(index.proof().owners).toEqual([a, b]);
      const entries = storage(index);
      expect(entries).toHaveLength(2);
      expect(entries[0].counts).toBe(entries[1].counts);
      expect(entries[0]).toBe(entries[1]);
      index.replace(handle, 'one');
      expect(index.inspect().slots).toBe(inheritedSlots + 1);
      expect(index.proof()).toMatchObject({ owners: [a, b], destination: [a], input: [b], unknown: true });
      index.replace(handle, 'two');
      expect(index.inspect().slots).toBe(inheritedSlots);
      expect(index.proof()).toMatchObject({ owners: [], destination: [], input: [], unknown: false });
    } finally { index.dispose(); tree.destroy(); }
  });

  it('recaptures a mutated proof object and preserves the older slot snapshot', () => {
    const tree = signalTree({ value: 0 }), index = makeIndex();
    const a = owner(1), b = owner(2), c = owner(3);
    const proof = { owners: [a, a], destination: [a], input: [b], validation: [c], possible: [b], unknown: true, invalid: false, unavailableInput: false, historicalWindow: true, terminalRejectedRoles: 1 };
    try {
      const handle = index.enroll(tree.$.value), value = requirement(proof);
      index.replaceEntries(handle, (function* (): IterableIterator<readonly [string, lifecycle.NativeRequirement]> {
        yield ['old', value];
        proof.owners.splice(0, 2, b, b);
        proof.destination.splice(0, 1, b);
        proof.input.splice(0, 1, c);
        proof.validation.splice(0, 1, a);
        proof.possible.splice(0, 1, c);
        proof.unknown = false;
        proof.invalid = true;
        proof.unavailableInput = true;
        proof.historicalWindow = false;
        proof.terminalRejectedRoles = 4;
        yield ['new', value];
      })());
      expect(storage(index)[0].counts).not.toBe(storage(index)[1].counts);
      expect(index.proof()).toMatchObject({ owners: [a, b], destination: [a, b], input: [b, c], validation: [c, a], possible: [b, c], unknown: true, invalid: true, unavailableInput: true, historicalWindow: true, terminalRejectedRoles: 5 });
      index.replace(handle, 'old');
      expect(index.proof()).toEqual({ ...proof, owners: [b] });
      // Reuse the very same object again with a duplicate-count change. A
      // cached older contribution must not underflow when this slot is removed.
      proof.owners.pop();
      index.replace(handle, 'new', value);
      index.replace(handle, 'new');
      expect(index.proof()).toMatchObject({ owners: [], destination: [], input: [], validation: [], possible: [], unknown: false, invalid: false, terminalRejectedRoles: 0 });
    } finally { index.dispose(); tree.destroy(); }
  });

  it('keeps callback-bearing entries separate and preserves a reentrant replacement', () => {
    const tree = signalTree({ value: 0 }), index = makeIndex();
    const a = owner(1), b = owner(2);
    const original = requirement({ owners: [a], unknown: false, invalid: false });
    const replacement = requirement({ owners: [b], unknown: false, invalid: false });
    let first = 0, second = 0;
    try {
      const handle = index.enroll(tree.$.value);
      index.replace(handle, 'one', original, () => { first++; });
      index.replace(handle, 'two', original, () => { second++; index.replace(handle, 'two', replacement); });
      expect([first, second]).toEqual([1, 1]);
      expect(storage(index)[0]).not.toBe(storage(index)[1]);
      expect(index.proof().owners).toEqual([a, b]);
      index.replace(handle, 'one');
      expect(index.proof().owners).toEqual([b]);
      expect([first, second]).toEqual([1, 1]);
    } finally { index.dispose(); tree.destroy(); }
  });

  for (const pattern of ['alternating', 'unique'] as const) {
    it(`preserves independent snapshots when ${pattern} proofs miss the one-item cache`, () => {
      const tree = signalTree({ value: 0 }), index = makeIndex();
      const cells = Array.from({ length: pattern === 'alternating' ? 2 : 40 }, (_, id) => owner(id));
      const proofs = cells.map(cell => ({ owners: [cell, cell], destination: [cell], unknown: false, invalid: false }));
      try {
        const handle = index.enroll(tree.$.value);
        index.replaceEntries(handle, Array.from({ length: 40 }, (_, n) => [`entry${n}`, requirement(proofs[n % proofs.length])] as const));
        expect(storage(index)).toHaveLength(40);
        expect(new Set(storage(index)).size).toBe(40);
        expect(index.proof().owners).toEqual(cells);
        for (const proof of proofs) { proof.owners.length = 0; proof.destination.length = 0; }
        // The slots retain the captured snapshots, independently of the now
        // empty input objects and independently of subsequent cache misses.
        expect(index.proof().owners).toEqual(cells);
        for (let n = 0; n < 40; n++) index.replace(handle, `entry${n}`);
        expect(index.proof()).toMatchObject({ owners: [], destination: [] });
      } finally { index.dispose(); tree.destroy(); }
    });
  }
});
