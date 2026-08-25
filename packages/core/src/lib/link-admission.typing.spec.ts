/**
 * TYPE-TEST — compile-time only. Checked by `tsc` (`npm run typecheck`),
 * EXCLUDED from vitest (the `*typing*.spec.ts` ignore).
 *
 * PRODUCTION LINK — source admission and endpoint inference.
 *
 * The rule, as authorized:
 *
 * > **Exclude any callable Link source whose DECLARED natural value still
 * > contains an `EntityMapBuilder` construction marker.**
 *
 * ⚠️ Deliberately NOT "exclude the root". It is about TYPE TRUTHFULNESS, not
 * topology — a root with no collection is admitted, and a nested BRANCH
 * containing one is rejected.
 */
import { entityMap } from './types';
import { link } from './link';
import { signalTree } from './signal-tree';

type Row = { id: string; n: number };
type User = { id: string; name: string };
type WrongRow = { wrong: boolean };

const tree = signalTree({
  count: 1,
  rows: entityMap<Row, string>({ selectId: (r) => r.id }),
  nested: {
    label: 'x',
    users: entityMap<User, string>({ selectId: (u) => u.id }),
  },
  plain: { a: 1, b: 'two' },
});

/** A tree with NO collection anywhere — the control for "not about the root". */
const cleanTree = signalTree({
  count: 1,
  plain: { a: 1, b: 'two' },
});

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
declare function assertExact<T extends true>(): void;

declare const rows: Row[];
declare const wrong: WrongRow[];
declare const unsub: () => void;

// ─── ADMITTED, and inferring from the SOURCE ────────────────────────────────

// A collection — Row[], no explicit generic.
link(tree.$.rows, {
  get: () => rows,
  set: (value) => {
    assertExact<Exact<typeof value, Row[]>>();
  },
  subscribe: (next) => {
    assertExact<Exact<Parameters<typeof next>[0], Row[]>>();
    return unsub;
  },
});

// A collection nested inside an untruthful branch is STILL truthful itself.
// This is the escape hatch: link the collection, not its enclosing branch.
link(tree.$.nested.users, {
  set: (value) => {
    assertExact<Exact<typeof value, User[]>>();
  },
});

// A scalar leaf.
link(tree.$.count, {
  set: (value) => {
    assertExact<Exact<typeof value, number>>();
  },
});

// An ordinary branch with no collection in its state.
link(tree.$.plain, {
  set: (value) => {
    assertExact<Exact<typeof value, { a: number; b: string }>>();
  },
});

// ⚠️ A ROOT with no collection anywhere — ADMITTED. The rule is not about roots.
link(cleanTree, {
  set: (value) => {
    assertExact<Exact<typeof value, { count: number; plain: { a: number; b: string } }>>();
  },
});

// ─── REJECTED — the marker survives in the declared value ───────────────────

// @ts-expect-error a branch containing an entityMap is not a truthful source
link(tree.$.nested, { set: () => void 0 });

// @ts-expect-error a root containing an entityMap is not a truthful source
link(tree, { set: () => void 0 });

// ⚠️ REJECTED AT THE SOURCE, NOT VIA THE ENDPOINT VALUE. A subscribe-only
// endpoint contributes no inference at all, so if admission were expressed by
// collapsing the endpoint type these would compile.
// @ts-expect-error subscribe-only must not sneak an untruthful source through
link(tree.$.nested, { subscribe: () => unsub });

// @ts-expect-error an empty endpoint must not sneak one through either
link(tree, {});

// ─── ENDPOINT NEGATIVES on an admitted source ───────────────────────────────

// @ts-expect-error get must return Row[]
link(tree.$.rows, { get: () => wrong });

// @ts-expect-error subscribe must emit Row[]
link(tree.$.rows, { subscribe: (next) => { next(wrong); return unsub; } });

// @ts-expect-error set must accept Row[]
link(tree.$.rows, { set: (value: WrongRow[]) => void value });

// @ts-expect-error a scalar endpoint must not accept Row[]
link(tree.$.count, { get: () => rows });

// ─── THE HANDLE ────────────────────────────────────────────────────────────
const connection = link(tree.$.rows, { get: () => rows });
assertExact<Exact<ReturnType<typeof connection.retrieve>, Promise<void>>>();
assertExact<Exact<ReturnType<typeof connection.settled>, Promise<void>>>();
assertExact<Exact<ReturnType<typeof connection.dispose>, void>>();

// @ts-expect-error the handle is deliberately three members — no subscribe()
void connection.subscribe;
// @ts-expect-error and it is not a thenable
void connection.then;

// ═══════════════════════════════════════════════════════════════════════════
// COMPARISON-FULL-STATE-0 — the endpoint speaks T, never Partial<T>
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ The type contract is the authority for "no patch protocol". There is no
 * runtime patch detector, and there should not be one: `LinkEndpoint<T>` is
 * parameterised on the COMPLETE natural value, so a partial cannot be supplied
 * in the first place.
 */
declare const partialBranch: Partial<{ a: number; b: string }>;
declare const fullBranch: { a: number; b: string };
declare const partialRows: Array<Partial<Row>>;

// A complete branch value is accepted.
link(tree.$.plain, { get: () => fullBranch });

// @ts-expect-error a PARTIAL branch is not a complete natural value
link(tree.$.plain, { get: () => partialBranch });

// and it cannot be emitted through subscribe either
link(tree.$.plain, {
  subscribe: (next) => {
    // @ts-expect-error `next` accepts the COMPLETE natural value only
    next(partialBranch);
    return unsub;
  },
});

// @ts-expect-error partial ROWS are not a complete collection value
link(tree.$.rows, { get: () => partialRows });

// Inside `set`, the value is the complete branch — every key is present.
link(tree.$.plain, {
  set: (value) => {
    const a: number = value.a;
    const b: string = value.b;
    void a;
    void b;
  },
});
