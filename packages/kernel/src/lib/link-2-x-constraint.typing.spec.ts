/**
 * TYPE-TEST — compile-time only. Checked by `tsc` (`npm run typecheck`),
 * EXCLUDED from vitest (the `*typing*.spec.ts` ignore).
 *
 * LINK-2 case 4 — and the measured answer is mostly NEGATIVE, which is why the
 * file is worth keeping.
 *
 * ⚠️ LINK-2's header referenced this file before it existed. That was an
 * accuracy defect in the audit; it is written now so the claim and the artifact
 * match. Writing it also overturned what I expected it to say.
 *
 * ## What the type can and cannot enforce
 *
 * ```text
 * tree.$                REJECTED by the type       ✓ TreeNode is not callable
 * computed              ACCEPTED by the type       ✗ measured
 * bare WritableSignal   ACCEPTED by the type       ✗ measured
 * ```
 *
 * The candidate constraint is deliberately NOT `WritableSignal<T>`: the runtime
 * probe showed a bare `signal('foo')` has a `.set` and no owner, so that bound
 * would admit exactly the case with no settlement authority and no location
 * identity. But the union below does not fix it either, and the reason is
 * structural rather than fixable by picking a better union:
 *
 *   - `NodeAccessor<T>` declares `(): T` among its call signatures, and EVERY
 *     `Signal<T>` is a zero-argument function returning `T`. A `computed`
 *     therefore satisfies it.
 *   - A bare `WritableSignal<T>` is structurally identical to an owned leaf:
 *     same `()`, same `.set`, same `.update`. Ownership is a RUNTIME fact on a
 *     non-enumerable property, and TypeScript cannot see it.
 *
 * So **the X constraint is enforced at RUNTIME**, and
 * `link-1-relationship.spec.ts` measures exactly that:
 *
 *     expect(() => linkableWrite(bare)).toThrow(/owned SignalTree location/)
 *     expect(() => linkableWrite(derived)).toThrow(/owned SignalTree location/)
 *
 * Making these compile errors needs a BRANDED location type —
 * `NodeAccessor<T> & { readonly [OWNED]: true }` — stamped by `signalTree` and
 * threaded through every public return type in the library. That is a real
 * option and a far larger decision than LINK. Recorded, not taken, and the
 * consequence is that `link()`'s X parameter cannot be trusted to reject at
 * compile time.
 */
import { computed, signal, type WritableSignal } from '@angular/core';

import { signalTree } from './signal-tree';
import type { NodeAccessor } from './node-accessor';

const tree = signalTree({
  leaf: 'l0',
  settings: { theme: 'light', units: 'imperial' },
});

/**
 * A LINK TARGET is a writable SignalTree location: the callable root, a callable
 * branch, or a leaf signal the tree owns.
 *
 * `tree.$` is deliberately absent. It resolves a registry but is neither
 * callable nor settable — the NAMESPACE through which locations are reached,
 * not a location.
 */
type LinkTarget<T> = NodeAccessor<T> | WritableSignal<T>;

declare function linkTarget<T>(x: LinkTarget<T>): void;

// --- ACCEPTED: every writable location, despite three write spellings --------
linkTarget(tree); // root — callable with a partial
linkTarget(tree.$.settings); // branch — callable with a partial
linkTarget(tree.$.leaf); // leaf — .set()
linkTarget(tree.$.settings.theme); // nested leaf

// --- THE ONE REJECTION THE TYPE ACTUALLY MAKES ------------------------------
// @ts-expect-error tree.$ is a TreeNode namespace, not a writable location
linkTarget(tree.$);

// --- ACCEPTED, AND THEY SHOULD NOT BE ---------------------------------------
// No `@ts-expect-error` on either line: adding one would fail `tsc` for the
// wrong reason and would record a guarantee the type does not give. Both are
// refused at runtime instead.

const derived = computed(() => tree.$.leaf());
linkTarget(derived); // compiles — `Signal<T>` satisfies NodeAccessor's `(): T`

const bare = signal('foo');
linkTarget(bare); // compiles — structurally identical to an owned leaf
