# Candidate disposition — measured, and BLOCKED on two harness limits

First real measurement of the four architecture candidates. It is NOT the
comparison the locked rules ask for, and the gap is the point of this file.

## ⚠️ The locked rules cannot be executed today. Two separate harnesses exist.

    SEMANTICS-2 matrix           424 rows, scalar/structural/composition/authority
      runner   tools/run-semantics-supplemental.mjs
      accepts  `baseline | current` ONLY
      adapters semantics-{current,structural,composition}-adapter.ts, each bound
               to the real kernel

    transaction-options suite    676 generated cases, 640 live / 59 draft
      runner   tools/experiments/transaction-options/runner.mjs
      accepts  any module implementing PROTOCOL.md
      models   frontier, draft, prepared, replay, current

**The four candidates implement the second protocol and cannot be run against
the 424 rows.** No candidate exports `makeCurrent` / `makeStructural` /
`makeComposition`, and the matrix runner has no candidate mode. Satisfying
*"run the same 424 cases against every candidate"* means writing three
SEMANTICS-2 adapters per candidate — twelve adapters of new harness work,
immediately after the instruction to stop expanding the harness. That is a
decision to take deliberately, not to slip in.

**Second limit: the native runner's status vocabulary cannot express the
required outcome classes.** It records

    passed | failed | unsupported | profile-mismatch | error

`passed` covers BOTH "settled correctly" and "correctly refused where refusal is
the specified answer" — e.g. `T22-unordered-refuses-unchanged` is a pass for
refusing. So `settled-correctly` vs `refused-safely`, and
`incorrect-settlement` vs `incorrect-refusal`, cannot be separated from these
results either. Splitting them is also harness work.

So the table below is at the granularity the EXISTING evidence supports, and no
finer. It is not the disposition matrix; it is what can honestly be filled in
before the blocker is resolved.

## What ran

Frozen models, read-only, outputs written outside the experiment. Their
provenance is a FILE HASH — a standalone `.mjs` has no meaningful repo SHA:

| candidate | sha256(16) | passed | failed | unsupported | error | profile-mismatch |
|---|---|---:|---:|---:|---:|---:|
| frontier | `d02433285ca83602` | 614 | 0 | 26 | 0 | 36 |
| prepared | `ca3a3aea190da358` | 261 | **332** | 47 | 0 | 36 |
| replay | `86186a033e6d7c50` | 109 | 0 | **531** | 0 | 36 |
| draft *(live)* | `e7dd2b604744ee27` | 0 | 0 | **640** | 0 | 36 |
| draft *(draft profile)* | `e7dd2b604744ee27` | 55 | 0 | 4 | 0 | 617 |

## Reading it, with the rules applied

**Unsupported is not a pass; it is an explicit capability gap.** On that rule:

- **frontier** is the only model that broadly implements the live profile —
  614 with 26 gaps and zero failures. It does not follow that it is correct
  under composition, identity or publication; those are not in this suite.
- **prepared** has **332 failures**. It is not a near-miss; it produces wrong
  behaviour on more than half of what it attempts. RESULTS.md called it "a
  safety option, not the full product", and these numbers agree.
- **replay** declines 531 of 640. Mostly unimplemented rather than wrong.
- **draft** declines the entire live profile by design and scores 55/59 in its
  own profile. A draft's private state cannot stand in for ordinary shared
  application state, so its live-profile zero is a real product fact, not a
  harness artifact.

**No winner is declared, and none is earned.** These are Level 1 results at
best — semantic conformance in isolation on a suite the candidates were built
against. Level 2 composition, Level 3 framework realization, Level 4 application
and Level 5 retention/performance are all untouched, and a candidate does not
win at Level 1; it earns the right to proceed.

## The decision this file exists to surface

Three options, and the first two both mean touching the harness:

1. Write twelve SEMANTICS-2 adapters so the candidates run the real 424 rows.
   Expensive, and the only route to the locked rule as written.
2. Extend the native runner's status vocabulary to split settled from refused.
   Cheaper, but still harness work, and it does not make these the 424 rows.
3. Accept that cross-suite comparison is not apples-to-apples, and treat the
   transaction-options results as a SCREEN that selects which candidates are
   worth the adapter investment — then build adapters for those only.

Option 3 spends the least on models that are already disqualified by their own
suite. It is also the only one that does not start by expanding the measuring
instrument again.

---

# PROMOTION RULE — frozen 2026-09-24, before any adapter was written

Recorded ahead of the work so no threshold can be invented after seeing results.

## How the native suite may and may not be used

> The transaction-options suite is used ONLY as a candidate promotion screen.
> Its counts are NOT compared numerically with SEMANTICS-2 and do not establish
> superiority over the incumbent or over another candidate.

> Candidates promoted from the screen are evaluated under the UNCHANGED
> SEMANTICS-2 contract before any architecture decision.

Cross-architecture conclusions come only from SEMANTICS-2. The native suite is
retained afterwards as a candidate-specific regression suite:

                    native suite        SEMANTICS-2
    frontier        must remain green   cross-architecture judgment
    draft           must remain green   cross-architecture judgment
    incumbent       n/a                 cross-architecture baseline

## The rule

    A candidate earns SEMANTICS-2 adapter investment if:

      1. its native suite shows no broad correctness failure in the semantics
         it claims to implement;
      AND
      2. it either
         a) broadly implements the target live profile, or
         b) represents a materially different architecture whose product
            semantics are intentionally being tested.

    frontier  1 + 2a   PROMOTED
    draft     1 + 2b   PROMOTED — the architectural control
    prepared  FAILS 1  332 exercised behaviours are wrong. Negative evidence
                       already paid for; not disproven-by-harness unless a
                       specific native-harness flaw is later identified.
    replay    FAILS 2a 109 implemented / 531 unsupported. INCOMPLETE, not
                       disproven. Archived; revisit if the gaps are filled.

Six adapters, not twelve: three suites x two candidates.

## The question the comparison must answer

Not "which candidate has the most green tests", but:

> Can **frontier** convert the incumbent's unnecessary refusals into correct
> settlements while preserving all existing safety and composition semantics?

> Can **draft** achieve the same correctness with materially simpler semantics
> WITHOUT violating SignalTree's shared-state / direct-write product contract?

    frontier passes, draft only works by changing what application code sees
      -> strong evidence for frontier
    draft passes naturally, frontier needs dependency graphs, precedence
    bookkeeping and special cases everywhere
      -> evidence the other way
    both fail structural/composition rows
      -> neither wins; the missing concept is located instead

## ⚠️ Rules for the DRAFT adapter specifically

Draft's **617 profile mismatches are not failures**. They report a different
visibility model, which is the entire reason it is worth comparing.

The adapter MUST NOT present draft-private state as though it were ordinary
shared application state. For every relevant scenario it must expose separately:

    canonical / shared state
    candidate-private / draft state
    what ORDINARY APPLICATION READERS see
    what accept / merge exposes

If satisfying SignalTree's direct-write / shared-state contract turns out to
require the adapter to simulate a live overlay around the draft, that is not an
adapter detail to be quietly implemented — it is the finding that **draft is not
actually simpler for this product**, and it must be reported as such.
