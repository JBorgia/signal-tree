/**
 * TYPE-TEST — compile-time only. Checked by `tsc` (`npm run typecheck`),
 * EXCLUDED from vitest (the `*typing*.spec.ts` ignore).
 *
 * LINK-MATERIALIZED-VALUE-0 — the TYPE half. Runtime measurements and the full
 * disposition are in `link-materialized-value-0.spec.ts`.
 *
 * ```text
 * cell       TYPE today                            RUNTIME read
 * A count    number                                1                        ✓
 * B rows     Row[]                                 Row[]                    ✓
 * C nested   { label, users: EntityMapBuilder }    { label, users:{all:[]} } ✗
 * D root     EntityMapBuilder in 2 positions       { all: [] } in both       ✗
 * E plain    { a: number; b: string }              { a, b }                 ✓
 * ```
 *
 * ⚠️ The nested branch is as untruthful as the root, so the correct rule is not
 * about the root. It is about whether a declared state CONTAINS a marker.
 *
 * This file pins two things:
 *
 * 1. the untruthful cells, so a future materialization fix is DETECTED here
 * 2. that a truthful admission rule is exactly expressible without any
 *    recursive materialization machinery
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

type NaturalValue<S> =
  S extends EntitySignal<infer R, infer _K>
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
type ContainsMarker<T> = T extends EntityMapBuilder<infer _R, infer _K, infer _S>
  ? true
  : T extends object
    ? true extends { [K in keyof T]: ContainsMarker<T[K]> }[keyof T]
      ? true
      : false
    : false;

declare function assertTrue<T extends true>(): void;
declare function assertFalse<T extends false>(): void;

// ─── TRUTHFUL — admit ───────────────────────────────────────────────────────
assertFalse<ContainsMarker<NaturalValue<typeof tree.$.count>>>();
assertFalse<ContainsMarker<NaturalValue<typeof tree.$.plain>>>();
// The collection itself is truthful BECAUSE of the LINK-COLLECTION-TYPE-0
// branch — without it this would be the builder too.
assertFalse<ContainsMarker<NaturalValue<typeof tree.$.rows>>>();

// ─── UNTRUTHFUL — the marker leaks into the declared value ──────────────────
assertTrue<ContainsMarker<NaturalValue<typeof tree.$.nested>>>();
assertTrue<ContainsMarker<NaturalValue<typeof tree>>>();

// ─── THE POSITIVE PIN ───────────────────────────────────────────────────────
// Not a negative control: this asserts what the type ACTUALLY says today, so a
// future materialization change fails here and forces this record to be
// revisited rather than silently going stale.
type NestedValue = NaturalValue<typeof tree.$.nested>;
declare const nestedUsers: NestedValue['users'];
const stillTheBuilder: EntityMapBuilder<User, string, Record<string, never>> =
  nestedUsers;
void stillTheBuilder;

// ⚠️ And the builder is NOT the runtime shape. The runtime reads
// `{ all: User[] }`, so this assignment must NOT compile — if it ever does, the
// declared type has been corrected and the disposition needs re-deciding.
// @ts-expect-error the declared type is the construction marker, not { all: [] }
const asRuntimeShape: { all: User[] } = nestedUsers;
void asRuntimeShape;
