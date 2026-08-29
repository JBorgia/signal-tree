/**
 * Restoration eligibility designation — the mechanism behind `undoable()`.
 *
 * The semantic rule this implements:
 *
 * > Eligibility attaches to the CAUSAL TURN. A scope is merely how the
 * > application designates that turn.
 *
 * So this module is deliberately NOT a store of "which locations are
 * historical" and NOT a per-write flag. It is a synchronous ambient bit that the
 * capture path ORs into the turn it is currently accumulating. One designated
 * write promotes the whole turn, which is what causal-turn atomicity requires
 * (see HIST-0 case 4: two ordinary `.set()` calls in one tick are one turn, and
 * filtering part of it partially reverses an atomic operation).
 *
 * ## Synchronous only, and it says so by throwing
 *
 * PER-0 and three earlier false signals in this audit were all the same shape: a
 * designation that looks like it spans an `await` and silently does not. The
 * ambient bit is restored before the scope returns, so a write after an `await`
 * inside the callback runs UNDESIGNATED. Rather than document that trap, this
 * refuses it — a thenable return value is an error, not a warning.
 *
 * If evidence later proves an authored operation must span awaits, that earns an
 * explicit operation handle. It is not this.
 *
 * @internal Not public API — `undoable()` is. Applications express intent
 *   ("this is an undoable user operation") and never manipulate the causal
 *   engine directly. This module is the one place that ambient bit lives.
 */

import type { WriteMetadata } from '../mutation-types';

/**
 * The runtime metadata a designated write carries.
 *
 * Deliberately NOT a field on the public `WriteMetadata`: applications express
 * "this is an undoable user operation" through {@link undoable}, and must never
 * set an engine field. The property exists on the object at runtime; only this
 * internal view declares it.
 */
export type DesignatedWriteMeta = WriteMetadata & {
  restorationDesignated?: boolean;
};

/** @internal Read the designation off a delivered metadata object. */
export function isMetaDesignated(meta: WriteMetadata | undefined): boolean {
  return (meta as DesignatedWriteMeta | undefined)?.restorationDesignated === true;
}

/** @internal Stamp the ambient designation onto a metadata object. */
export function markMetaDesignated(
  meta: WriteMetadata | undefined
): WriteMetadata {
  // Spread only what is actually present. `{ ...meta }` on a partially-filled
  // metadata object materialises its absent keys as explicit `undefined`, which
  // then shows up in anything that inspects the delivered meta — caught by
  // MUT-2, which asserts that shape exactly.
  const stamped: DesignatedWriteMeta = { restorationDesignated: true };
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (value !== undefined) {
        (stamped as Record<string, unknown>)[key] = value;
      }
    }
  }
  return stamped;
}

let designated = false;

/** @internal */
export function isRestorationDesignated(): boolean {
  return designated;
}

/**
 * Run `fn` with the ambient restoration designation active. Every authored write
 * performed SYNCHRONOUSLY inside `fn` promotes its causal turn to
 * restoration-eligible.
 *
 * Nesting is idempotent — the bit is boolean, so an inner scope cannot add a
 * second designation and cannot clear an outer one.
 *
 * @throws If `fn` returns a thenable. The designation cannot survive an `await`,
 *   so an async callback would silently designate nothing.
 * @internal
 */
export function withRestorationDesignation<R>(fn: () => R): R {
  const previous = designated;
  designated = true;
  let result: R;
  try {
    result = fn();
  } finally {
    designated = previous;
  }

  // Thenable check written WITHOUT a `typeof result === 'object'` clause. That
  // clause matches the repo's hand-rolled-walker-guard lint rule, whose fix
  // (`isTraversableNode()`) is wrong here — a Promise is not a traversable
  // node. Optional chaining covers null/undefined, and dropping the clause also
  // catches a thenable function, which the narrower form missed.
  if (typeof (result as { then?: unknown } | null | undefined)?.then === 'function') {
    throw new Error(
      'ST1033: a restoration designation scope must be synchronous. The ' +
        'designation is restored before the scope returns, so writes after an ' +
        '`await` inside it would not be designated. Do the async work first, ' +
        'then designate the synchronous write: ' +
        '`const data = await load(); undoable(() => tree.$.x.set(data));`'
    );
  }

  return result;
}
