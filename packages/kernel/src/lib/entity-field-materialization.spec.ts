import { describe, expect, it } from 'vitest';

import { createEntitySignal, type EntitySubjectPhysicalInventory } from './entity-signal';
import { createNativeLocationRuntime } from './internals/native-location-realization';
import { observeIntrinsicMutations } from './internals/intrinsic-mutation';
import { NEUTRAL_LOCATION_RUNTIME, createWritableProjection } from './internals/location-runtime';
import type { ObservationAdapter } from './internals/observation-adapter';
import { getOwnedSubjectIds } from './internals/owned-metadata';
import { entityMap, link, signalTree, transactions } from '../index';

type Row = { id: number; name: string; active: boolean };
type Internal = {
  __acquireEntityHandleForTesting(key: number): { subjectId: number };
  __inspectSubjectResources(id: number): EntitySubjectPhysicalInventory<number>;
  __restoreOne(key: number, value: Row, subject: number): void;
  __retireSubjectRetainedValueBackingForTesting(subject: number): void;
};

function fixture(native = false) {
  let created = 0;
  let onCreate: (() => void) | undefined;
  const adapter: ObservationAdapter = {
    createToken: () => ({ observe: () => undefined, invalidate: () => undefined }),
    createWritableCell: <T>(read: () => T) => ({
      cell: read as never,
      peek: read,
      token: { observe: () => undefined, invalidate: () => undefined },
    }),
    createReadonlyCell: <T>(read: () => T) => read,
    createWritableProjection: <T>(compute: () => T) => {
      created++;
      onCreate?.();
      // Eager native factories must see current subject truth on first access.
      compute();
      return { cell: compute as never, peek: compute };
    },
    runInvalidationGroup: (run) => run(),
  };
  const locations = native ? createNativeLocationRuntime(adapter) : {
    ...NEUTRAL_LOCATION_RUNTIME,
    createWritableProjection: <T>(compute: () => T, write: (value: T, intent: 'replace' | 'derive') => void) => {
      created++;
      onCreate?.();
      return createWritableProjection(NEUTRAL_LOCATION_RUNTIME.createDerived(compute), write);
    },
  };
  const rows = createEntitySignal<Row, number>(
    { selectId: (row) => row.id }, { notify: () => undefined }, 'rows',
    { locationRuntime: locations }
  );
  rows.addOne({ id: 1, name: 'Alice', active: true });
  const node = rows.byIdOrFail(1);
  const internal = rows as typeof rows & Internal;
  const subject = internal.__acquireEntityHandleForTesting(1).subjectId;
  return {
    rows, node, subject, internal,
    inventory: () => internal.__inspectSubjectResources(subject),
    created: () => created,
    onCreate: (callback: (() => void) | undefined) => { onCreate = callback; },
  };
}

for (const native of [false, true]) describe(`field materialization, native=${native}`, () => {
  it('preserves descriptors and keys while allocating only the field actually acquired', () => {
    const f = fixture(native);
    const descriptors = Object.getOwnPropertyDescriptors(f.node);
    // The callable's existing configurable name slot precedes added keys.
    expect(Object.keys(f.node)).toEqual(['name', 'id', 'active']);
    expect(f.node()).toEqual({ id: 1, name: 'Alice', active: true });
    expect(f.inventory().fieldFacadesMaterialized).toEqual([]);
    expect(f.created()).toBe(0);
    expect(descriptors['name']).toMatchObject({ enumerable: true, configurable: true, set: undefined });
    expect(descriptors['name'].get).toBeTypeOf('function');

    f.rows.updateOne(1, { name: 'Bob' });
    const name = f.node.name;
    expect(name()).toBe('Bob');
    expect(f.node.name).toBe(name);
    expect(f.created()).toBe(1);
    expect(f.inventory().fieldFacadesMaterialized).toEqual(['name']);
    expect(Object.getOwnPropertyDescriptors(f.node)).toEqual(descriptors);
    expect(f.created()).toBe(1);
  });

  it('binds first access after rekey, replacement and backing retirement to the original lifetime', () => {
    const f = fixture(native);
    f.rows.changeId(1, 7);
    f.rows.updateOne(7, { name: 'Changed' });
    expect(f.rows.byIdOrFail(7)).toBe(f.node);
    expect(f.node.name()).toBe('Changed');
    f.rows.removeOne(7);
    f.internal.__retireSubjectRetainedValueBackingForTesting(f.subject);
    f.rows.addOne({ id: 7, name: 'Replacement', active: false });

    const late = f.node.active;
    expect(late()).toBeUndefined();
    expect(getOwnedSubjectIds(late)).toEqual([f.subject]);
    expect(() => native ? (late as unknown as { set(value: boolean): void }).set(true) : late(true)).toThrow('not found');
    expect(f.rows.byIdOrFail(7).active()).toBe(false);
    f.rows.removeOne(7);
    f.internal.__restoreOne(7, { id: 1, name: 'Restored', active: true }, f.subject);
    expect(f.rows.byIdOrFail(7)).toBe(f.node);
    expect(f.node.active).toBe(late);
    expect(late()).toBe(true);
    expect(f.node.name()).toBe('Restored');
  });

  it('inventory neither invokes replacement getters nor counts deleted or redefined fields', () => {
    const f = fixture(native);
    expect(Reflect.deleteProperty(f.node, 'active')).toBe(true);
    let replacementReads = 0;
    Object.defineProperty(f.node, 'active', { enumerable: true, configurable: true, get: () => { replacementReads++; throw new Error('Do not inspect by reading'); } });
    expect(f.inventory().fieldFacadesMaterialized).toEqual([]);
    expect(f.created()).toBe(0);
    const name = f.node.name;
    expect(name()).toBe('Alice');
    expect(f.inventory().fieldFacadesMaterialized).toEqual(['name']);
    Object.defineProperty(f.node, 'name', { enumerable: true, configurable: true, value: () => 'replacement' });
    expect(f.inventory().fieldFacadesMaterialized).toEqual([]);
    expect(replacementReads).toBe(0);
    expect(f.created()).toBe(1);
    expect(name()).toBe('Alice');
  });

  it('retries a throwing factory and never caches partial initialization', () => {
    const f = fixture(native);
    const failure = new Error('factory failed');
    f.onCreate(() => { throw failure; });
    expect(() => f.node.name).toThrow(failure);
    expect(f.inventory().fieldFacadesMaterialized).toEqual([]);
    f.onCreate(undefined);
    f.rows.updateOne(1, { name: 'After failure' });
    const name = f.node.name;
    expect(name()).toBe('After failure');
    expect(f.node.name).toBe(name);
    expect(f.created()).toBe(2);
    expect(f.inventory().fieldFacadesMaterialized).toEqual(['name']);
  });

  it('supports factory reentry into another field and rejects a circular initialization without poisoning retry', () => {
    const f = fixture(native);
    let nested: unknown;
    f.onCreate(() => { f.onCreate(undefined); nested = f.node.active; });
    expect(f.node.name()).toBe('Alice');
    expect(f.node.active).toBe(nested);
    expect(f.created()).toBe(2);
    f.onCreate(() => { void f.node.id; });
    expect(() => f.node.id).toThrow('Recursive initialization of entity field id');
    expect(f.inventory().fieldFacadesMaterialized).toEqual(['active', 'name']);
    f.onCreate(undefined);
    expect(f.node.id()).toBe(1);
    expect(f.created()).toBe(4);
  });

  it('preserves v15 field lookup and the creation-time keyset after replacement', () => {
    const f = fixture(native);
    const descriptors = Object.getOwnPropertyDescriptors(f.node);
    const replacement = Object.assign(Object.create({ name: 'Inherited' }), { id: 1, active: false, later: 7 }) as Row;
    f.rows.replaceOne(1, replacement);
    expect(f.node.name()).toBe('Inherited');
    expect(Object.keys(f.node)).toEqual(['name', 'id', 'active']);
    expect(Object.prototype.hasOwnProperty.call(f.node, 'later')).toBe(false);
    expect(Object.getOwnPropertyDescriptors(f.node)).toEqual(descriptors);
  });

  it('keeps interceptor and tap behavior on a field first acquired after another write', () => {
    const f = fixture(native);
    f.rows.updateOne(1, { name: 'Before acquisition' });
    const events: unknown[] = [];
    const releaseIntercept = f.rows.intercept({ onUpdate: (_id, changes, context) => { context.transform({ ...changes, name: String(changes.name).toUpperCase() }); } });
    const releaseTap = f.rows.tap({ onUpdate: (id, changes, entity) => { events.push([id, changes.name, entity.name]); } });
    try {
      const name = f.node.name;
      if (native) (name as unknown as { set(value: string): void }).set('bob');
      else name('bob');
      expect(name()).toBe('BOB');
      expect(events).toEqual([[1, 'BOB', 'BOB']]);
    } finally { releaseTap(); releaseIntercept(); }
  });

  it('registers intrinsic mutation observation before exposing the deferred field', () => {
    const f = fixture(native);
    const name = f.node.name;
    const seen: unknown[] = [];
    const release = observeIntrinsicMutations(name, (mutation) => seen.push([mutation.before, mutation.after]));
    expect(release).toBeTypeOf('function');
    try {
      if (native) (name as unknown as { set(value: string): void }).set('Bob');
      else name('Bob');
      expect(seen).toEqual([['Alice', 'Bob']]);
      expect(name()).toBe('Bob');
    } finally { release?.(); }
  });
});

const drain = async () => { for (let pass = 0; pass < 120; pass++) await Promise.resolve(); };

for (const settle of ['confirm', 'rollback'] as const) {
  it(`a late field retains v15 ${settle} behavior and sends a later enrolled write`, async () => {
    const tree = signalTree({ rows: entityMap<Row, number>() }, { enhancers: [transactions()] });
    try {
      tree.$.rows.addOne({ id: 1, name: 'Alice', active: true });
      const row = tree.$.rows.byIdOrFail(1);
      const pending = tree.transaction(() => tree.$.rows.updateOne(1, { name: 'Pending' }));
      const field = row.name;
      expect(field()).toBe('Pending');
      pending[settle]();
      expect(field()).toBe(settle === 'confirm' ? 'Pending' : 'Alice');
      await drain();

      const seen: unknown[] = [];
      const connection = link(tree.$.rows, { set: (value) => { seen.push(value.map((row) => row.name)); } });
      try {
        // v15 links the collection; field carriers do not carry a Link owner.
        // Send an actual write after enrollment, without promising replay.
        field('After enrollment');
        await drain();
        await connection.settled();
        expect(seen).toEqual([['After enrollment']]);
        expect(row.name).toBe(field);
      } finally { connection.dispose(); }
    } finally { tree.destroy(); }
  });
}
