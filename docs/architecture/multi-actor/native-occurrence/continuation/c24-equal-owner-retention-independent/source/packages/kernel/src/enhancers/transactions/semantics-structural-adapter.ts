/** Native public EntityMap/Link translation; opaque labels hold actual facades. */
import { signalTree } from '../../lib/signal-tree';
import { entityMap } from '../../lib/markers/entity-map';
import { link } from '../../lib/link';
import { transactions, peekInternalTransactionRuntime } from './transactions';
import { adaptCurrent } from './semantics-current-adapter';
import type {
  EntityDomain,
  EntityFields,
  EntityKey,
  EntityRef,
} from './semantics-structural-domain';

export async function makeStructural() {
  const tree = signalTree(
    { x: 0, y: 0, z: 0, rows: entityMap<EntityFields, EntityKey>() },
    { enhancers: [transactions()] }
  );
  const rows = tree.$.rows;
  type NativeRef = ReturnType<typeof rows.byIdOrFail>;
  const nativeRefs = new Map<EntityRef, NativeRef>();
  const labels = new Map<NativeRef, EntityRef>();
  const relationships = new Set<ReturnType<typeof link>>();
  const native = (ref: EntityRef) => {
    const held = nativeRefs.get(ref);
    if (!held) throw new Error('Unknown research held reference');
    return held;
  };
  const label = (held: NativeRef): EntityRef => {
    const existing = labels.get(held);
    if (existing) return existing;
    const ref: EntityRef = { kind: 'held-entity' };
    labels.set(held, ref);
    nativeRefs.set(ref, held);
    return ref;
  };
  const currentKey = (ref: EntityRef): EntityKey => {
    const held = native(ref);
    for (const key of rows.ids()) if (rows.byIdOrFail(key) === held) return key;
    throw new Error(
      'Held lifetime has no current key; cannot retarget a replacement'
    );
  };
  const domain: EntityDomain = {
    add(key, value) {
      rows.addOne({ ...value }, { selectId: () => key });
      return label(rows.byIdOrFail(key));
    },
    lookup(key) {
      if (!rows.ids().some((current) => Object.is(current, key)))
        return undefined;
      return label(rows.byIdOrFail(key));
    },
    remove(ref) {
      rows.removeOne(currentKey(ref));
    },
    rekey(ref, key) {
      rows.changeId(currentKey(ref), key);
    },
    field(ref, change) {
      const held = native(ref);
      if (change.field === 'name') held.name(change.value);
      else held.score(change.value);
    },
    heldRead(ref) {
      return native(ref)();
    },
    entries() {
      return rows.ids().map((key) => ({ key, value: rows.byIdOrFail(key)() }));
    },
    linkName(ref, receive) {
      const relationship = link(native(ref).name, { set: receive });
      relationships.add(relationship);
      return {
        settled: () => relationship.settled(),
        dispose() {
          relationship.dispose();
          relationships.delete(relationship);
        },
      };
    },
  };
  const fixture = adaptCurrent(
    tree,
    peekInternalTransactionRuntime(tree),
    () => ({ entities: domain.entries() })
  );
  return {
    ...fixture,
    domain,
    dispose() {
      try {
        for (const relationship of relationships) relationship.dispose();
      } finally {
        fixture.dispose();
        relationships.clear();
        nativeRefs.clear();
        labels.clear();
      }
    },
  };
}
