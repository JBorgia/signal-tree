/**
 * MARKER-LOCATION GRAMMAR — the TYPE negative (MARKER-PAYLOAD-LEAK-0 §1/§7).
 *
 * The runtime half lives in `marker-location-grammar.spec.ts`. This file pins
 * what the PUBLIC type grammar says about each position, with no `as any`, no
 * `as never`, and no unknown casts anywhere in the fixtures — a forced shape
 * would prove nothing about supported API semantics.
 *
 * The result is not "markers in containers are rejected". Nothing here is a
 * type ERROR. The grammar instead resolves those positions to the RAW BUILDER
 * type, which is a truthful answer: at a non-object position the declaration is
 * ordinary data, and the type says exactly that. A developer who writes
 * `list: [entityMap(...)]` gets `Signal<EntityMapBuilder<…>[]>` in their editor,
 * not an `EntitySignal` that never arrives.
 *
 * Container positions are asserted on the ELEMENT/VALUE type, not on the
 * container leaf — the marker sits inside the container, so the container's own
 * type answers a different question.
 */
import { entityMap } from './types';
import { signalTree } from './signal-tree';
import type { EntityMapBuilder } from './markers/entity-map';
import type { EntitySignal } from './types';

type Row = { id: number };
const cfg = { selectId: (r: Row) => r.id };
type Builder = EntityMapBuilder<Row, number, Record<string, never>>;

/** Does this position resolve to a materialized collection surface? */
type Materializes<T> = T extends EntitySignal<Row, number> ? true : false;
type AssertTrue<T extends true> = T;
type AssertFalse<T extends false> = T;

// ── SUPPORTED: object positions ─────────────────────────────────────────────
const t1 = signalTree({ rows: entityMap<Row, number>(cfg) });
const t2 = signalTree({ nested: { rows: entityMap<Row, number>(cfg) } });

export type _RootMaterializes = AssertTrue<Materializes<typeof t1.$.rows>>;
export type _NestedMaterializes = AssertTrue<Materializes<typeof t2.$.nested.rows>>;

// ── NOT MARKER POSITIONS: the declaration stays data ────────────────────────
const t3 = signalTree({ list: [entityMap<Row, number>(cfg)] });
const t4 = signalTree({ list: [entityMap<Row, number>(cfg)] as const });
const tup: [Builder] = [entityMap<Row, number>(cfg)];
const t5 = signalTree({ list: tup });
const t6 = signalTree({ m: new Map<string, Builder>([['a', entityMap<Row, number>(cfg)]]) });
const t7 = signalTree({ s: new Set<Builder>([entityMap<Row, number>(cfg)]) });

type ElementOf<T> = T extends readonly (infer U)[] ? U : never;
type MapValueOf<T> = T extends Map<unknown, infer V> ? V : never;
type SetMemberOf<T> = T extends Set<infer V> ? V : never;

// The element is the raw BUILDER — not a materialized collection surface.
export type _ArrayIsData = AssertFalse<Materializes<ElementOf<ReturnType<typeof t3.$.list>>>>;
export type _ArrayElementIsBuilder = AssertTrue<
  ElementOf<ReturnType<typeof t3.$.list>> extends Builder ? true : false
>;
export type _ReadonlyArrayIsData = AssertFalse<Materializes<ElementOf<ReturnType<typeof t4.$.list>>>>;
export type _TupleIsData = AssertFalse<Materializes<ElementOf<ReturnType<typeof t5.$.list>>>>;
export type _MapIsData = AssertFalse<Materializes<MapValueOf<ReturnType<typeof t6.$.m>>>>;
export type _SetIsData = AssertFalse<Materializes<SetMemberOf<ReturnType<typeof t7.$.s>>>>;

// ── A CLASS INSTANCE IS AN OBJECT POSITION ──────────────────────────────────
// Recorded because the first measurement got this wrong: asserting on `$.h`
// (the branch) instead of `$.h.rows` (the marker position) reported "does not
// materialize" and looked like a type/runtime disagreement. It is not one —
// both sides materialize. The branch's own type was answering another question.
class Holder {
  rows = entityMap<Row, number>(cfg);
}
const t8 = signalTree({ h: new Holder() });
export type _ClassInstanceMaterializes = AssertTrue<Materializes<typeof t8.$.h.rows>>;
