/**
 * Compile-time characterization of canonical accessor reads after the hydration
 * typing correction. Collection-containing branches read `{ all: Row[] }`;
 * production Link admission remains pinned separately by unchanged negatives
 * in link-admission.typing.spec.ts.
 */
import { entityMap } from './types';
import type { Location } from './internals/cell-runtime';
import type { EntityMapBuilder } from './markers/entity-map';
import type { EntitySignal } from './types';
import type { NodeAccessor } from './node-accessor';
import { signalTree } from './signal-tree';

type Row = { id: string; n: number };
type User = { id: string; name: string };

const tree = signalTree({
  count: 1,
  rows: entityMap<Row, string>({ selectId: (r) => r.id }),
  nested: {
    label: 'x',
    users: entityMap<User, string>({ selectId: (u) => u.id }),
  },
  plain: { a: 1, b: 'two' },
});

type NaturalValue<S> = S extends EntitySignal<infer R, infer _K>
  ? R[]
  : S extends NodeAccessor<infer T>
  ? T
  : S extends Location<infer T>
  ? T
  : never;

/**
 * THE ADMISSION RULE — "does this declared state still contain a construction
 * marker?" A `true` answer means the public type would be describing the thing
 * you PASS IN, not the state the tree synchronizes.
 */
type ContainsMarker<T> = T extends EntityMapBuilder<
  infer _R,
  infer _K,
  infer _S
>
  ? true
  : T extends object
  ? true extends { [K in keyof T]: ContainsMarker<T[K]> }[keyof T]
    ? true
    : false
  : false;

declare function assertFalse<T extends false>(): void;

// ─── TRUTHFUL — admit ───────────────────────────────────────────────────────
assertFalse<ContainsMarker<NaturalValue<typeof tree.$.count>>>();
assertFalse<ContainsMarker<NaturalValue<typeof tree.$.plain>>>();
// The collection itself is truthful BECAUSE of the LINK-COLLECTION-TYPE-0
// branch — without it this would be the builder too.
assertFalse<ContainsMarker<NaturalValue<typeof tree.$.rows>>>();

// Hydration typing now reports the canonical read value. This historical
// characterization changes; the production admission negatives remain intact
// in link-admission.typing.spec.ts via construction provenance.
assertFalse<ContainsMarker<NaturalValue<typeof tree.$.nested>>>();

type NestedValue = NaturalValue<typeof tree.$.nested>;
declare const nestedUsers: NestedValue['users'];
const asRuntimeShape: { all: User[] } = nestedUsers;
void asRuntimeShape;
// @ts-expect-error snapshots contain rows, not construction builders
const noLongerTheBuilder: EntityMapBuilder<
  User,
  string,
  Record<string, never>
> = nestedUsers;
void noLongerTheBuilder;
