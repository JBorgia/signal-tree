/**
 * THE ENTITY PROJECTION SEED — internal only.
 *
 * An external-consequence consumer (today: `link()`) that maintains an
 * egress-eligible projection of an `EntitySignal` needs a starting point at
 * relationship creation. Its public NaturalValue is `Row[]`, which carries no
 * identity, so `Row[]` alone cannot seed a projection that must survive rekeys
 * and key reuse.
 *
 * Three facts are needed, and they are three DIFFERENT things:
 *
 *   subjectId   the entity's LIFETIME. Survives `changeId()`. A removed key that
 *               is later re-added receives a NEW subject, so a key is not a
 *               lifetime.
 *   key         the entity's current ADDRESS in the collection. Deliberately
 *               carried, because it cannot be recovered from the row: after
 *               `changeId(1, 77)` the payload still reads `{ id: 1 }` and the
 *               key is 77. `selectId(row)` is NOT the address.
 *   row         the PAYLOAD, which is ordinary data.
 *
 * Ordering is the array order, which the producer takes from the same ordered
 * active-key snapshot `all()` iterates — so `seed.map(e => e.row)` equals
 * `entitySignal.all()` by construction rather than by agreement.
 *
 * Carried as a module-private SYMBOL property rather than a `__`-prefixed string
 * (not a surface any consumer should discover, and the existing string-property
 * internals are historical rather than a pattern to extend) and rather than a
 * WeakMap: a materialized `EntitySignal` is a `Proxy` over its implementation
 * object, so a WeakMap keyed on the implementation misses when the consumer
 * holds the proxy. A symbol property forwards through the proxy's `get` trap,
 * which is the same reason the existing internal handles work.
 */
export type EntityProjectionSeedEntry<K, E> = {
  readonly subjectId: number;
  readonly key: K;
  readonly row: E;
};

type SeedProducer = () => readonly EntityProjectionSeedEntry<
  string | number,
  unknown
>[];

const SEED = Symbol('signaltree.entityProjectionSeed');

/** @internal Registered by `entityMap` materialization. */
export function defineEntityProjectionSeed(
  api: object,
  produce: SeedProducer
): void {
  Object.defineProperty(api, SEED, {
    value: produce,
    enumerable: false,
    configurable: true,
  });
}

/**
 * @internal The ordered `{ subjectId, key, row }` triples for a materialized
 * `EntitySignal`, or `undefined` if this node is not one.
 */
export function getEntityProjectionSeed(
  node: unknown
): readonly EntityProjectionSeedEntry<string | number, unknown>[] | undefined {
  if (node === null || typeof node !== 'object') return undefined;
  const produce = (node as Record<symbol, unknown>)[SEED];
  return typeof produce === 'function'
    ? (produce as SeedProducer)()
    : undefined;
}
