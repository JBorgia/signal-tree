# B operation admission experiment — rejected

Baseline: `624f0154ce4456e6ca768b053f0909442c68f3f1`.
This checkpoint preserves a failed bounded candidate, not an integration or API
acceptance. B remains rejected; the qualification CPU/artifact evidence remains
open and was not remeasured. No v15 or public-contract change is selected.

## Mechanism and findings

Order admission now distinguishes exact, front and append intent. Only explicit
subjects create semantic existence dependencies; inverse baseline order and
observed placement remain preparation inputs. Structural capture without explicit
ordering does not author order. Pending contributions compose chronologically;
latent other-owner contributions survive reversible hiding. Same-author exact
replaces prior same-author facts; committed exact supersedes older order intent.
Confirmed dependencies remain while their membership providers are pending.
The combined key/existence solver remains unchanged, deliberately leaving the
creator-payload question unresolved.

The initial annotation-only proposal was rejected before implementation: tagging
full observed arrays with narrower dependencies still commits incidental order.
The implemented helper instead composes intents. This is promising semantic
evidence, but its lifecycle and work shape are not acceptable.

## Preserved first failures and results

Four new discriminators failed on the unchanged baseline: committed partial front
must not commit an earlier pending reorder; independent append preserves only its
placement; a same-author append must retain an earlier exact dependency; reversible
removal must not erase latent ordering obligations. All four pass the candidate.
The first candidate focused run was 28 pass / 1 fail: the unresolved seventh test
failed earlier at ordering. Preparation was corrected to retain observed placement
of surviving subjects omitted from inverse order. The next run was 28 pass / 1
fail, returning to the original payload assertion (`{}` versus creator fields).
This correction does not decide payload semantics.

Root independently ran the audit, prior 13 controls and initial two review controls:
30 pass / 1 unresolved-payload fail. All six established audit failures pass.
The unchanged original rekey/order replay independently passes all four tests.
Review then added a third passing composition/terminality control. The final
six-file run includes the additional terminal counterexample; see EVIDENCE.md.
No assertion was weakened, skipped or reclassified as expected failure.

## Decisive terminal counterexample

Permanent replay: `packages/kernel/src/lib/b-operation-admission-terminal.spec.ts`.

1. Seed A,B,C; pending rekey C to C2.
2. Another transaction explicitly orders C2,A,B and confirms.
3. An ordinary replacement removes C2 and installs B,A. Held C is detached.
4. Reject the pending rekey. It succeeds but changes B,A to A,B.

The new committed exact intent requires no pending memberships. Capture therefore
omits its admission write, but does not delete the obsolete dependency-only
admission. Rollback subsequently projects the old order. Terminal preparation
supports writes/additions at this boundary, not the deletion required here.
Root reproduced the failure independently. Cleanup assertions after the order
failure are not reached. A creator-based variant passes because its pending
append retains the new admission; that control must not substitute for rekey.

## Work and review

`count-admission.mjs` counts Map-constructor input entries for N same-author,
one-subject append admissions. Node 24.15.0 results: 128 -> 8,256;
256 -> 32,896; 512 -> 131,328, exactly N(N+1)/2. Root and independent reviewer
reproduced the counts. This proves quadratic dependency-map construction work in
the helper, not CPU time, retained heap, total allocation or native-store cost.
Source inspection also finds unconditional whole-order snapshots for explicit
capture, including an existing admission. No measured whole-store scan count is
claimed here. Prefix array copying is an additional source finding.

Independent review challenged incidental topology, partial composition, latent
obligations and cleanup. Three public review controls pass. Review found order-only
owners omitted from destruction claim release; the candidate now releases the
union of order and other owners. That correction is source-reviewed only: no
new physical-retention destruction test was executed. Review reproduced the
instrumented counts and inspected the raw rekey failure. Root verified both
by execution. Public nested transactions refuse, so unsupported interleaving was
not invented as an acceptance obligation.

## Disposition

Reject this implementation. The six established failures are addressed in the
focused tests, but terminal admission deletion and admission work violate the
acceptance requirements. No linked-list redesign or broader intrinsic-mutation
change was attempted after these findings. A future experiment would need atomic
admission replacement/deletion and append-efficient responsibility preparation;
this record does not select that repair or alter current semantics.

The seventh payload assertion remains an unresolved contract premise. Rejecting a
creator while an independent rekey survives does not yet define the disposition
of unchanged creator-authored fields. No new answer is inferred from test counts.

Prior 111 controls, framework suites, full suites, typecheck/spec-types, lint,
builds and production performance were not rerun after rejection. Consequently
this record does not claim all existing controls or integration qualification.
The review's first launch failed before executing tests because of a pnpm path
selection; it is an environment invocation failure, not a test failure. No
approval-review rejection occurred during this experiment.
