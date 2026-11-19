# Foreign-owner negative metadata retirement audit

Two unresolved drain failures reproduced, not waived. Source settlement retirement is needed in addition to readiness retirement. No runtime implementation was changed. This report proposes a bounded sufficient condition; it is not approval of blanket terminal-owner cleanup.

## Evidence and identity

Used a fresh copy of the frozen recipient-classification candidate, manifest SHA256 c374723071aa1aea781d1b2caf3c13c92d522a4c226831e2fb923a20e5c72147. Both author and copy preserve all 2,971 manifest files (VERIFICATION.json). Read the retirement successor's exact source/patch context and CENSUS-50 entries 15–17; extracted census entries preserved here. Existing neutral reclamation remains intact.

Pinned Node24.15.0/pnpm10.17.0, Nx with NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false:

```sh
corepack pnpm nx test kernel --skip-nx-cache entity-negative-publication-retirement.spec.ts entity-publication-work-lifetime.spec.ts publication-retirement-boundaries.spec.ts publication-retirement-acceptance.spec.ts --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache foreign-retirement-trace.spec.ts --maxWorkers=1
```

Working directory: this report's candidate/. First unchanged run: 2 failed, 22 passed, preserved in unchanged-first.log. The two failures are exactly negativePresence=1 instead of0 after successful confirmation/rejection; preceding pending hold, useful surviving delivery, old row absence and unrelated later-owner preservation pass. Added diagnostic run: 3 passed, trace-first.log and trace-{confirm,rollback,destroy}.json. No failing test was modified. The added test describes current behavior and does not replace the failed drain oracle.

## Exact retained obligations

After removing bare row a while a foreign owner is pending, four of the eight subject maps remain populated: ordinary members, physical visible, mappings, mappingViews. Fields, physical field views and both placement maps are empty. negativePresence=1 and negativeVisible=1 describe one forgotten subject represented in two views, not two independent live rows. Census has two terminal-outcome failures; it does not establish a heap-object count of two.

The ordinary member fact is ready, unknown=true, historicalWindow=true, invalid=false, unavailableInput=false, terminalRejectedRoles=0. D/I/V and aggregate actual owners are empty. Its only possible owner is the original foreign transaction. Before consumption it has zero recipient dependents, so recipient enrollment cannot be a condition for preserving its native negative proof.

After confirm or rollback, the same fact identity and exclusion remain. Its possible OwnerCell is now confirmed or rolled-back, respectively. The consumer has delivered0 on surviving basis, that cell's recipient dependents are zero, and the later owner remains pending unchanged. Source retirementRequests=0 and retireCalls=0. The hold represented by W has expired; terminal history remains in source metadata. This is not an active actual rejected-input obligation in either trace.

The destruction control is materially different: owner source disappearance leaves the captured cell outcome pending, the consumer still held, and one recipient dependent. Removing the source registry/pending-set entry does not settle this cell. Missing registry, empty global pending set, or dependents.size=0 is not a retirement permission.

## Root cause and source boundaries

- internals/entity-publication.ts: requestRetirement/scheduleRetirement keep an exact-subject kernel eligibility callback and queue after synchronous completion. A not-ready requirement gets a readiness subscription. A ready non-neutral requirement cancels the request. There is no source owner-settlement subscription.
- experimental-publication/entity.ts:178–210 snapshots all eight subject entries and their requirements. Its neutral predicate requires no unknown/invalid/unavailable/rejected state and empty owner arrays, without terminal classification. Merely retrying this predicate on settlement still cannot release either failing case.
- experimental-publication/lifecycle.ts: ownerTransition mutates the authentic OwnerCell, schedules owner-map removal and wakes operation channels. Source-native negative facts are not operations and have no corresponding settlement notification. onNativeRequirementReady is about finalized proof readiness, not owner outcomes.
- proof-retirement.ts correctly removes terminal W cells from a *new* compact proof, preserves historicalWindow and unknown, and preserves rejected actual-role bits. The diagnostic compacted proofs have empty W but unknown=true. Compaction alone therefore still fails the existing neutral predicate, and must not mutate issued proofs to make it pass.
- entity-signal.ts:1474 onward requests retirement only after installed forget-lifetime authorization, with `resolveSubjectState(subject)===undefined && !ordinaryTopology.retains(subject)`. Preserve this gate and the installed-completion/error boundary. Absence alone is not authorization.

## Bounded source-owned mechanism

Preserve neutral retirement. Add a second eligible class for discharged fixed-window evidence on an already authorized forgotten subject. Retain the exact-subject request while its relevant authentic OwnerCells are pending, with a private cancellable owner-transition subscription; do not create fake recipient operations. Index subscriptions by captured cell identity, not tree registry scans or fresh pendingOwners snapshots. A settlement event queues only affected requests. A later unrelated owner cannot enlarge the captured obligation set.

Recheck after the synchronous installed completion/reentry frontier, using the existing queue: source alive, exact request identity, kernel forget eligibility, all requirements ready, exact eight-entry snapshots current, and revision consistent. Deduplicate cell subscriptions across a subject's requirements. Rebuild only that subject's subscriptions if its evidence changes; cancel on replacement, loss of eligibility, release or source disposal. Notification must not execute deletion inside ownerTransition or a readiness callback. Use a race-safe subscribe/recheck sequence; settlement between assessment and subscription must not strand a request. Source disappearance cancels/reassesses notification ownership but never invents confirmation.

For the demonstrated W-only cases, the sufficient release class is: no unresolved actual D/I/V, no rejected actual-role bits, no invalid or unavailable proof, all captured possible cells authentically confirmed or successfully rolled-back, and no unfinished validation. Removal's uncertainty must be fixed-window uncertainty, not an arbitrary unknown reason silently discarded. Existing proof fields distinguish roles/outcomes but the aggregate `unknown` boolean does not universally identify its cause after inputs/frames are cleared. Do not implement `all owners terminal => ignore unknown`.

A narrow implementable discriminator can be retained privately at source preparation/finalization, before provenance is discarded: this source fact's only remaining uncertainty is its own fixed possible-owner window, with no other unknown input/validation/origin cause. The bare remove in the two failures has precisely that derivation (no actual owner, no supplied input, no explicit origin/invalid attribution, no open declaration). Preserve that release classification on immutable facts/composites; unknown components not classified as such remain non-releasable. This proves the bounded drain without selecting a broader policy for all historical unknown proofs. The source fact is not thereby certified independent, and the existing recipient-domain exception is not a substitute discriminator.

When eligible, remove the exact subject entries from all eight source maps through the existing retirement boundary and advance both source and retirement revisions. Do not mutate the old requirements, compact existing recovery records in place, confirm old tickets, or erase recipient snapshots. Already-issued consumers keep their original evidence and normal terminal reevaluation; future exact dead-subject queries still use the existing unavailable fallback. Kernel-retained ordinary subjects and pending/recoverable lifetimes remain ineligible, irrespective of terminal foreign W. An actual rejected D/I/V fact is not equivalent to rejected W.

This is narrower than adopting baselineEntityEvidence as a source cleanup rule. That function explicitly grants a relationship-local baseline and may ignore source uncertainty under its own conditions; its output is not source retirement authority.

## Test disposition and required falsifiers for implementation

The original two drain failures must pass unchanged. Preserve the two existing boundary tests asserting exact foreign proof retention after settlement as original historical evidence, but their post-terminal identity/count expectations describe the old deliberately narrow implementation and conflict with the now-requested drain. A successor must explicitly revise those terminal expectations only after classifying their evidence under the new release rule. Preserve their pending proof, exact source, and no-early-release assertions. Do not claim all original retention controls green unchanged.

Required finite controls: two captured owners (one settles, one remains); later unrelated owner excluded; no recipient at settlement; confirm versus successful rejection versus abandoned/unavailable source; actual rejected D/I/V and unknown non-window proof stay; same-key new lifetime; retained recovery/ordinary membership blocks release; old consumer snapshot survives release; prepared reader crossing retirement refuses; completion/observer throw still schedules installed retirement while aborted preparation does not; reentrant replacement cannot delete new facts; destruction cancels subscription inventory; repeated settle is idempotent. Reuse existing neutral tests and raw naive-cleanup early-send falsifier. No broad-tree scan or universal heap claim follows from these controls.

Not run: proposed mechanism, revised expectations, full suite, GC, cost or release gates. No performance figure or universal reclamation claim. All original failures and frozen source remain preserved.
