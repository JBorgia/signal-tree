# One remaining owner decision: unobserved-origin admission

This is a proposed specification direction, not runtime authorization or acceptance.
The original hold-before-confirm / send-after-confirm control stays unchanged.
Root and independent review distinguish this question from already-approved fresh
ordinary reevaluation after rejection.

## Recommended bounded option

For an authored ordinary revision whose complete input origin is not covered by
an applicable complete declaration plus native input evidence, create a separate
conservative possible-owner obligation from instrumented owners pending at that
revision's admission. This is a conservative policy, not a dependency claim.

Consequences:

- An unscoped literal target(7) can wait for unrelated foreign p, because it is
  observationally indistinguishable from target(source.x()) returning pending7.
- A complete truthful declaration plus complete native-input evidence can still
  provide useful immediate progress under the approved contributor/horizon rules.
  Recipient-only coverage uncertainty retains its adjudicated tree-local fallback;
  an unused passive connection does not create a possible-owner obligation.
- Native updater syntax by itself is insufficient. An undeclared
  target(old => source.x()) remains unobserved-origin despite its known old argument.
- The window is revision-specific and fixed. Later unrelated owners do not extend
  it. Later writes replace/re-evaluate their own evidence; current local gates and
  actual newly required structural facts remain applicable.

Terminal outcomes invalidate eligibility independently of public value events and
wake the exact held revision through owner-to-ticket indexes. All actual gates,
validation and native installation must finish before delivery. Permission never
transfers to a changed revision by equality.

| Event | Required disposition |
| --- | --- |
| All captured possible owners confirm | Reevaluate coherent current ordinary projection; useful surviving-basis send under current gates; no additional value write required |
| One owner still pending | Continue holding; no release merely because another confirmed |
| Successful rejection, others terminal, no known unavailable/unresolved fact | Invalidate old ticket and evaluate a fresh current ordinary ticket under approved surviving-write rules; current0 sends0, surviving7 can send7; old proof is never confirmed |
| Registry disappearance, source destruction with unresolved/unavailable outcome | Not confirmation or successful rejection; preserve unavailable status and existing recovery/disposal contract |
| Superseding authored write | Retire obsolete revision's wait edges; prepare the new revision's actual evidence/window; terminal receipts never revive |
| Connection disposal | Drop that connection's queued obligations/waiters under existing disposal semantics; in-flight completion cannot resurrect it |

The supported experiment is within the instrumented kernel instance and authentic
owner lifecycle. This does not infer arbitrary asynchronous causality, provenance
of plain saved objects, or owners in another uninstrumented runtime. A saved-value
write after authentic rejection remains new ordinary authorship as approved.
Missing native input coverage still denies declared early permission; the window
must never be used to pretend that a native absence was captured correctly.

Costs and beneficiary/payer: qualified declaration users retain useful conditional
progress; undeclared unrelated writers can wait unnecessarily. Native owners pay
indexed notification/storage overhead proportional to captured live obligations.
Capturing a pending-owner set may cost O(P); an immutable epoch/index is an option,
not an unmeasured claim of constant time. No per-write scan of registered trees,
permanent history, new public API or budget increase is authorized.

## Alternative

Specify a new tracked execution/read boundary to distinguish actual consumed
inputs. That requires a separate execution contract for cached framework carriers,
saved values, no-write reads, nested callbacks and async continuation. The current
updater-source mapping is not that mechanism. This alternative is a larger scope
than the recommended conservative admission policy.

Keeping unconditional tree-local fallback for both indistinguishable undeclared
expressions cannot also satisfy the original cross-tree safety control. Removing
that assertion is not an authorized alternative in this investigation.

## Why selection is required

commit-consequence.ts currently states that a transaction on tree B never delays
tree A. The bounded option qualifies that liveness statement for unobserved
undeclared origin. The user has authorized the design comparison and requires safe
cross-tree holding, but has not yet selected this false-positive-hold tradeoff.
Approval would select the scope/specification, not implement or activate it and
not clear the remaining certificate, lifecycle and composition qualification gates.
