/**
 * HIST-C2 — restoration eligibility designation.
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
 * @internal Not public API. The public spelling is chosen after the door
 *   semantics are characterised; applications must express intent ("this is an
 *   undoable user operation"), never manipulate the causal engine directly.
 */

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
        '`const data = await load(); reversible(() => tree.$.x.set(data));`'
    );
  }

  return result;
}
