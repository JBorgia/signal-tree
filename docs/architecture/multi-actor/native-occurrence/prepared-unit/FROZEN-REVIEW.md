# Frozen prepared-unit independent review

Disposition: **not accepted as complete-operation correction**. Unchanged17 pass; concrete new controls demonstrate two consumer/semantic regressions and a separate private producer-fact violation. No runtime repair made. Scope is the explicit frozen experiment, not production/public API activation.

## Identity and execution

Reviewed source `/private/tmp/st-native-prepared-unit-successor/candidate`, manifest `inspection-boundary-freeze/SOURCE-SHA256.json`, SHA256 `94ac87f1e1c29f8ffdcd0b1041b8da1d9b9c3ed734bac5a8e7e1976b96504a82`. All2930 manifest entries checked before execution and after review. Predecessor manifest verified as well. Root HEAD628d302dadb082a48c58528651c9088234d0a777, branch fix/d1-d2-forward-port; existing dirty work untouched. Runtime diff against predecessor saved as frozen-runtime.diff; hashes in FROZEN-REVIEW-IDENTITIES.json. Read review-contract, contributor contracts and explicit-handoff/prepared-unit contract. No previous reviewer conclusions used as findings.

Unchanged17 replay command:
`python3 /private/tmp/st-prepared-unit-review/replay.py /private/tmp/st-native-prepared-unit-successor/candidate /private/tmp/st-native-prepared-unit-successor/inspection-boundary-freeze/SOURCE-SHA256.json`

Run `run-41kr6lwm`: exit0, **17/17 pass**. Fixture bytes identical to run-y6ouoka9 and current original fixture. Added controls are a separate spec, not weakened original tests.

Additional Nx command in that disposable copy, with pinned Node24.15.0, NX_DAEMON=false/NX_ISOLATE_PLUGINS=false and fresh evidence output: `corepack pnpm nx test kernel --skip-nx-cache independent-prepared-boundary.spec.ts`. First one-case run fails; expanded six-case run **2 pass / 4 fail**. First one-case fixture/log preserved separately; expanded fixture/log preserved. Main's exact six-case snapshot copied from run-_ffeoj9w into main-confirmation/MAIN-SNAPSHOT.spec.ts and byte-compared equal; Main's log and observations copied, corroborating 2/4. Main's reproduction is distinct from my execution.

## 1. Consumer-visible regression: admission omits order work then settles the transaction

`packages/kernel/src/enhancers/transactions/transactions.ts:3779` enters the new path before the existing `orderDeltas.length > 0` target branch at3788. `lib/internals/causal-runtime/tree-realization-adapter.ts:700` qualifies only reversal effects; it receives no order deltas. Its prepared operation at703 installs only selected fields/scalars. `installPreparedCompensation` at transactions.ts3370–3394 marks completion after that subset and frontier bookkeeping. Frontier metadata is not physical order restoration.

Falsifier RUN: rows initially a0,b0; transaction updates a.x7 and setAll reorders surviving rows to b0,a7. Candidate rollback returns successfully with b0,a0, then confirm throws already-rolled-back. Predecessor runs the unchanged one-case fixture successfully and restores a0,b0. Raw field-order.json and first boundary-runtime.log under both run-41kr6lwm and reused run-17t1svy_. This is lost required operation work, not merely structural coverage left unqualified. The branch is reachable and terminally consumes the complete transaction while omitting its order obligation.

Strongest finite next mechanism: make prepared-route admission consume a complete operation description (effects, order/structural work and required frontier changes) and yield either a plan covering that whole operation or explicit inapplicability before preparation. The completion receipt must belong to that complete plan, not to an effects-only projection. Unsupported complete shapes stay on the existing complete-target route. Order work need not be newly implemented in this bounded planner, but it cannot be absent from the admission decision. A one-off order guard repairs this example; an effects-only admission interface still leaves the causal gap. This is operation completeness already required by the selected-unit contract, not a new policy or a request for general structural support.

## 2. Private producer violation: physical images labeled ordinary; no demonstrated borrowing in untouched consumers

`lib/entity-signal.ts:515` prepareSelectedRows seeds and composes physical rows. At574 its physical step.before/after are emitted as packet ordinary and step.ordinary. At2242 absent step.physical is filled using `physical.slice(step.ordinal,step.ordinal+1)`, but physical is grouped by final row whereas steps are ordered edits; this is not an exact per-step pairing for multiple edits on one row.

Falsifier RUN in both orders: ordinary z7, inspection physical z99, selected x/y rollback. Actual subscribed producer packets contain z99 in ordinary before AND after. Both fail expected7. Their aggregate physical rows correctly contain99. The unchanged inspection-adoption controls pass: physical z99 and ordinary support are retained; actual Link output exposes7, and later equal-display adoption rejection restores7.

Consumption trace: experimental-publication/entity.ts63–76 selects ordinary before endpoints from its retained fields map, and restored selection from each edit; egress projection206–215 uses its own retained ordinary row and applies only edit.fields. Link.ts590–600 likewise masks field/row projection. Selected preparePointValues supplies no responsibility capture at this call, so no transaction-before fact is derived from the mislabeled step.before there. Therefore physical step.before alone does NOT prove cross-authority consumption in these nonstructural consumers. The producer fact violation and incorrectly inferred step pairing still require correction; a passing masked consumer is not evidence that the packet is truthful. No universal no-borrow claim follows.

Baseline packet controls hit their one-packet assertion first (predecessor emits two packets). These are successor-specific packet-count failures, not demonstrated baseline ordinary-image defects. Do not count them as matching regressions.

## 3. Public transform semantics regression on reachable synthetic absence transport

`tree-realization-adapter.ts:1863–1879` routes a selected absent-field inverse through row replacement. Excluding whole-row reversal effects at700 does not exclude this transport. `entity-signal.ts:2163–2166` then infers authored fields from a physical value diff plus the selected field. In the ordinary replacement implementation at2174–2176, a replacement has whole authored scope unless derive. Thus an explicit onUpdate transform returning an equal-display sibling is not equivalent to untouched synthetic removal.

Three controls RUN: x initially absent, ordinary z7, inspection z99, transaction adds x7; rollback removes x through row-shaped transport. Public callback runs once.

- Untouched transport: candidate passes, retains ordinary z7/support; later z99 adoption rejects to7. Predecessor FAILS this control: it promotes99/support and later rejects to99. This is inherited synthetic-transport over-admission corrected in94ac, not a candidate regression.
- Explicit replacement `{...patch,z:99}`: candidate removes x and displays99 but retains old z support; later equal-display adoption rejects to7. Predecessor passes: it authors99 with new support and later rejection restores99. Candidate loses explicit public replacement authorship merely because physical display was already99. This is observable public-transform semantics regression on the private selected route, distinct from packet mislabeling.
- Explicit replacement z55: both pass; new support and later rejection restore55. This isolates equal-value narrowing, not generic inability to transform.

Next bounded mechanism: preserve the original semantic edit through interception. Untransformed certified removal lowers only the certified absent field; an actual interceptor replacement keeps its replacement authored scope, including equal values and ordinary-domain removals. Carry that distinction explicitly; do not reconstruct it from physical before/after equality. Validate only the selected field against its certified endpoint. Transformed siblings receive their own ordinary authority, never the selected field's certificate.

## Source-hardening plan disposition

Read `/private/tmp/st-prepared-step-images-plan/PLAN.md` after tracing frozen94ac. Its split provisional intent/completed paired images and source-owned ordered ordinary/physical reduction addresses finding2. Its explicit untouched-removal versus transformed-replacement distinction addresses finding3 and is supported by the replacement code plus above contrast controls. It must additionally integrate complete-operation admission from finding1. No implementation acceptance or new runtime mutation follows from this design review.

Ensure actual step.physical is supplied from the same completed ordinal, not reconstructed by indexing final row aggregates. Seed the ordinary draft from valueStore's ordinary lifetime state; update both drafts using the admitted semantic scope once. Scope must be decided before image composition; generating more accurately named images cannot recover discarded equal-value authorship. The final transition must equal the final paired step for its row. This is existing authority separation, not a requirement to expose private drafts publicly.

## What the passing17 and source trace establish, and limits

For covered top-level selected fields and mixed scalar/field units: public block precedes any selected installation; retry/confirm remain useful; ordered transformed sibling support and untouched inspection support pass; independent reentry write survives refusal; saved/repeated/unused continuations cannot install later; completed installation stays terminal after actual delivery throw.

Source: invocation consumed before projection observer before-read (location-runtime/native-location-realization); outer finally clears request and closes invocation; exact source/subject/field and transformed own-presence/value checks are retained. prepareSelectedOperation stages every included effect, groups by exact source, prepares entity publications and scalar equality before final revision validation, then invokes source-owned install functions before invalidation/publication. completion.committed precedes delivery. Ordinary public replace/derive interceptor paths are unchanged. No ambient selected certificate lookup remains in this changed path.

This does not prove complete-operation coverage (finding1 disproves it), arbitrary private publication plugins cannot throw on install, heap release, all native frameworks, real batching, structural/member routes, or release readiness. Deferred intrinsic observer after-read still occurs during delivery; no frozen per-step native observer image guarantee is claimed from these tests. Public onUpdate and tap behavior is checked only in the represented cases. Real batching and ported inherited cases are being run separately by Main/author and are not counted here. No independent types/full integration/release gates run.

## Preservation / baseline reuse

The baseline-first folder run-17t1svy_ was deliberately reused only as a disposable verified predecessor copy. Original runtime.log, RESULT.json, IDENTITY.json and FIRST-FIXTURE.spec.ts for the initial15 were not replaced. Added FIRST-BOUNDARY.spec.ts (one-case snapshot preserved under candidate run), EXPANDED-BOUNDARY.spec.ts, boundary-runtime.log/observations and absence-runtime.log/absence-observations are separate later evidence; archive includes them explicitly. No baseline runtime source was edited.

The later baseline command included `-t 'certified absence'`, but the Nx runner did not restrict cases: all6 executed, **3 pass / 3 fail**. Passed: order, equal replacement, changed replacement. Failed: untouched transport plus the two successor-specific packet-count assertions. No filtered3-case claim is made. Exact first logs preserved, no retry used to turn a semantic failure green.

Expanded candidate run wrote field-order.json again for the identical case; the first one-case failure remains in boundary-runtime.log and FIRST-BOUNDARY.spec.ts, and the output is unchanged. Other first failure files were not overwritten. Artifact archive contains both logs and all available raw outputs, including Main's snapshot. No runtime edits, external reviewer CLI, or native repair.
