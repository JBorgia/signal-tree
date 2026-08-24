import type { WriteMetadata } from './mutation-types';
import { getActiveWriteContext, withWriteContext } from './write-context';

/**
 * Classifies synchronous writes whose authoritative value comes from **outside
 * the current authored operation** — not merely from another thread, process,
 * module, or machine.
 *
 * ## The one rule
 *
 * SignalTree speaks from the store's causal perspective. A write is AUTHORED
 * when the current operation owns the decision, and EXTERNAL when the decision
 * belonged to another authority:
 *
 * ```text
 * who owned the decision?
 *   this operation      ordinary write / undoable() / transaction()
 *   another authority   external(() => …)
 * ```
 *
 * That is a coordinate system, not a synonym for "remote". Crossing a transport
 * or execution boundary does NOT cross a causal-authority boundary:
 *
 * ```ts
 * const price = await pricingWorker.calculate(localInputs);
 * tree.$.quote.total.set(price);          // AUTHORED — the application
 *                                         // delegated computation and kept
 *                                         // authority. No door.
 *
 * const reading = await sensorWorker.read();
 * external(() => tree.$.telemetry.set(reading));   // another authority observed
 *                                                  // it. Door.
 * ```
 *
 * ```ts
 * const rows = await api.getRows();
 * external(() => {
 *   tree.$.rows.setAll(rows);
 * });
 * ```
 *
 * ## What it declares
 *
 * Two things, on the two independent axes SignalTree separates:
 *
 * ```text
 * origin         external    where this value came from
 * participation  realized    how it may take part in causal mechanisms
 * ```
 *
 * The sentence it exists to let you say is:
 *
 * > This value was acquired from outside the authored operation and is
 * > authoritative relative to local speculative or restorable work.
 *
 * ## Why it matters — the two defects it prevents
 *
 * Untagged, a refresh is indistinguishable from something the user did:
 *
 * ```ts
 * tree.$.rows.setAll(serverRows);   // ❌ an undo step; undo reverts the SERVER
 * external(() => tree.$.rows.setAll(serverRows));   // ✅ applied, not authored
 * ```
 *
 * And a refresh landing while an optimistic transaction holds the row leaves
 * that transaction unresolvable — untagged, its rollback cannot complete at all.
 * Classified, the outcome is a stated consequence rather than an accident.
 *
 * ## What it does NOT do
 *
 * It does not suppress the write, batch it, or make it invisible. External truth
 * still participates in causal mechanisms — it can make a pending rollback
 * unsafe, and it is protected from being discarded by an undo (`ST1034`). What
 * it never does is become an authored turn:
 *
 * ```text
 * no restoration admission          an ingress is never an undo step
 * no transaction contribution       it is not the transaction's work
 * dependency evidence: YES          a rollback that would discard it refuses
 * ```
 *
 * That combination is deliberate. `external()` classifies provenance; it does not
 * buy exemption from consequences.
 *
 * ## Synchronous only
 *
 * The classification is ambient and is restored before the scope returns, so a
 * write performed after an `await` inside the callback would land
 * **unclassified** — as though the user had authored the server's value. Rather
 * than document that trap, an async callback is refused with `ST1035`.
 *
 * ```ts
 * // ❌ throws ST1035
 * external(async () => {
 *   const rows = await api.getRows();
 *   tree.$.rows.setAll(rows);
 * });
 *
 * // ✅ acquire first, then classify the synchronous write
 * const rows = await api.getRows();
 * external(() => tree.$.rows.setAll(rows));
 * ```
 *
 * This is the shape the acquisition seam actually needs: acquisition is
 * asynchronous and belongs to a controller (Angular's `resource()`, an RxJS
 * pipeline, a fetch); only the *application* of the result is a SignalTree
 * event, and that application is synchronous.
 *
 * ## Nesting
 *
 * Idempotent. An inner scope declares the same two facts as the outer one.
 *
 * @param operation The externally-acquired application to classify. Called
 *   synchronously.
 * @returns Whatever `operation` returns.
 * @throws `ST1035` if `operation` returns a thenable.
 *
 * @see {@link undoable} — the mirror door, for authored work that should be
 *   reversible.
 */
export function external<R>(operation: () => R): R {
  const ambient = getActiveWriteContext();

  // MERGED onto the ambient context rather than replacing it. Replacement would
  // silently drop an enclosing `transactionId`, and an ingress landing inside a
  // transaction callback must still be visible to the transaction authority as a
  // realization — visible and non-contributing is a different thing from
  // invisible. Only what this door actually declares is overridden.
  //
  // Defined keys only: `{ ...meta }` on a partially-filled metadata object
  // materialises absent keys as explicit `undefined`, which then shows up in
  // anything inspecting the delivered meta.
  const meta: WriteMetadata = { intent: 'system' };
  if (ambient) {
    for (const [key, value] of Object.entries(ambient)) {
      if (value !== undefined) {
        (meta as Record<string, unknown>)[key] = value;
      }
    }
  }
  meta.origin = 'external';
  meta.participation = 'realized';

  const result = withWriteContext(meta, operation);

  // Thenable check written WITHOUT a `typeof result === 'object'` clause — see
  // restoration-eligibility.ts for why that clause is wrong here.
  if (typeof (result as { then?: unknown } | null | undefined)?.then === 'function') {
    throw new Error(
      'ST1035: an external-truth application must be synchronous. The ' +
        'classification is restored before the scope returns, so writes after ' +
        'an `await` inside it would be applied as authored work — the server ' +
        'value would become an undo step. Acquire first, then classify the ' +
        'synchronous write: ' +
        '`const rows = await api.getRows(); external(() => tree.$.rows.setAll(rows));`'
    );
  }

  return result;
}
