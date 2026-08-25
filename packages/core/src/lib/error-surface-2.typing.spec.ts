/**
 * TYPE-TEST — compile-time only. Checked by `tsc` (`npm run typecheck`),
 * EXCLUDED from vitest (the `*typing*.spec.ts` ignore).
 *
 * ERROR-SURFACE-2 — the candidate PUBLIC event shape, pinned against the
 * MODULE-LOCAL type. Package-root exports are deliberately not touched yet.
 */
import type { TreeErrorEvent } from './internals/error-reporter';
import type { TreeId } from './internals/position-registry';

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
declare function assertExact<T extends true>(): void;

declare const event: TreeErrorEvent;

// ─── THE SHAPE ──────────────────────────────────────────────────────────────
assertExact<Exact<typeof event.error, unknown>>();
assertExact<Exact<typeof event.operation, string>>();
assertExact<Exact<typeof event.treeId, TreeId>>();
assertExact<Exact<typeof event.path, string | undefined>>();

// `operation` is a diagnostic vocabulary, NOT a frozen union.
const anyOperation: string = event.operation;
void anyOperation;

// ─── treeId IS REQUIRED ─────────────────────────────────────────────────────
declare const someTreeId: TreeId;

const complete: TreeErrorEvent = {
  error: new Error('x'),
  operation: 'link:set',
  treeId: someTreeId,
};
void complete;

// @ts-expect-error treeId is REQUIRED — this is the whole point of the repair
const missingTreeId: TreeErrorEvent = {
  error: new Error('x'),
  operation: 'link:set',
};
void missingTreeId;

// ─── THE DELETED FIELDS ─────────────────────────────────────────────────────
// @ts-expect-error `source` was deleted, not hidden
void event.source;

// @ts-expect-error `detail` was deleted, not hidden
void event.detail;

const withSource: TreeErrorEvent = {
  error: 'e',
  operation: 'read',
  treeId: someTreeId,
  // @ts-expect-error excess property: `source` cannot be reintroduced
  source: 'stored',
};
void withSource;

// ─── TreeId IS NOMINAL ──────────────────────────────────────────────────────
declare function takesTreeId(id: TreeId): void;

// @ts-expect-error an arbitrary number is not a TreeId
const fabricated: TreeId = 42;
void fabricated;

// @ts-expect-error APIs requiring TreeId reject raw numbers
takesTreeId(42);

// Correlation IS the point, so equality must work.
declare const otherTreeId: TreeId;
const correlates: boolean = someTreeId === otherTreeId;
void correlates;

// And it is usable as a Map key.
const byTree = new Map<TreeId, number>();
byTree.set(someTreeId, 1);
void byTree;

// ⚠️ NO NEGATIVE TEST FOR ARITHMETIC.
//
// `number & Brand` is a SUBTYPE of `number`, so this compiles and conventional
// numeric branding cannot prevent it. Asserting otherwise would record a
// guarantee the type does not give — and distorting `TreeId` into an
// object-shaped handle to forbid it would reintroduce the type/runtime mismatch
// this repair just removed from the event.
const stillNumeric: number = someTreeId + 1;
void stillNumeric;

// The representation is likewise not a contract; it is merely what it is today.
const asNumber: number = someTreeId;
void asNumber;
