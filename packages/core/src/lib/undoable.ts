import { withRestorationDesignation } from './internals/restoration-eligibility';

/**
 * Designate an authored operation as undoable.
 *
 * ```ts
 * undoable(() => {
 *   tree.$.document.title.set('New title');
 * });
 * ```
 *
 * ## What it designates
 *
 * The **causal turn** containing these writes — not the individual writes, and
 * not a new boundary.
 *
 * > `undoable()` marks the authored causal turn containing its writes as
 * > eligible for undo. It does not create a causal-turn boundary.
 *
 * Both halves of that sentence have observable consequences, and both are the
 * reason this is a single function rather than a per-write option:
 *
 * ```ts
 * // ONE designated write promotes the WHOLE turn. Both reverse together,
 * // because both belong to the same causal turn.
 * undoable(() => tree.$.document.title.set('edited'));
 * tree.$.ui.panel.set('inspector');          // same tick
 *
 * // TWO scopes in one tick are ONE undo step, for the same reason. The scope
 * // chooses eligibility; it does not carve the turn up.
 * undoable(() => tree.$.a.set(1));
 * undoable(() => tree.$.b.set(2));           // same tick
 * ```
 *
 * If you need them to be separate undo steps, separate the turns — an ordinary
 * event boundary already does this, which is why no explicit boundary API
 * exists.
 *
 * ## Synchronous only
 *
 * The designation is ambient and is restored before the scope returns, so a
 * write performed after an `await` inside the callback would not be designated.
 * Rather than document that trap, an async callback is refused with `ST1033`.
 *
 * ```ts
 * // ❌ throws ST1033
 * undoable(async () => {
 *   const data = await load();
 *   tree.$.x.set(data);
 * });
 *
 * // ✅ designate the synchronous write
 * const data = await load();
 * undoable(() => tree.$.x.set(data));
 * ```
 *
 * ## Nesting
 *
 * Idempotent. An inner scope cannot add a second designation and cannot clear
 * an outer one.
 *
 * ## What it never does
 *
 * It cannot promote a write that is not authored. A write applied as external
 * truth (a server realization, a persistence restore) stays outside the
 * restoration model even inside an `undoable()` scope — otherwise undo would
 * become an authority over facts the application did not author.
 *
 * @param operation The authored work to designate. Called synchronously.
 * @returns Whatever `operation` returns.
 * @throws `ST1033` if `operation` returns a thenable.
 *
 * @see `toWritableSignal(node, injector, { undoable: true })` for the case where
 *   a framework owns the write and there is no callback to wrap — Angular Signal
 *   Forms writes its model from inside its own DOM listener, for example.
 */
export function undoable<R>(operation: () => R): R {
  return withRestorationDesignation(operation);
}
