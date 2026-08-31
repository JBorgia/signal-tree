/**
 * TYPE-TEST — compile-time only. Checked by `tsc` (`npm run typecheck`),
 * EXCLUDED from vitest (the `*typing*.spec.ts` ignore).
 *
 * LINK-COLLECTION-TYPE-0 — can `link(tree.$.rows, endpoint)` infer `Row[]`
 * without an explicit generic?
 *
 * ```text
 * NULL       the existing Link typing machinery can infer a collection node's
 *            natural value as Row[] across every endpoint capability
 *            combination, without a collection-specific public API
 * FALSIFIER  at least one legitimate endpoint shape cannot, without an explicit
 *            generic or a collection-specific typing surface
 * ```
 *
 * ## ⚠️ THE NULL IS FALSIFIED — and at the SOURCE, not the endpoint
 *
 * The measured reason is not endpoint variance or overload ordering. It is that
 * the existing target union does not admit a collection node at all:
 *
 * ```text
 * tree.$.rows()                                   NOT callable        (correct)
 * NodeAccessor<T> | WritableSignal<T> admits it?  NO
 * ```
 *
 * ```text
 * Argument of type 'EntitySignal<Row, string>' is not assignable to
 * parameter of type 'LinkTarget<unknown>'
 * ```
 *
 * So `link(tree.$.rows, ...)` does not type-check today, and inference never
 * reaches the endpoint. All seven cells fail for one upstream reason.
 *
 * ⚠️ This is exactly the distinction the probe existed to draw:
 *
 * > **node access shape != linked value shape.** A collection node is
 * > deliberately non-callable, and that must not deny it a natural value.
 *
 * ## The correction — teach the extractor, do NOT expand the public API
 *
 * No `linkCollection()`, no `collection: true`, no `mode`, no required
 * `link<Row[]>`. One conditional branch in a source-driven natural-value
 * extractor keeps the single `link(source, endpoint)` surface:
 *
 * ```ts
 * type NaturalValue<S> =
 *   S extends EntitySignal<infer R, infer _K> ? R[]
 *   : S extends NodeAccessor<infer T> ? T
 *   : S extends WritableSignal<infer T> ? T
 *   : never;
 * ```
 *
 * Making `link` generic over the SOURCE and deriving `T` is what lets
 * contextual typing flow into the endpoint callbacks, so the callbacks are
 * written UNANNOTATED below and the compiler supplies `Row[]` from the node.
 *
 * ⚠️ Every assertion here is `Exact<>`, and every callback parameter is
 * inferred rather than annotated. Annotating `(value: Row[])` would prove only
 * that an annotated callback compiles, which is a strictly weaker claim.
 *
 * ## ⚠️ A measurement that corrected me mid-probe
 *
 * I expected the naive wrong-`set` negative to be swallowed by parameter
 * bivariance. It is NOT: `set` is declared as a PROPERTY with a function type
 * rather than a method shorthand, so `strictFunctionTypes` checks it
 * contravariantly and the mismatch is a real error. Recorded because the
 * opposite belief would have justified a weaker negative control.
 *
 * ## Root-node note, NOT fixed here
 *
 * `NaturalValue<typeof tree>` yields the DECLARED state type, in which `rows`
 * is still `EntityMapBuilder<...>` — the pre-materialization marker, not
 * `Row[]`. Linking the whole root is a separate question from linking a
 * collection, and nothing in this probe depends on it. Recorded so it is not
 * mistaken for a consequence of this branch.
 */
import { entityMap } from './types';
import type { WritableCell } from './internals/cell-runtime';
import type { EntitySignal } from './types';
import type { NodeAccessor } from './node-accessor';
import { signalTree } from './signal-tree';

type Row = { id: string; name: string; n: number };
type WrongRow = { wrong: boolean };

const tree = signalTree({
  rows: entityMap<Row, string>({ selectId: (r) => r.id }),
  count: 0,
  settings: { theme: 'light' },
});

/** THE CANDIDATE — source-driven, collection branch first. */
type NaturalValue<S> =
  S extends EntitySignal<infer R, infer _K>
    ? R[]
    : S extends NodeAccessor<infer T>
      ? T
      : S extends WritableCell<infer T>
        ? T
        : never;

interface Endpoint<T> {
  get?: () => T | Promise<T>;
  set?: (value: T) => void | Promise<void>;
  subscribe?: (next: (value: T) => void) => () => void;
}

declare function link<S>(source: S, endpoint: Endpoint<NaturalValue<S>>): void;

/** Exact-type assertion — mutual assignability, not one-way. */
type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
declare function assertExact<T extends true>(): void;

declare const rows: Row[];
declare const wrong: WrongRow[];
declare const unsub: () => void;

// ─── THE SEVEN CELLS, NO EXPLICIT GENERIC ANYWHERE ──────────────────────────

// 1. get — sync and async both accepted, no separate overload needed.
link(tree.$.rows, { get: () => rows });
link(tree.$.rows, { get: async () => rows });

// 2. set
link(tree.$.rows, {
  set: (value) => {
    assertExact<Exact<typeof value, Row[]>>();
  },
});

// 3. subscribe
link(tree.$.rows, {
  subscribe: (next) => {
    assertExact<Exact<Parameters<typeof next>[0], Row[]>>();
    return unsub;
  },
});

// 4. get + set
link(tree.$.rows, {
  get: () => rows,
  set: (value) => {
    assertExact<Exact<typeof value, Row[]>>();
  },
});

// 5. get + subscribe
link(tree.$.rows, {
  get: () => rows,
  subscribe: (next) => {
    assertExact<Exact<Parameters<typeof next>[0], Row[]>>();
    return unsub;
  },
});

// 6. set + subscribe
link(tree.$.rows, {
  set: (value) => {
    assertExact<Exact<typeof value, Row[]>>();
  },
  subscribe: (next) => {
    assertExact<Exact<Parameters<typeof next>[0], Row[]>>();
    return unsub;
  },
});

// 7. get + set + subscribe
link(tree.$.rows, {
  get: async () => rows,
  set: (value) => {
    assertExact<Exact<typeof value, Row[]>>();
  },
  subscribe: (next) => {
    assertExact<Exact<Parameters<typeof next>[0], Row[]>>();
    return unsub;
  },
});

// ─── CONTROLS — the collection branch must not leak ─────────────────────────
// These matter because a broad "non-callable => array" rule would satisfy every
// cell above while silently breaking both of these.

link(tree.$.count, {
  set: (value) => {
    assertExact<Exact<typeof value, number>>();
  },
});

link(tree.$.settings, {
  set: (value) => {
    assertExact<Exact<typeof value, { theme: string }>>();
  },
});

// ─── NEGATIVES ──────────────────────────────────────────────────────────────

// @ts-expect-error get must return Row[], not WrongRow[]
link(tree.$.rows, { get: () => wrong });

// @ts-expect-error subscribe must emit Row[], not WrongRow[]
link(tree.$.rows, { subscribe: (next) => { next(wrong); return unsub; } });

// @ts-expect-error a scalar endpoint must not accept Row[]
link(tree.$.count, { get: () => rows });

// @ts-expect-error set must accept Row[] — `strictFunctionTypes` bites here
link(tree.$.rows, { set: (value: WrongRow[]) => { void value; } });

// The contextual type from INSIDE the callback, which is the stronger form.
link(tree.$.rows, {
  set: (value) => {
    // @ts-expect-error `wrong` is not a field of Row
    void value[0].wrong;
    void value[0].name; // and a Row field IS present
  },
});

// ─── COLLECTION SHAPE PINS ──────────────────────────────────────────────────

// @ts-expect-error a collection node is NOT callable
tree.$.rows();

const allValue = tree.$.rows.all();
assertExact<Exact<typeof allValue, Row[]>>();
