# SEMANTICS-2 matrix rebaselined on the merged SHA — no verdict moved

Run against `f05cc70ba1583483b8e45bafe87fac6365c6fa9b`, clean tree, after the
15.3.0 merge, the v16 research-line merge and the L15 retention default. The
prior figure (`188 held / 68 violated / 168 unsupported`) was captured at
`7ade0e3e` and predated all of them.

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

So, in the three categories that must be kept apart:

    behaviour changes              NONE
    diagnostic-retention changes   NONE
    harness defects                none surfaced

## The retention-vacuity hazard was checked, and does NOT materialise

L15 releases confirmed records once no pending turn can need them, so any
assertion phrased as a confirmed-COUNT delta could silently become `0 === 0` —
true regardless of the implementation. Two measurements:

**1. Retention on vs off.** The suites were re-run with the adapter building
`transactions({ history: { retain: 1000 } })` instead of the default. **Zero
verdicts changed** in any suite. (The adapter edit was reverted; it is not in
this commit.)

**2. The values actually compared.** `confirmedCount()` was instrumented for a
full structural run:

    calls              80
    non-zero readings  64
    zero readings      16
    distinct values    [0, 1]

The assertions compare 1 against 1 in 80% of readings. They are LIVE, not
vacuous.

There is a reason, and it is worth stating because it means the hazard is
structurally unlikely here rather than merely absent today: the assertion is
*"refusal creates no confirmed record"*, and a refusal implies a pending turn
still exists — which is exactly the condition under which L15 RETAINS. The
assertion's precondition and the retention bound coincide.

⚠️ This clears the confirmed-count family in THESE suites. It is not a general
clearance for every count-shaped assertion in the repo.

## The 68 violated rows — the v16 work list

    scalar (9)        S11/12/{RA,RR}  S12/reject/{123,132,213,231,312}
                      S06  S13/local-frontier/R
    structural (48)   T10 x40   T09 x8
    composition (10)  C3-transactions-link x2
                      C6-transactions-entityMap-link x3
                      C8-transactions-restoration-link x2
                      C9-transactions-entityMap-link-batching x3
    authority (1)     A1

`S13/local-frontier/R` is the one to look at first. The baseline records it as
**baseline-held → current-violated**: two pending turns write `x`, an ordinary
write follows, then both are rejected. The old behaviour completed both
rejections; the current one refuses the first. The baseline attributes this by
source inspection to the overlapping later-pending check in
`getPendingRollbackPlan` — the conservative guard that also makes H4/H5/H6 pass.

That is the discriminator in miniature: **a previously settling operation that
now refuses.** Safety containment bought it, and the ownership model has to buy
it back. Counting it as "held" would be exactly the mistake of reading H1–H9 as
a success criterion rather than a floor.

## Reproduction

The four suite JSONs are committed here. The prior snapshot remains at
`/private/tmp/signaltree-final-current-conformance-ownproperty-20260924/`, which
is machine-local and should be treated as perishable.
