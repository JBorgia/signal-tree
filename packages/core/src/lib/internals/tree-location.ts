import type { TreeScalarSlotRuntime } from './tree-scalar-slot-runtime';

/**
 * THE CANONICAL LOCATION — §C / C1.
 *
 * A location is SignalTree's own callable object. It is NOT an Angular signal:
 * a framework representation is a VIEW of SignalTree truth, never the truth
 * (GREENFIELD LEAF OWNERSHIP). That ownership is what makes the grammar below
 * possible at all — the incumbent could not give a leaf a value form, because a
 * leaf WAS an Angular signal and calling one is a read that discards arguments.
 *
 *   location()                  READ
 *   location(value)             authored WHOLE-VALUE assignment
 *   location(updater)           authored DERIVE
 *   location(mark(callable))    whole-value assignment of a raw callable
 *
 * ⚠️ CLASSIFICATION READS THE ARGUMENT ONLY.
 *
 *     FUNCTION INTENT MAY NOT BE INFERRED FROM CURRENT STATE.
 *     THE ARGUMENT SHAPE DECIDES.
 *
 * A revision of `change-reporting.spec.ts` once resolved a leaf function as an
 * updater, guarded on "the current value is not a function". It was REVERTED as
 * unknowable at runtime: it broke nullable callbacks, clear/reassign cycles and
 * class constructors. Under that heuristic a function-valued location can never
 * be DERIVED at all, because every callable argument is swallowed as data.
 * Nothing here may inspect the current value, the previous value, arity, or the
 * function/class distinction.
 */

/** Module-private brand. The marker is INVOCATION ENCODING, not a value. */
const FUNCTION_VALUE = Symbol('signaltree.functionValue');

/**
 * A callable presented AS DATA for one invocation.
 *
 * ⚠️ EPHEMERAL. It is consumed at the boundary and never reaches the kernel, so
 * it can never enter state, snapshots, Link values, persistence, restoration
 * facts or causal payloads. There is deliberately no wrapper to "survive" —
 * `location(mark(fn))` is immediately followed by `location() === fn`.
 */
export interface FunctionValue<T extends CallableSyntax> {
  readonly [FUNCTION_VALUE]: true;
  readonly value: T;
}

/**
 * Treat this otherwise-callable argument as the VALUE being assigned by this
 * invocation.
 *
 * ⚠️ AN AMBIGUITY ESCAPE MUST NOT ACCEPT VALUES THAT ARE NOT AMBIGUOUS.
 * The bound is `CallableSyntax`, not `T`: a non-callable already has an
 * unambiguous whole-value spelling — `location(42)` — so `asValue(42)` would be
 * a second way to say the same thing, and the exception must be exactly as
 * narrow as the ambiguity it exists for.
 *
 * ⚠️ NOT BARREL-EXPORTED YET. The spelling is frozen; the public surface flips
 * once, at C8, with the coordinated baseline regeneration.
 */
export function asValue<T extends CallableSyntax>(value: T): FunctionValue<T> {
  return { [FUNCTION_VALUE]: true, value };
}

export function isFunctionValue(
  value: unknown
): value is FunctionValue<CallableSyntax> {
  return (
    typeof value === 'object' && value !== null && FUNCTION_VALUE in (value as object)
  );
}

/**
 * ⚠️ BOTH ARMS ARE REQUIRED. A class is `typeof === 'function'` at runtime but is
 * NOT callable without `new`, so a call-signature-only check lets `typeof Thing`
 * through the value overload while the runtime classifies it DERIVE and invokes
 * it — measured: "Class constructor Thing cannot be invoked without 'new'".
 * That is the same failure `change-reporting.spec.ts` already fixed once.
 */
export type CallableSyntax =
  | ((...args: never[]) => unknown)
  | (abstract new (...args: never[]) => unknown);

/** A value of `T` that is not callable syntax. Distributes over unions. */
export type NonCallableValue<T> = T extends CallableSyntax ? never : T;

/** Only the callable members of `T` — the sole values the escape may wrap. */
export type CallablePart<T> = Extract<T, CallableSyntax>;

/**
 * ⚠️ THE VALUE PARAMETER IS `T`, NEVER `Partial<T>`.
 *
 *     THE STATE TYPE DEFINES ITS OWN STRICTNESS.
 *     THE MUTATION API MUST NOT WEAKEN IT.
 *
 * `Partial<T>` would not merely add convenience — measured, it erases
 * distinctions the author drew: an author's own `{ name: string; age?: number }`
 * loses its `name` requirement too. An author who wants partial writes says so
 * by declaring the location `Partial<User>`, which makes a partial object a
 * COMPLETE value of that location's type.
 */
export interface Location<T> {
  (): T;
  (value: NonCallableValue<T>): void;
  (updater: (current: T) => T): void;
  (marked: FunctionValue<CallablePart<T>>): void;
}

/**
 * The internal causal vocabulary the public grammar maps onto. Deliberately the
 * existing `mutationIntent` spelling from `mutation-types.ts`, NOT the public
 * words — "replace" is already a `MutationKind` member and a `mutationIntent`
 * value, and reusing it as the public contract word conflates the two layers.
 */
export type LocationMutationIntent = 'replace' | 'derive';

export type LocationMutation = {
  readonly intent: LocationMutationIntent;
  readonly changed: boolean;
  readonly revision: number;
};

export function createScalarLocation<T>(
  runtime: Pick<TreeScalarSlotRuntime, 'readSlot' | 'commitSlot' | 'updateSlot'>,
  slotIndex: number,
  onMutation?: (mutation: LocationMutation) => void
): Location<T> {
  const report = (
    intent: LocationMutationIntent,
    result: { changed: boolean; revision: number }
  ): void => {
    onMutation?.({ intent, changed: result.changed, revision: result.revision });
  };

  const location = (...args: unknown[]): T | void => {
    if (args.length === 0) {
      return runtime.readSlot<T>(slotIndex);
    }

    const arg = args[0];

    // A marked callable is DATA. The marker is consumed HERE; the kernel only
    // ever sees the raw function.
    if (isFunctionValue(arg)) {
      report('replace', runtime.commitSlot<T>(slotIndex, arg.value as T));
      return;
    }

    // A naked callable is an updater. No current-value inspection.
    if (typeof arg === 'function') {
      report('derive', runtime.updateSlot<T>(slotIndex, arg as (value: T) => T));
      return;
    }

    report('replace', runtime.commitSlot<T>(slotIndex, arg as T));
    return;
  };

  return location as Location<T>;
}

/**
 * NON-AUTHORED INGRESS — realization / restoration / hydrate / Link acquisition.
 *
 *     AN OPERATION THAT ALREADY KNOWS ITS MUTATION SEMANTICS MUST NOT RE-ENTER
 *     THROUGH SYNTAX WHOSE JOB IS TO INFER THOSE SEMANTICS.
 *
 * These callers already know their causal class, so they install the raw value
 * directly and need no marker. Routing them through `Location` would not "lose
 * the marker" — it would cross the WRONG AUTHORITY ENTRANCE, and a raw function
 * would be re-read as an updater and INVOKED.
 *
 * ⚠️ Minimal seam for C1's discriminator. C4 owns the full ingress capability,
 * including the partial external projection that `bind-branch-0` relocates to.
 * Deliberately NOT exported publicly.
 */
export function acquireScalarLocation<T>(
  runtime: Pick<TreeScalarSlotRuntime, 'commitSlot'>,
  slotIndex: number,
  raw: T
): { changed: boolean; revision: number } {
  return runtime.commitSlot<T>(slotIndex, raw);
}
