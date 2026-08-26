import type { WriteMetadata } from '../mutation-types';
import { withWriteContext } from '../write-context';

/**
 * NON-AUTHORED FLAT-SCALAR INGRESS — §C / C4.
 *
 * The entrance external acquisition, restoration, hydrate and Link realization
 * use instead of authored callable syntax:
 *
 *     AN OPERATION THAT ALREADY KNOWS ITS MUTATION SEMANTICS MUST NOT RE-ENTER
 *     THROUGH SYNTAX WHOSE JOB IS TO INFER THOSE SEMANTICS.
 *
 * ⚠️ THIS IS NOT `Partial<T>` ASSIGNMENT. The two omissions are different kinds:
 *
 *     OMISSION IN A WHOLE VALUE IS VALUE SEMANTICS.
 *     OMISSION IN AN ACQUISITION PROJECTION IS SCOPE.
 *
 * A projection says WHICH SUBJECTS storage spoke about. Keys it does not mention
 * are not "set to undefined" and are not "preserved by merge" — they are simply
 * OUTSIDE WHAT WAS SUPPLIED, so nothing happens to them at all. That is why a
 * partial shape is structurally right here and wrong on the authored callable.
 *
 * ⚠️ PROVENANCE IS ATTACHED PER SUBJECT, NEVER AMBIENTLY.
 *
 *     PROVENANCE FOLLOWS SUPPLIED INFORMATION, NOT EXECUTION PROXIMITY.
 *
 * Each supplied subject gets its own write context, opened and closed around
 * that single write. An ambient scope spanning the whole payload — or worse, the
 * branch or the tick — would let an unrelated authored write that merely happens
 * to run nearby inherit `external`/`realized`. `bind-branch-0` already pins the
 * opposite: an authored write to an OMITTED sibling in the SAME TICK stays
 * authored, because storage never spoke about it.
 *
 * ⚠️ SCOPE IS DELIBERATELY FLAT SCALAR SUBJECTS ONLY. The carriers that prove
 * this contract use one branch of scalar leaves. These remain OPEN by ABSENCE of
 * evidence, and this function must not guess at them:
 *
 *     unknown keys                  `traversal-diagnostics` owns that contract
 *     callable-valued supplied leaves  governed by the B1 freeze
 *     nested branches, entities     no carrier
 *     traversal order               no carrier
 *     cross-leaf atomicity          no carrier — see below
 *
 * ⚠️ ATOMICITY IS NOT DECIDED HERE. Two supplied leaves produce two realized
 * subjects; how many physical commit frames carry them is private representation
 * that no carrier constrains. Nothing here may be read as freezing either "one
 * atomic multi-leaf acquisition" or "independent commits".
 */

/** The minimum a subject must expose to be realized. Structural, not nominal. */
type RealizableSubject = { set(value: never): void };

const isRealizableSubject = (value: unknown): value is RealizableSubject =>
  typeof value === 'function' &&
  typeof (value as { set?: unknown }).set === 'function';

/**
 * Realize exactly the subjects the payload supplies.
 *
 * @returns the keys actually realized, in supplied order — the caller's evidence
 *   of WHICH subjects storage spoke about. Deliberately not a count: the
 *   per-subject inventory is the thing `bind-branch-0` proves, and collapsing it
 *   to one opaque branch effect destroys the causal information.
 */
export function acquireScalarProjection<T extends Record<string, unknown>>(
  branch: Record<string, unknown>,
  payload: Partial<T>,
  meta: WriteMetadata
): readonly string[] {
  const realized: string[] = [];

  for (const key of Object.keys(payload)) {
    const subject = branch[key];

    // Unknown / non-scalar keys: OPEN. Deliberately no new behaviour — no throw,
    // no diagnostic, no recursion. Adding one here would invent a contract the
    // carriers do not prove and would collide with the existing unknown-key
    // diagnostics that `traversal-diagnostics` owns.
    if (!isRealizableSubject(subject)) {
      continue;
    }

    // ONE CONTEXT PER SUBJECT. Opened and closed around this single write, so
    // the provenance cannot outlive the subject it describes.
    withWriteContext(meta, () => {
      (subject as { set(value: unknown): void }).set(
        (payload as Record<string, unknown>)[key]
      );
    });
    realized.push(key);
  }

  return realized;
}

/** The metadata an external acquisition attaches to each supplied subject. */
export const EXTERNAL_ACQUISITION: WriteMetadata = {
  intent: 'system',
  origin: 'external',
  participation: 'realized',
};
