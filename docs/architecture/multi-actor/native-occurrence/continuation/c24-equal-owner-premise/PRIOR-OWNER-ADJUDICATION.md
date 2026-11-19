# Latest thirteen cases: older owner survives newer net-zero writes

**Verdict: the thirteenth case's no-send expectation is justified by existing scalar admission semantics and the approved destination-preservation rule.** It is not a new requirement that every matching historical value retains every old owner. No source edits or tests executed by this review.

## Frozen contract and active source

C23 `packages/kernel/src/enhancers/transactions/queued-inspection-review.spec.ts:134–162` explicitly preserves deliberate net-effect admission (its comments cite0a131c34 and d8ad11da5). Older writes x1; newer writes x2→x1. It asserts newer.inspect().changes=[], older x remains `current`, one actual pending turn, and the older status remains current after either newer confirmation or rollback. This is directly relevant transaction evidence, stronger than the restoration-only snapshot net-zero example. I read this frozen spec; did not rerun it.

Main's newer q also changes z. That difference is supported by the active per-position logic, not simply assumed from the no-turn example: transactions.ts:3067–3101 folds/drains effects then excludes independently journaled scalar positions with no remaining net effect/disposition. z remains, x is pruned. `plain-branch-membership.ts:441–446,556–566` filters equal before/after scalar effects; `drainCaptureBucket`:1840–1860 and `foldOperationDisposition`:2704–2723 both use it. The temporary combined x7/after7 bucket entry is therefore not the final admission. q's surviving z effect does not make every touched scalar q-owned.

Combined with EQUAL-WHOLE-AUTHORITY's preservation of actual destination ownership, this means q.confirm() cannot release p's x7. An independent literal equal write may refresh unowned evidence, but x is still p-owned. p.rollback() must restore x0 while confirmed z1 survives. This does not authorize copying all prior proofs or infer ownership from numeric equality alone.

## Exact new specimen and observed limit

Read `/private/tmp/st-c24-equal-owner/candidate/packages/kernel/src/lib/equal-owner-admission.spec.ts`, thirteen generated cases. Final case:

- p writes x7;
- q writes z1 and x9→x7;
- after draining, sent=[];
- q.confirm(), drain, sent=[];
- independent equal leaf x7, drain, **required sent=[]**;
- p.rollback(), require x0, z1, exact single `{x:0,y:0}` delivery and await settled.

`before-prior-owner/first.log` now reports **one failed, twelve skipped**, failing the third no-send check at spec line66: actual `[{x:7,y:0}]`. The first two no-send checks pass. The terminal assertion at line67 is unreached. I saw Nx failure text, not a separate finalized RESULT.json, and claim no independent process exit receipt. This is Main's executed result, independently interpreted—not my replay.

The new test distinguishes retaining the current selected predecessor p from retaining the most recent native D=q. Once q confirms, merely requiring its destination to be terminal would wrongly admit x7. The source/source-selection defect cannot be solved by dropping all D on net-zero either: p must be restored/preserved rather than lost.

## Completeness and exact claims

The thirteen-case matrix usefully separates: four actual-owner leaf/whole holds with confirm/rollback continuations; four unowned possible-only progress controls; two inherited-q obligations; one no-effect write inside a transaction owning only z; one net-zero-to-initial-value control; and one older-owner/newer-net-zero control.

The q-input cases establish declared q support around p's write. They do not independently prove arbitrary implicit getter dependency discovery. The plain net-zero control's passing baseline alone was not ownership proof; the frozen scalar contract and live normalization path now supply the required premise. A passing future repair must reach its later useful output/settlement assertions, not merely stop sending.

Useful small strengthening before treating the thirteenth case as a complete selection witness: assert q.inspect() names z but not x and p.inspect() still names x `current`, before and after q.confirm(). This directly pins the fixture premise. Keep its rollback/value/no-duplicate/settled assertions. These are recommendations only; no assertion changes here.

This thirteen-case set is not full implementation qualification. Inspection ordinary-versus-physical selection, current updater/branch inputs, support-only reentry, declaration error precedence, membership/lifetime, late enrollment and disposal still need the bounded controls already requested when the implementation freezes. No additional suite or new state model is proposed.
