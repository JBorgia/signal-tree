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
the 424 rows AS THINGS STAND.** No candidate exports `makeCurrent` /
`makeStructural` / `makeComposition`, and the matrix runner has no candidate
mode.

> **CORRECTED 2026-09-24.** This section originally concluded that satisfying
> *"run the same 424 cases against every candidate"* means "three SEMANTICS-2
> adapters per candidate — twelve adapters of new harness work". **That figure
> was never measured; it was inferred from the missing exports.** The protocols
> were then mapped member by member (see "Bridge assessment" below) and they are
> very largely the same protocol under two spellings. The real cost is ONE
> shared bridge plus a named list of gaps — not twelve adapters. The missing
> exports show the suites are not wired together; they do not show the semantics
> are incompatible.

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
- **prepared** has **332 failures, every one of them an over-refusal.**
  Machine-checked: all 332 are the single pattern `actual 'refused'` vs
  `expected 'settled'` — 332/332, zero incorrect settlements and zero wrong
  values. Refusal is a specified no-op, so these are a CAPABILITY deficit, not
  wrong behaviour. Note equally that the 332 aborted at the refusal, so the
  assertions past that point never ran: **these cases do not establish
  prepared's refusal safety either.** RESULTS.md's "a safety option, not the
  full product" is exactly what this shape looks like.

  > **CORRECTED 2026-09-24.** This bullet originally read "it produces wrong
  > behaviour on more than half of what it attempts". That was false, and it
  > conflated *cannot do* with *does wrong* — the distinction this whole model
  > is built on. The failure detail was in the report the whole time and I had
  > not read it before characterizing it.
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

1. ~~Write twelve SEMANTICS-2 adapters~~ **Write ONE shared protocol bridge**
   so the candidates run the real 424 rows. Far cheaper than the twelve-adapter
   estimate this file first carried; see "Bridge assessment".
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
    prepared  FAILS 2a RETAINED as the conservative-refusal control.
                       It does NOT fail criterion 1: its 332 failures are
                       over-refusals (332/332 'refused' vs 'settled'), zero
                       incorrect settlements. That is a capability deficit,
                       which is criterion 2a, and it is the same verdict class
                       as replay for a different reason: replay has not
                       implemented the semantics, prepared declines them on
                       purpose. Not promoted for adapter investment, because
                       the SEMANTICS-2 incumbent ALREADY occupies the
                       conservative-refusal position and is the baseline every
                       candidate is measured against - a second copy of that
                       posture buys no new comparison.
    replay    FAILS 2a 109 implemented / 531 unsupported. INCOMPLETE, not
                       disproven. Archived; revisit if the gaps are filled.

One shared bridge, not twelve adapters. The threshold itself is UNCHANGED from
the frozen version; only prepared's classification under it moved, and it moved
because the evidence was misread the first time, not because the bar was
adjusted to fit a result. The frozen text of criterion 1 and 2 is untouched
above - check it.

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

---

# Bridge assessment — measured 2026-09-24, before any adapter was written

Replaces the unmeasured "twelve adapters" estimate. Method: map the two
protocols member by member and read every case callback body in the suites.

## The mismatch I assumed, and why it is not there

`SemanticCandidate.beginContribution(fn: () => void)` takes a **callback**;
`PROTOCOL.begin(ops)` takes **recorded operations**, and PROTOCOL explicitly
disclaims callback capture ("Operations are recorded assignments, NOT replayable
user callbacks"). I treated that as the blocking incompatibility.

It is not — **for three of the four suites.** Every contribution body was
extracted mechanically and counted against the raw `beginContribution(` count in
each file, so the extraction is exhaustive rather than a sample:

    semantics-supplemental.ts   14/14 bodies   f.write(key, value) only
    semantics-structural.ts     22/22 bodies   d.add / d.field / d.rekey /
                                               d.remove, plus one mixed body
                                               that also calls f.write
    semantics-authority.ts       1/1  body     f.write only
    semantics-composition.ts     7 bodies      NOT bridgeable — see below

For those 37 bodies the callback never touches a tree; it is built exclusively
from fixture-supplied seams.

`CandidateFactory.write` is even documented *"Used only inside contribution /
authority fns."* So a bridge supplies its own `write` and domain helpers that
APPEND ops instead of mutating, and hands the buffer to `begin(ops)`. The five
seams are one-to-one with the five protocol op kinds:

    f.write(k, v)                 -> {kind:'set',    path:[k], value:v}
    d.add(key, fields)            -> {kind:'add',    ref, key, fields}
    d.field(ref, {field, value})  -> {kind:'field',  ref, field, value}
    d.rekey(ref, key)             -> {kind:'rekey',  ref, key}
    d.remove(ref)                 -> {kind:'remove', ref}

`d.add` returns a ref the case captures (`held = d.add(...)`), so the recorder
mints the label and returns it immediately. That is exactly PROTOCOL's stated
design: *"Entity refs are test-held opaque handles supplied as labels."*

`AuthorityEvent.truth?: () => void` is the same shape and uses the same seam, so
one recorder serves both the contribution and the authority path.

## Member map

    MECHANICAL — no judgment required
      beginContribution/settleAccept/settleReject  -> begin/accept/reject
      SettlementResult settled|refused|already-settled -> Result (identical)
      AuthorityOrder snapshot|versioned|unordered  -> order (identical)
      SettlementRelation accepts|rejects|includes  -> settlements[] (none = omit)
      readCanonical / readVisible                  -> canonical() / read()
      observeVisible                               -> observe()
      SettlementView.retainsAuthority              -> state(id).authority
      async SEMANTICS-2 over sync PROTOCOL         -> trivially satisfied

    NEEDS A STATED RULE — defensible, but must be declared in the report
      SettlementView.disposition is ONE value per contribution;
      state(id).dispositions is an ARRAY per operation. The collapse rule must
      be written down, and a non-uniform array reported rather than flattened.
      Snapshot is Record<string,unknown> here and {values[],entities[]} there,
      so entity state has to be projected into the record by the fixture.

    GENUINELY UNREPRESENTABLE — report `unsupported`, never simulate
      Disposition 'conflicted' has NO protocol equivalent (PROTOCOL carries
        pending|committed|superseded|rejected; SEMANTICS-2 adds conflicted).
      confirmedCount() (5 call sites, the L15 retention cases) has no protocol
        equivalent. stats() offers {active, retainedOperations, history};
        treating `history` as a confirmed count is an INFERENCE, not an
        equivalence, and is not being made.
      composition (CompositionJobs) has no protocol surface at all, AND its
        callbacks are not recordable in the first place. Two of the seven
        bodies defeat a recording seam outright:
          semantics-composition.ts:94  wraps its writes in j.group(mode, ...),
            a grouping construct PROTOCOL cannot express;
          semantics-composition.ts:185 sets a test-local `reachedEnd` flag
            inside the callback, inside a try/catch that expects
            j.isCompositionRefusal to be THROWN. A recorder never throws, so
            the flag would be set where the real kernel refuses, and the case
            would report a pass built on behaviour that never happened.
        This is the concrete form of the "never simulate" rule: the composition
        suite is excluded from bridging, not approximated.

## What this costs

One shared bridge module implementing `SemanticCandidate` + `Fixture` over a
PROTOCOL `create()`, plus the recording seams — covering the scalar, structural
and authority suites (37 contribution bodies). The composition suite is out of
scope for bridging entirely. The candidates need NO new code —
they already implement PROTOCOL. The factory surface it must satisfy is four
members: `{candidate, write, flush, dispose}`.

`STRUCTURAL_CASES` / `AUTHORITY_CASES` / `SUPPLEMENTAL_CASES` (and
`COMPOSITION_CASES`, which the bridge will not run) are exported independently of `tools/run-semantics-supplemental.mjs`, so a
candidate runner reuses the UNCHANGED cases without editing the frozen runner.

## Standing constraint on the result

A bridged run measures the candidate's SEMANTICS-2 conformance and nothing else.
It does not exercise Link, framework realization, restoration or serialization,
because PROTOCOL disclaims all of them. Rows that the bridge cannot represent
honestly are reported `unsupported`; none of them is faked, and `unsupported`
never counts toward a pass.
