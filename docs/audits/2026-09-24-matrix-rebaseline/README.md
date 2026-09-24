# SEMANTICS-2 matrix rebaselined on the merged SHA — no verdict moved, eleven traces did

> **CORRECTED 2026-09-24, after independent review.** The first version of this
> file said "nothing moved" and "diagnostic-retention changes: NONE". Both
> overstated what had been checked: the comparison was on `status` ALONE, so it
> could not see trace changes, and eleven rows do differ. It also cleared the
> confirmed-count assertion family on a circular argument. Corrected below; the
> original numbers were right, the conclusions drawn from them were not.

Run against `f05cc70ba1583483b8e45bafe87fac6365c6fa9b`, clean tree, after the
15.3.0 merge, the v16 research-line merge and the L15 retention default.

⚠️ **The prior `188/68/168` was NOT a measurement of pristine `7ade0e3e`.** Both
runs carry `mode: "current"` and `baseline: "7ade0e3e…"`: the `baseline` field
names the comparison REVISION, while `mode: current` means the run executed the
WORKING SOURCE. The earlier capture was a repaired, uncommitted tree based on
that commit, with its source bytes hashed. That is the reason substantial merged
work can leave verdicts unchanged — much of it was already present in those
captured bytes. The first version of this file got that wrong.

Same four commands as the recorded baseline, unchanged suites:

```sh
node tools/run-semantics-supplemental.mjs current <out>/scalar.json
node tools/run-semantics-supplemental.mjs current <out>/structural.json structural
node tools/run-semantics-supplemental.mjs current <out>/composition.json composition
node tools/run-semantics-supplemental.mjs current <out>/authority.json authority
```

All four exit 1, as before, because unresolved and unsupported rows remain.

## Result

| suite | held | violated | unsupported | errors | baseline |
|---|---:|---:|---:|---:|---|
| scalar | 25 | 9 | 1 | 0 | 25 / 9 / 1 |
| structural | 135 | 48 | 24 | 0 | 135 / 48 / 24 |
| composition | 28 | 10 | 133 | 0 | 28 / 10 / 133 |
| authority | 0 | 1 | 10 | 0 | 0 / 1 / 10 |
| **total** | **188** | **68** | **168** | **0** | **188 / 68 / 168** |

**Per-row, not just totals: 424 rows compared by id, ZERO changed, zero new,
zero gone.** Matching totals can hide rows swapping, so the comparison is by
case id. It is also checked for vacuity — 207 distinct structural ids, no null
ids, real status values — because a diff that keys on nothing reports zero
differences too.

**But status is not the whole row.** A full-field comparison finds **11 rows
differing**, all in `trace`:

    8   T06b/* key variants   refusal REASON moved
                              was: effect-validation-failed
                                   ("compensating turn 2 failed validation —
                                    structural-drift"), discovered DURING
                                    compensation
                              now: later-confirmed-dependency
                                   ("turn 3 depends on state this rollback would
                                    invalidate"), decided at PLANNING time

    3   C4 / C7 / C9          confirmedAfter 2 -> 0
        .../coalesce/inner-transaction

The first is a real improvement and not merely cosmetic: refusing at planning is
strictly better than discovering structural drift half-way through compensation,
and it is attributable to the merged dependency work. The second is an
observable retention difference.

So, in the three categories that must be kept apart:

    behaviour changes              no verdict or assertion result changed;
                                   8 refusal REASONS changed (improvement)
    diagnostic-retention changes   3 confirmed-history traces changed, 2 -> 0
    harness defects                none surfaced

The earlier "diagnostic-retention changes: NONE" was FALSE. Comparing statuses
alone cannot establish behavioural equivalence — which is the same lesson as
"green is not equivalent", applied one level up to the comparison itself.

## Retention vacuity: the first argument was CIRCULAR; here is the measurement

L15 releases confirmed records once no pending turn can need them, so any
assertion phrased as a confirmed-COUNT delta could silently become `0 === 0`.

Two observations were recorded first, and neither is sufficient:

    retention on vs off   suites re-run with history.retain 1000 — zero verdicts
                          changed. Agreement on a CORRECT implementation says
                          nothing about sensitivity to an incorrect one.
    values compared       confirmedCount() instrumented over a full structural
                          run: 80 calls, 64 NON-ZERO, distinct values [0, 1].
                          This shows the READER returns meaningful values.
                          `1 === 1` can still miss an added record if another
                          disappears.

The argument originally offered — *a refusal implies a pending turn, which is
exactly when L15 retains* — is CIRCULAR. It assumes the correct behaviour in
order to prove the test would catch the incorrect one, and the defect under test
can violate the premise: incorrectly settling a refused transaction ALSO releases
its retention obligation, moving both sides of the delta to zero together.

### The targeted sensitivity check

Inject the specific wrong behaviour in isolation — **a refused operation creates
confirmed ownership, WITHOUT retiring the pending turn**, so that only the
count assertion can observe it — and run structural under the DEFAULT retention
policy:

    held      135 -> 103
    violated   48 ->  80
    32 rows flipped held -> violated

Every one of the 32 fails on exactly one label:

    32   refusal creates no confirmed record

Not the pending-authority assertion, not the visible-state assertion. The count
assertion catches it, by itself, under the default policy. That is empirical
sensitivity rather than an argument from correctness.

(Only 32 of 135 flip because the injection sits on the plan-conflict door; rows
that refuse through the other door never reach it. The mutation was reverted and
is not in this commit.)

⚠️ Scope: this establishes sensitivity for THIS assertion, to THIS defect, in
THIS suite. It is not a general clearance for count-shaped assertions.

## The 68 violated rows — the v16 work list

    scalar (9)        S11/12/{RA,RR}  S12/reject/{123,132,213,231,312}
                      S06  S13/local-frontier/R
    structural (48)   T10 x40   T09 x8
    composition (10)  C3-transactions-link x2
                      C6-transactions-entityMap-link x3
                      C8-transactions-restoration-link x2
                      C9-transactions-entityMap-link-batching x3
    authority (1)     A1

⚠️ **Scope the comparison to all 424 rows, not these 68.** Comparing candidates
only against the reds would omit the 168 unsupported cases — including the
authority and composition requirements — and would permit regressions among the
188 held. Use the reds to PRIORITISE experiments; keep the whole evaluation:

    previously held behaviour stays held
    required successful settlement REPLACES refusal where specified
    unsupported capabilities become genuinely exercised, with no synthetic
      adapter behaviour standing in
    publication, retention and integration stay correct

All 10 composition violations involve Link. That is a correlation and a
HYPOTHESIS about a shared cause — it does NOT establish the Record-insertion
membership defect as the mechanism. Each needs separate evidence.

`S13/local-frontier/R` is the one to look at first. The baseline records it as
**baseline-held → current-violated**: two pending turns write `x`, an ordinary
write follows, then both are rejected. The old behaviour completed both
rejections; the current one refuses the first. The baseline attributes this by
source inspection to the overlapping later-pending check in
`getPendingRollbackPlan` — the conservative guard that also makes H4/H5/H6 pass.

That is the discriminator in miniature: **a previously settling operation that
now refuses.** It should not stand alone, though — a scalar-only proof is how an
architecture gets chosen on the easiest evidence. Pair it with a structural case
(T09 or T10) and an independent-Link-progress case (C6 or C9). Safety containment bought it, and the ownership model has to buy
it back. Counting it as "held" would be exactly the mistake of reading H1–H9 as
a success criterion rather than a floor.

## Reproduction

The four suite JSONs are committed here. The prior snapshot remains at
`/private/tmp/signaltree-final-current-conformance-ownproperty-20260924/`, which
is machine-local and should be treated as perishable.
