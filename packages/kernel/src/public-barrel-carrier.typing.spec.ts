/* eslint-disable @nx/enforce-module-boundaries -- THE SUBJECT IS THE BARREL.
 * The rule exists so a project does not round-trip through its own package name
 * for ordinary code, and it is right. But it is also the reason this package had
 * NO test that could observe its own public export list: every spec imports
 * relatively, so deleting a re-export left them all green while breaking every
 * external consumer.
 *
 * A SPEC REACHING PAST THE BARREL CANNOT TESTIFY ABOUT THE BARREL. These two
 * files are the deliberate exception, and the only ones. */
import { asReadonly, signalTree } from '@signal-tree/kernel';
// `ReadonlyView` was INTERNALIZED by GREENFIELD-V15-SURFACE-0.

/**
 * WHY `asReadonly` SURVIVED PRE-RELEASE-PUBLIC-SURFACE-DEDUPE-0.
 *
 * A probe argued for deleting it: `ReadonlyView<typeof tree.$> = tree.$`
 * narrows correctly AND blocks `.set`, so the type looked sufficient and the
 * function looked like a convenience spelling.
 *
 * That probe addressed the NAMESPACE. The public API projects the CALLABLE
 * TREE, and at that subject the annotation cannot express the contract at all.
 *
 * > SUBJECT-ADDRESS RULE — a probe must address the same node the API does.
 *
 * ⚠️ AND THE KEEPER IS PINNED AT THAT SUBJECT TOO, not merely the alternative's
 * failure. Showing that `ReadonlyView` fails would prove the PROBLEM exists; it
 * would not prove this API solves it. Both halves are below.
 */
const tree = signalTree({ a: 1, b: { c: 'x' } });

// ── the KEEPER, at the callable subject ────────────────────────────────────
const ro = asReadonly(tree);

/** The whole-tree read survives the projection. */
export const _whole: unknown = ro.$();
/** Descendant reads stay correctly typed. */
export const _leaf: number = ro.$.a();
export const _nested: string = ro.$.b.c();

/** Authored mutation is unavailable. */
// @ts-expect-error — a readonly projection must not accept a replacement
ro.$.a(2);

// ── the ALTERNATIVE row was REMOVED ───────────────────────────────────────
// It compared `asReadonly()` against a `ReadonlyView<typeof tree>` ANNOTATION.
// GREENFIELD-V15-SURFACE-0 internalized `ReadonlyView`, so there is no public
// annotation form left to compare against — which is itself the answer the row
// was asking for. `asReadonly()`'s behaviour is still asserted above, and the
// carrier half is covered by `carrier-propagation.typing.spec.ts`.
