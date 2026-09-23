# Preregistered predictions — current implementation vs the 14 laws

Recorded 2026-09-23, BEFORE the contract module is written and before any
case runs. Predictions for L1..L11 were recorded when those laws were frozen;
L12..L14 are predicted here, at the time they were added, not retrofitted.

These are not changed after execution. A wrong prediction is a finding.

    law  prediction  reasoning

    L1   FAIL        R6: a speculative value stays visible owned by nothing.
                     Measured in all published 15.x.
    L2   FAIL        R6: authority is retired before compensation is proven.
    L3   FAIL        the root cause. Compensation writes a captured baseline.
    L4   FAIL        R8/A: rolling back the older turn destroys the newer
                     turn's live value.
    L5   FAIL        R8/E: rolling back both ends at the first turn's
                     rejected value.
    L6   FAIL        nothing distinguishes authored order from settlement
                     order; there is no contribution sequence at all.
    L7   PASS        subject lifetime is genuinely well built. StructuralStore
                     allocates monotonic subject ids, tombstones clear the key
                     mapping, and a re-added key is a different subject by
                     construction. This is the asset the architecture
                     hypothesis assumes is worth preserving.
    L8   PARTIAL     dependencies are detected but by PRESENCE, so honest
                     refusal happens for the wrong reason and over-broadly.
                     T02a passes, T06a probably fails (independence read as
                     dependency).
    L9   FAIL        R6 leaves a contribution with no terminal disposition.
    L10  UNKNOWN     inspect() reports current/superseded, but whether
                     settlement agrees has never been tested. This is the
                     product-thesis law, so the answer matters either way.
    L11  FAIL        supersession is recognised against later authored and
                     realized writes but NOT across concurrent pending turns,
                     which is R8's mechanism.
    L12  UNKNOWN,    there is no revision/correlation model to order by, so
         likely FAIL any ordering that exists is arrival-based. Expect T19 and
                     T21 to fail; T22 is the interesting one, because
                     "inventing an order" and "having no order" are both
                     possible and only one is a law violation.
    L13  likely PASS the mutation-frame machinery already exists and is the
         (stronger    strongest thing in this subsystem. If O01..O03 pass, that
         than         is evidence FOR preserving mutation frames through any
         expected)    rewrite rather than discarding them.
    L14  FAIL        R6 demonstrated it directly: a failed rollback whose retry
                     returns success while reversing nothing.

    L15  FAIL        terminal transaction state is not separated from active
                     correctness state; the confirmed-turn ledger is the
                     settlement machinery. R06 is the sharp one: if toggling
                     diagnostics changes a settlement outcome, correctness and
                     evidence are entangled.
    L16  UNKNOWN,    no per-position scoping of holds is visible in the
         likely FAIL  settlement path, so N03/N05 are the likely failures.
                     Predicting UNKNOWN rather than FAIL because the
                     owner-invalidation work may already scope more tightly
                     than expected.
    L17  UNKNOWN     L7's subject machinery is typed and looks lossless, but
                     whether identity stays typed ACROSS the transaction/link/
                     entityMap seam is untested. I08 is the case that decides
                     it; I06 (1 vs "1") is the cheapest falsifier.
    L18  likely FAIL a deferred write that resolves ambient context at
                     execution rather than capture would reclassify silently.
                     CCTX5 is the interesting one: refusing is legitimate, but
                     a refusal that already queued a write is not a refusal.

## Aggregate prediction

    L1..L18:  11 FAIL, 1 PARTIAL, 4 UNKNOWN, 2 PASS(ish)

The two predicted passes matter more than the nine failures. L7 and L13 are
the parts of the current kernel worth carrying into whatever wins. If L7
fails, the architecture competition changes substantially, because subject
lifetime is the asset the whole hypothesis rests on.

## How the result is reported

As a disposition table per law, not a pass/fail count. With 40+ cases,
"how many failed" is far less informative than WHICH laws are violated and
whether the failures cluster. Clustered failures point at one missing concept;
scattered failures point at several.
