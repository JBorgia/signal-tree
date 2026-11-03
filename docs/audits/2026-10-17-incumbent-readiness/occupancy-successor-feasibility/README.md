# Occupancy successor feasibility: revised scope, no runtime acceptance

Investigation October22–23, 2026. Readiness base
95dbf59a0d66e1dab06b72cf756fd2afcc231ce7. Rejected runtime remains6bd4ee8a;
production87f6831f and scoped slice1 validity are unchanged. No runtime source was
edited, no successor selected, and no later-slice or broad qualification run.

## What changed in the proposed plan

Complete per-operation ordinary edits cannot simply enter today's unchanged
capture fold. Actual extracted transaction composition silently drops add after
remove for the same lifetime. A supported native sequence reaches the proposed
input: ordinary A@a/B@b; inspection moves A→c; transaction moves B→a then A→d.
The proposed corrected admission emits remove(A,a), rekey(B,b,a), add(A,d), while
the old fold retains remove(A,a), rekey(B,b,a). It omits final ordinary A@d.

The unchanged rejected runtime itself successfully rolls this sequence back:
its original missing-displacement defect avoids emitting that remove/add pair.
This is a demonstrated producer/consumer encoding incompatibility, not a new
native corruption result. Exact inverse-rekey assertions are stronger than needed
for final rollback: a physical identity join could realize inverse-add as transfer.
Forward authority, inspection and dependency facts still need truthful endpoints.

The [concrete specification](PREPARATION.md) now identifies two additional shared
requirements beyond a displacement compiler and installer correction:

1. Transaction-wide occupancy composition, used consistently by paired capture,
   rich capture and operation-journal refolding. Separate fields, explicit order
   and surviving nested obligations must not disappear when occupancy cancels.
2. Physical transfer plus separately resolved placement before validation, without
   synthetic remove/add callbacks or blanket full-collection fallback. Structural
   target installation must also retain approved ordinary7/physical99 divergence
   rather than clearing ordinary values for every existence inverse.

The [independent recurrence review](RECURRENCE-REVIEW.md) and
[physical-plan review](REALIZATION-REVIEW.md) give exact source boundaries and
limits. No public payload or ordering policy is reopened.

## Evidence classification

- Original extracted-fold assertions:6 pass/2 fail. Original compiled-sequence
  assertion fails. Logs and assertions retained unchanged in normalization/.
- Supported native sequence: succeeds on rejected source; root independently
  replayed it and preserved output. Internal established inspection-context harness,
  not browser/devtools end-to-end qualification.
- Endpoint alternative: experimental per-lifetime before/final composition, then
  actual incumbent inverse generation. Its results are separately recorded under
  endpoint/. These cannot be called native capture/settlement passes.
- The original endpoint first-run log inherits the old harness's scope string;
  that string is inaccurate for its replacement fold. The endpoint FINDING records
  the correct provenance. Preserve the raw log rather than rewriting its history.
- Original rekey-vacancy and active-old refusal native falsifiers remain unchanged
  in the prior slice2 archive. They were not rerun merely for this document.

Root verified frozen source hashes for transactions.ts and pending-rollback.ts
against normalization/source-identities.json, inspected the actual unhandled pair,
replayed the original8 probes, compiled sequence and native sequence. Replays
root-probes.log/root-compiled.log/root-native.log are distinct from first results.
No native successor, framework/lifecycle qualification or fresh cost evidence exists.

## Disposition and next boundary

The chronological producer plus unchanged fold is rejected as the successor
mechanism. The endpoint alternative is a representation feasibility result only;
it has not cleared the recurrence gate. The smallest plausible revised scope is
one shared occupancy composer across real capture intervals plus one prepared
ordinary/physical realization record with explicit placement. It must preserve
nested surviving obligations and original native failures, not merely net keys.
Chronological replay end-to-end is a larger alternative with no demonstrated need.

Do not patch individual writers, relax physical add guards, or route all point
work through full targets. Review the added capture/placement scope before runtime
selection. The prior usage-limit interruption is infrastructure history, not a
failed test; independent review resumed October23. No permission, test pass count,
or endpoint example alone accepts runtime integration. B remains closed; budgets,
activation, merge/push/publication and slices3–5 are unchanged.

Replay commands and exact artifacts are in normalization/FINDING.md and
endpoint/FINDING.md. The archive preserves source, generated probes and raw logs;
only independent empirical claims at the described scope are supported.
