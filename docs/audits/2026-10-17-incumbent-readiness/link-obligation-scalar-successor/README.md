# Scalar obligation successor: qualification withheld

Frozen candidate: `440ead9f1b4d45c63f7ec8cbf50fc15944f101b2`.
[Independent review](evidence/independent/REVIEW.md), [exact source](evidence/FINAL-SOURCE.md),
and [full evidence](evidence/RESULT.md) preserve this completed experiment.

The authorized role-combination correction passes its original discriminator
matrix, but does not close the scalar gate. Independent review reproduced an
additional false contradiction on confirmed native inputs. Entity integration
has not resumed. Production87f6831f, conservative default and budgets are unchanged.
B remains closed.

## Source and mechanism

Base9f819662775da6a129e4cf7699e5bc5907e5588f contains the original14 tests over
rejected scalarb9eef50de5cdded79792ac043ab99ce03d0144ee. The isolated successor
changes only lifecycle.ts and private.ts plus added regression specs. Runtime
patch59e8d8e61f79df8518fc79afe5c68dad063a96f6bd2bb62721e8081dae648af9
remained unchanged throughout verification. SOURCE.sha256 and006-source-identity.json
identify files; the final commit is recorded in the archive controller.

D destination ownership, I consumed inputs, V validation and W possible-owner
windows now remain distinct through proof combination and projection summaries.
Recipient unknown coverage remains local. A complete declaration avoids a new
unrelated W; an invalidated declaration exposes its original installation window,
without sampling owners that began later. Inherited W is not subtracted because
its identity also appears as D/I/V. Native D becomes I when actually consumed.

## Executed results

| Run | Result | Limit |
| --- | --- | --- |
|001 targeted |20 pass |Original14, root same-identity2 and preparation4; subset of002 |
|002 combined |211 pass,2 fail |Both preserved historical oracle conflicts below |
|003 registration/reentry |2 pass,4 filtered skips |Entity cases not run |
|004 source types |11 TS4111 diagnostics |Unchanged files; not a clean source typecheck |
|005 new validation probe |1 fail |Invalid nested-transaction fixture; original preserved |
|007 corrected probe |1 pass |Later owner opens after callback, before delivery |
|008 spec-types |2 new fixture diagnostics |Private experimental declaration annotation missing |
|011 corrected spec-types |Ratchet passes |No baseline update; not zero historical diagnostics |
|Independent confirmed-input |2 fail on candidate;2 fail on predecessor |No post-throw useful-delivery assertions executed |

002 preserves the previously adjudicated aggregate-installed-publication root
fallback expectation and aggregate-native-input-independent contradiction
expectation as literal failed assertions. No test is relabeled as a pass. Their
contract interpretations remain in the prior scope DESIGN-REVIEW/RUNTIME-REVIEW.

005 attempted a nested transaction in a return-validation getter while p's
callback was active. Existing transaction semantics reject this before the late
callback; optional inspection equality was vacuous. Original probe/log and the
specific fixture correction are archived separately.011 changes only the newly
added review fixture's private experimental TypeScript annotation; its executable
assertions and both first red results are preserved.

## Decisive counterexample and causal finding

1. Transaction p writes source.x=7, then confirms.
2. An unrelated transaction q remains pending.
3. An independent declaration uses a native updater to derive8 from confirmed7.
4. Declaration throws an after-callback contradiction.

Both a same-leaf updater and cross-source updateAndReport input reproduce it.
The governing rule says a source revision's **unsettled D** becomes I; the older
contract requires accounting for **actual pending dependencies**. Confirmed p is
neither. NativeProof promotes all retained owner identities at lifecycle.ts73,
and admission checks those identities against declaration owners at93 and in
prepareRevision without considering confirmed outcome. Retained provenance thus
still constrains a new declaration after that obligation is discharged.

This behavior also occurs on the predecessor. It is an inherited uncovered
qualification defect, not a new regression or evidence of leakage by this patch.
It nevertheless prevents qualifying useful progress under the reviewed rule.
The earlier pending-owner safety and independent-in-p successes remain valid.
Root verified source predicates, frozen premises, raw failures and comparison
hashes independently of the review narrative.

## Stop and limits

No further runtime repair was made after the reviewed false contradiction.
The covered evidence-combination rule still lacks consistent terminal-obligation
handling; adding an outcome-specific exemption without reviewing consumption,
admission, completion and receipt consequences would not close this gate.
Entity work remains separate, as do the known mixed-undo and entity source gaps.
No broad suites, new framework qualification, artifact, CPU, heap, collectibility
or production acceptance is claimed.

Viable next mechanisms are to discharge confirmed input constraints at the
native consumption boundary while retaining required provenance, or to retain
all provenance and derive outstanding obligations consistently for admission and
delivery. Either must distinguish confirmation from rejection/abandonment and
retain W/V semantics. The existing owner-approved policy needs no concession;
recommend reviewing terminal normalization across those boundaries before a
successor, not a cross-tree or same-identity exception.

## Replay

Use Node24.15.0 and pinned pnpm10.17.0. In the frozen successor checkout:

```sh
PATH=/private/tmp/link-membership-pinned-bin:$PATH COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm nx test kernel --skip-nx-cache -- src/lib/publication-confirmed-input-independent.spec.ts
PATH=/private/tmp/link-membership-pinned-bin:$PATH COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm nx test kernel --skip-nx-cache -- src/lib/publication-obligation-combination.spec.ts src/lib/publication-role-overlap-audit.spec.ts src/lib/native-window-preparation-audit.spec.ts src/lib/publication-validation-window-audit.spec.ts
PATH=/private/tmp/link-membership-pinned-bin:$PATH COREPACK_ENABLE_NETWORK=0 node tools/check-spec-types.mjs
```

002-combined-scalar.log records the full unchanged213-case command. The pinned
wrapper delegates to Corepack because Nx child commands otherwise find system
pnpm11. Test-only witness files on predecessor do not change its runtime; the
independent manifests record that comparison precisely.
