import { describe, expect, it } from 'vitest';

import {
  rememberTreeRealizationDescriptor,
  type TreeRealizationDescriptor,
} from './internals/causal-runtime/tree-realization-adapter';
import type { PositionId } from './internals/position-registry';

/**
 * DESCRIPTOR-MERGE-0 — the two descriptor levels have OPPOSITE merge policies.
 *
 * Driven directly through the exported `rememberTreeRealizationDescriptor`, so
 * these are the real production merge rules under controlled inputs — not an
 * instrumented reading of a live tree.
 *
 * ```text
 * NULL       descriptor accumulation is monotonic in information: a later,
 *            better-informed notification never loses to an earlier weaker one,
 *            and both descriptor levels agree
 * FALSIFIER  the two levels disagree, so which address survives depends on
 *            arrival order rather than on information content
 * ```
 *
 * ## RESULT — the NULL IS FALSIFIED. The levels disagree.
 *
 * ```text
 * top-level descriptor      existing?.fieldPathFromRow ?? fieldPathFromRow
 *                           FIRST-WRITE-WINS
 * subjectDescriptors entry  unconditional overwrite when anything differs
 *                           LAST-WRITE-WINS
 * ```
 *
 * ⚠️ AND `''` IS NOT NULLISH. So at the top level a whole-subject `''` written
 * by a weak early notification permanently blocks every later field address —
 * `?? ` never falls through for an empty string. The two policies are not merely
 * different, they are opposites, on the same two fields.
 *
 * ## ⚠️ This EXPLAINS the DESCRIPTOR-ROLE-0 result
 *
 * DESCRIPTOR-ROLE-0 measured that deleting BOTH top-level copies changed nothing
 * across the suite, and recorded them as vestigial without an explanation. This
 * is the explanation: every consumer reads
 *
 * ```text
 * inline ?? subjectDescriptors[subjectId] ?? descriptor.<field>
 * ```
 *
 * and the per-subject entry is LAST-write-wins, so it is always present and
 * always current for any subject that has been seen. The frozen first-write-wins
 * top-level copy is therefore permanently shadowed. It is unread because it is
 * unreachable, not because the information is unnecessary.
 *
 * ## ⚠️ And it explains the NESTED failure's exact mechanism
 *
 * For a nested collection the same subject is described twice, with different
 * derived field paths:
 *
 * ```text
 * addOne     path=data.rows        FIELD=""      <- correct: whole subject
 * updateOne  path=data.rows.seed   FIELD="seed"  <- fabricated: the entity KEY
 * ```
 *
 * Last-write-wins at the subject level means the FABRICATED address wins. Had
 * that level been first-write-wins like the top level, the correct `''` would
 * have survived and the nested rollback would have worked by accident.
 *
 * So the nested defect is not one bug. It is a bad derivation (SUBJECT-ADDRESS-0)
 * PLUS a merge policy that specifically prefers the later, worse answer.
 *
 * ⚠️ Neither policy is "monotonic in information", which was the pending plan's
 * wording. Fixing the derivation alone would leave an order-dependent merge; the
 * correction has to name a rule that makes a WEAKER notification unable to
 * displace a stronger one in either direction.
 *
 * ## ⚠️ AND THE PING NEEDS NO SUBJECT AT ALL
 *
 * Found while building the control for the `??` policy, and worse than the
 * masking already recorded in SUBJECT-ADDRESS-0:
 *
 * ```text
 * if (structuralEffect) return undefined;
 * if (path === ownerPath) return '';                        <- returns here
 * if (typeof subjectId !== 'number' || ...) return undefined;
 * ```
 *
 * The whole-subject `''` is returned BEFORE `subjectId` is examined. So an
 * owner-only ping carrying NO SUBJECT still establishes "the whole subject" as
 * its address. That answers the remaining SUBJECT-ADDRESS-0 case directly:
 *
 * > The owner-only ping must establish NO subject address. Today it establishes
 * > the strongest address in the model, for a subject that does not exist.
 *
 * And in that one case nothing shadows it — there is no `subjectDescriptors`
 * entry — so the frozen top-level copy IS what consumers reach. The vestigial
 * finding from DESCRIPTOR-ROLE-0 holds for every case EXCEPT this one.
 */

const POS = 1 as PositionId;

const remember = (
  descriptors: Map<PositionId, TreeRealizationDescriptor>,
  path: string,
  ownerPath: string,
  subjectId?: number
) =>
  rememberTreeRealizationDescriptor({
    descriptors,
    path,
    ownerPath,
    positionIds: [POS as unknown as number],
    subjectIds: subjectId === undefined ? undefined : [subjectId],
  });

const subjectEntry = (
  descriptors: Map<PositionId, TreeRealizationDescriptor>,
  subjectId: number
) => descriptors.get(POS)?.subjectDescriptors?.get(String(subjectId));

describe('DESCRIPTOR-MERGE-0: the two levels disagree', () => {
  it('⚠️ top level is FIRST-write-wins; the subject entry is LAST-write-wins', () => {
    const d = new Map<PositionId, TreeRealizationDescriptor>();

    // Two notifications for the SAME subject that derive DIFFERENT field paths —
    // the nested shape, exactly as production produces it.
    remember(d, 'data.rows', 'data.rows', 1); // -> ''
    const afterFirst = d.get(POS)?.fieldPathFromRow;
    const subjectAfterFirst = subjectEntry(d, 1)?.fieldPathFromRow;

    remember(d, 'data.rows.seed', 'data.rows', 1); // -> 'seed'
    const afterSecond = d.get(POS)?.fieldPathFromRow;
    const subjectAfterSecond = subjectEntry(d, 1)?.fieldPathFromRow;

    // The control: the two writes must genuinely derive different values, or
    // this test would pass no matter what the merge policy was.
    expect(subjectAfterFirst).not.toBe(subjectAfterSecond);

    // TOP LEVEL: frozen at the first answer.
    expect(afterFirst).toBe('');
    expect(afterSecond).toBe('');

    // SUBJECT ENTRY: replaced by the second answer. Opposite policy, same field.
    expect(subjectAfterFirst).toBe('');
    expect(subjectAfterSecond).toBe('seed');
  });

  it("⚠️ `''` is not nullish, so it permanently blocks the top level", () => {
    const d = new Map<PositionId, TreeRealizationDescriptor>();

    remember(d, 'data.rows', 'data.rows', 1); // -> ''
    expect(d.get(POS)?.fieldPathFromRow).toBe('');

    // Any number of better-informed notifications cannot displace it.
    remember(d, 'data.rows.seed', 'data.rows', 1);
    remember(d, 'data.rows.other', 'data.rows', 1);
    expect(d.get(POS)?.fieldPathFromRow).toBe('');
  });

  it('the control: an UNDEFINED first write DOES fall through at the top level', () => {
    const d = new Map<PositionId, TreeRealizationDescriptor>();

    // A non-owner path with no subject -> undefined, which IS nullish.
    remember(d, 'data.rows.seed', 'data.rows');
    expect(d.get(POS)?.fieldPathFromRow).toBeUndefined();

    // So first-write-wins is genuinely `??`-shaped, not an unconditional freeze.
    // This is what makes the `''` case above a distinct defect rather than a
    // restatement of the merge policy.
    remember(d, 'data.rows.seed', 'data.rows', 1);
    expect(d.get(POS)?.fieldPathFromRow).toBe('seed');
  });

  it('⚠️ THE PING MANUFACTURES A WHOLE-SUBJECT ADDRESS WITH NO SUBJECT', () => {
    const d = new Map<PositionId, TreeRealizationDescriptor>();

    // An owner-only notification. No subjectId is supplied at all.
    remember(d, 'data.rows', 'data.rows');

    // It nonetheless derives `''` — "the whole subject" — for a subject that
    // does not exist, because `path === ownerPath` returns `''` BEFORE the
    // subjectId check ever runs:
    //
    //   if (structuralEffect) return undefined;
    //   if (path === ownerPath) return '';                 <- here
    //   if (typeof subjectId !== 'number' || ...) return undefined;
    //
    // This is the SUBJECT-ADDRESS-0 case: the owner-only ping must establish NO
    // subject address, and today it establishes the strongest one there is.
    expect(d.get(POS)?.fieldPathFromRow).toBe('');

    // And there is no subject entry to shadow it, so unlike every other case
    // the frozen top-level copy is the value consumers actually reach.
    expect(d.get(POS)?.subjectDescriptors?.size ?? 0).toBe(0);
  });

  it('⚠️ so the surviving address depends on ARRIVAL ORDER, not information', () => {
    const forward = new Map<PositionId, TreeRealizationDescriptor>();
    remember(forward, 'data.rows', 'data.rows', 1);
    remember(forward, 'data.rows.seed', 'data.rows', 1);

    const reverse = new Map<PositionId, TreeRealizationDescriptor>();
    remember(reverse, 'data.rows.seed', 'data.rows', 1);
    remember(reverse, 'data.rows', 'data.rows', 1);

    // Same two notifications, opposite order. The top-level answers differ...
    expect(forward.get(POS)?.fieldPathFromRow).toBe('');
    expect(reverse.get(POS)?.fieldPathFromRow).toBe('seed');

    // ...and the subject entries differ the other way, which is the asymmetry.
    expect(subjectEntry(forward, 1)?.fieldPathFromRow).toBe('seed');
    expect(subjectEntry(reverse, 1)?.fieldPathFromRow).toBe('');
  });
});
