# Independent equal-display adoption premise review

Owner now explicitly chose adoption with rollback restoring physical and publication truth7. This supersedes the earlier recommendation to preserve the no-op in this particular inspected-different-authority case. Genuine ordinary99->ordinary99 remains a no-op. This is an authorized behavior change, not a deduction from the prior implementation.

Read-only native source inspection; no new runtime changes or execution in this review. The worker's implementation is not yet reviewed.

## Required state distinctions

At the requested boundary, displayed physical value is99, ordinary pre-adoption authority is7, and authored post-adoption value is99. Capture must describe7->99 even though the physical display need not change. Rejecting that contribution restores physical7 and publishes7; inspection cannot be captured as the rollback baseline. A later genuine independent write must remain protected under incumbent settlement rules.

This requires native state/capture responsibility. Per-Link eligible baselines differ (and some trees have no Links), so no connection may privately select the authoritative rollback baseline. Multiple connections must observe the same adopted native contribution and eventual rollback. Adding/removing a Link cannot change whether adoption exists.

## Existing seams and constraints

- Both neutral tree-scalar-leaf-runtime.ts139–146 and native-tree-scalar-leaf-runtime.ts181/192 call the shared tree-scalar-slot-runtime.commitRecorded.
- commitRecorded currently evaluates configured equality against physical storage, checks physical revision for reentry, returns on equality, then prepares terminal records, checks reentry again, and installs storage plus prepared terminal records without user code between them.
- location-runtime.replace/derive and native leaf bindings currently record before from physical read/realized.peek. Merely forcing changed:true in commitRecorded would still give capture99 as baseline instead of7.
- intercept-leaf-signals normal capture, before-publication capture and terminal preparation all ignore mutation.changed:false. owned-mutation likewise suppresses emitted mutation, while intrinsic hooks can observe the false attempt.
- Native leaf binding publishes to its native carrier before ordinary observer delivery; capture runs before publication. Neutral binding reports intrinsic mutation then publishes. Both must receive consistent semantic-before/adoption facts without reordering framework-owned observation timing.

The smallest defensible investigation boundary is native scalar admission/installation plus its mutation facts, where equality, authoritative baseline and prepared terminal responsibility can be coordinated. This is not a prescription to modify the shared slot kernel in one particular way. The mechanism must demonstrate all participating callers receive the correct baseline and must not repair only the Link consumer after capture.

## Deliberate behavior to preserve

- Reads/updater callback input still see displayed99 while inspection is shown; choosing capture-before7 must not silently change the argument supplied to update(v=>...).
- Successful adoption advances responsibility and relevant capture even if value equality suppresses user-visible value notifications. A separate authority change is not permission to force native computed/effect freshness inside grouped writes.
- Inspection itself still changes display without obtaining application ownership or an external-publication contribution.
- Genuine ordinary99->99 remains a no-op with no fabricated transaction effect.
- Authoritative external realization/acquisition of99 remains authoritative even when display already99, and must not be recaptured as an ordinary adoption owned by an ambient transaction.
- Compensation is realization with transaction-rollback provenance, not independent external truth; restoring7 must not poison restoration protection.
- Unsupported aggregate/entity coverage cannot be inferred from a scalar correction. Member absence differs from present undefined; do not silently create membership just because the same scalar value is requested.

## Minimum falsifiers before broader tests

1. No Link exists: ordinary7 -> inspect99 -> transact(y99). Inspection must show an actual contribution; reject restores7. Repeat with two Links attached before/after inspection; rollback and outgoing7 must agree.
2. Confirm adoption: subsequent rollback of earlier work may not erase committed adoption under incumbent overlap rules; ordinary99->99 afterward stays empty/no-op.
3. Two pending transactions: an earlier real write creates7, inspection displays99, later transaction adopts99. Reject later restores7; reject earlier follows unchanged newest-open-first/refusal rules. Do not conflate the earlier speculative authority baseline with committed truth.
4. Later ordinary different write100 after adoption survives or causes established atomic refusal; retry after dependent work settles preserves authority.
5. Repeated inspect99/88 must retain latest ordinary authority7 rather than turning prior inspection display into baseline. An ordinary actual write100 updates authority; later inspection/adoption must capture100.
6. Updater v=>v receives displayed99 yet adoption captures7->99; updater v=>100 remains ordinary changed behavior. Equality function receives its established arguments/order unless a reviewed contract justifies otherwise.
7. Throwing equality before admission leaves physical99, authority7 and no transaction contribution. Throwing preparation likewise installs no adoption. Equality/preparation reentry must preserve reentrant writes or refuse under existing revision guards; never restore a stale snapshot over them.
8. Failed abort after adoption exposes usable recovery under SignalTreeRollbackError contract; successful abort rethrows callback value exactly and restores7.
9. External acquire99 while display99 updates native authority according to its existing semantics; a subsequent ordinary99 call is no longer adoption. Compensation/refusal/inspection must not masquerade as external acquisition.
10. No extra value emission for unchanged displayed99 adoption, but Link responsibility refresh and transaction capture occur; rejection produces coherent7 before publication and native effect timing stays framework-owned.

## Review posture

Owner authorization resolves what successful adoption/rejection must mean. It does not select where ordinary authority is stored, authorize unbounded history retention, or exempt capture from atomicity. Reject mechanisms that keep a Link-local authoritative baseline, run capture after live adoption, reuse inspected display as before, or treat all equal setters as new writes. Source inspection supports a bounded scalar experiment at native admission; correctness remains to be demonstrated by unchanged and discriminating controls.

## First patch review and native facade first failure

Inspected /private/tmp/link-equal-adoption/patch.mjs. The patch introduces a native inspectionBaseline map and semantic-versus-physical change distinction. Neutral callers select readRecordSlot for capture, while physical reads remain display. This is materially closer to the required boundary than a Link-only patch, but native facade implementation must be tested independently.

A read-only source concern was found: the patch uses single String.replace on native-tree-scalar-leaf-runtime before values and commitRecorded declarations, so only the first replace binding is rewritten; derive remains partially old. An independent Solid-facade control was prepared in /private/tmp/link-adoption-native-independent, with the copied patch/helper and loader aliases resolving actual kernel source. It tests direct set and update(v=>v), requires updater input99, and requires rollback7.

First execution with Node24.15.0 FAILED TO BUILD: native-tree-scalar-leaf-runtime generated derive contains both old const changed=kernel.commitRecorded(...) and inserted const changed=resultCommit.changed. Esbuild reports duplicate symbol changed. This is candidate compilation failure, not a semantic runtime failure or framework pass. Full first source and log are preserved; no worker source was edited. Even after syntax correction, derive capture-before must independently be checked because its old physical-before expression is also affected by a single replacement.

## Corrected native source and four-facade replay

Worker corrected both partial native replacements and separated native updater current/display from record-before. Replayed the same Solid set/update controls: both now capture a contribution and rollback7; updater receives99. First compile failure remains frozen as first-patch.mjs/first-build-failure.log.

Then executed actual Angular, Solid, Vue and React facade imports using copied loader/helper/patch, Angular compiler included. Sixteen cases (four facades × no Link/Link × set/update form) pass. Each starts ordinary7, applies inspection99, adopts within transact, asserts one inspected change, rejects, and observes physical7. Updater input remains99. Links initialized with authoritative endpoint7 never send99. Vue update uses its supported value assignment with an updater calculation, not an invented .update method. This is native facade/state/capture evidence; it does not qualify framework computed/effect timing or browser Solid scheduling.

Artifacts /private/tmp/link-adoption-native-independent. SHA256:

- corrected patch.mjs ec6516f9dd48afa1685675c7e465e6cfe16db74a567e689c8095e6b87b88b7d7
- private.ts 87231fb2030d25f3770075809e38fb2497c429bb142f0c0cc0bd65077bcc0dc3
- loader.mjs cce41f1f4960cfe1c13ca47275963f055278a92afc5eb06bea11a320da3156be
- witness.ts 71fddf9b342b414c601f588bedd7e07967ed551f6b5b32972cfb8f129a54835a
- bundle.mjs 44fbe5c7ba29976411ce9abe7bc022d7a530a5ab991370bac17c6e96753a4ee4
- run.log 23c6c492af55b9e59e298f03a983e7ee5bbc77c4d8380892d88e25c23d882959
- frame-fragment.txt 86006a66926bfc71b20123f6960edf1972a9f924e6def005eb36f9795fda39a7

The patch reads frame-fragment.txt from the worker directory at build time; root was warned to archive that exact dependency and adjust replay path rather than claiming patch hash alone is the whole input identity. The saved bundle is immutable and can run directly.

## Atomicity/representation assessment of inspected correction

commitRecorded now distinguishes semantic authority movement from physical movement. Authority equality and physical equality run before terminal preparation and installation; revision checks reject callback reentry. Capture-before is readRecordSlot while ordinary/updater reads remain display. Inspection-baseline map transitions happen only after preparation succeeds. This supports preparation-failure atomicity structurally, but allocation failure inside installation is not universally recoverable: Map writes and terminal record installation remain engine allocations. Do not claim process-level OOM recovery or fault inject arbitrary JS builtins and treat it as the same supported boundary without specification.

Frame installation now prepares per-slot inspection shadow plans, checks source revision and one-use, and updates shadow even if physical value is equal. It retains physical changedSlots separately. This avoids relying solely on changed values to clear shadow authority on realization. Validity against full restoration/structural topology is not established by these scalar checks.

Bounded disposition: corrected set/update native capture and rollback behavior survives these independent controls. Preserve first native compile failure. No production integration, public API activation, entity/general restoration, retained-memory, bundle or full-suite acceptance is claimed by this review.

Final type correction replay: copied patch507c46badb7cbc3541c9c16bd53a430546932f13d744dfaa9c9f14dea5ab087d, whose native publishResult call now supplies an explicit discriminated result. Re-executed all sixteen controls:16/16 pass with identical raw output hash23c6c492af55b9e59e298f03a983e7ee5bbc77c4d8380892d88e25c23d882959. Final bundle hash5dadffd9590020290ab83286773a1ba6761bda89463a08ee1c85a7bc196a6628. Prior patch/output preserved under pre-type-fix names. Typecheck results themselves were not independently rerun by this reviewer.

## Focused native Nx P5 failure: independent causal interpretation

Inspected root's /private/tmp/link-adoption-typecheck/focused-nx.log: unchanged link-authority-carrier.spec.ts P5 fails at235; after acquiring inspection-displayed state and writing ordinary a0, no a0 outbound value is recorded. This is a real compatibility failure, not a test-premise mismatch. I did not rerun Nx in this review pass.

The source route explains it without requiring a new authority representation:

1. Link root accessorsFor calls rootTree.replace(v) (link.ts200), which routes through makeNodeAccessor/recursiveUpdate.
2. Native Link.acquire directly advances that connection's eligible value to incoming INSPECTED.
3. recursiveUpdate signal-tree.ts1149 sees physical current === incoming value and skips the child setter entirely. The newly introduced native slot shadow never receives the authoritative acquisition, so it incorrectly retains prior ordinary a0.
4. Later direct ordinary a0 reaches native slot admission: physical value differs but the stale ordinary shadow equals a0, so semanticChanged is false. Display returns to a0 without the authored publication fact Link needs. Link's existing projection remains INSPECTED and no a0 send occurs.

The old short-circuit assumed physical equality implied no semantic work. The approved adoption rule explicitly invalidates that assumption where an inspection shadow differs. This is an upstream dispatch/admission coverage gap. The scalar representation CAN express the requested transition when entered (the direct facade controls establish that); the evidence does not yet show the representation fundamentally cannot do so.

A bounded correction remains unambiguous: the common recursive ordinary/realized replacement route must not skip authority-sensitive equal inputs before native admission. It must preserve genuine ordinary equality as no-op and must cover root/branch write and authoritative acquisition together. Do not add Link-only shadow clearing, infer authority from value, or change P5's assertion. No implementation proposed by this review.

Before considering recurrence resolved, require unchanged P5 and matched root/branch/leaf controls for ordinary adoption, realized equal acquisition, and ordinary true no-op; include one root transaction adoption/rollback and one branch acquisition followed by ordinary baseline write. If a purported common boundary correction still loses the same authority transition through those supported entry paths, that would satisfy the recurrence/coverage concern. Current evidence identifies a specific bypass rather than requiring a materially different ownership architecture.

## Internal admission query: independent final review

Frozen patchfa397f9f9fbc29db3d10b332627e89b5c21c9321d793102af4d167f87577e107 adds optional needsAuthorityAdmission on the existing writable location binding. The query returns inspectionBaseline.has(slot) for noninspection writes. recursiveUpdate preserves its ordinary reference-equality/ST2003 shortcut only when that query is false. Thus ordinary/realized root and branch replacement reach the same scalar admission boundary when authority differs; inspection remains diagnostic. It is an internal location-runtime export, not a package or adapter SDK export.

Association/lifetime source review: lookup uses the pre-existing WRITABLE_LOCATION_BINDINGS WeakMap keyed by location. The closure captures slotIndex/kernel already owned by the binding's read/write closures. It does not introduce a global strong registry of tree/leaf identities. Nevertheless, one additional per-leaf closure and inspection shadow entries have memory cost. A held leaf can retain its kernel/shadow; this review does not establish destruction reclamation of obsolete shadow values. No GC, heap or postdestroy retention measurement was run, and “no new global strong map” is not a collectibility proof.

Executed native-only controls with ALL private Link/notifier/transaction research transforms disabled:24/24 pass across Angular/Solid/Vue/React × root/branch × ordinary adoption/authoritative equal acquisition/genuine ordinary no-op. Admission query is true while inspected divergence exists and false after adoption/acquisition. Root/branch adoption creates one captured effect and rollback7. Equal acquisition then ordinary7 sends7. Genuine ordinary7->7 creates no effect. This is a shared dispatch test rather than a Link-specific patch test.

Raw records /private/tmp/link-adoption-dispatch-review. First reviewer harness incorrectly used nonexistent t.replace; its error/source is preserved. The corrected harness uses established t.$(...) root replacement. That setup error is not a candidate runtime failure. Final input/result hashes:

- patch fa397f9f9fbc29db3d10b332627e89b5c21c9321d793102af4d167f87577e107
- loader b04b86035d6491b9bcbdd8040aeb7336163b213393ac47157e39432e38a9ffbc
- witness fd91440a70fd28e5b2b77d7f7418cc5799bcf2c983dbb574d8b548a83a7b4b59
- bundle2108eba35bb22aca2a6b3f10939c6f877142aa7d96646778e2cf07fe05a969ef
- run.log df3d3e2076c10097752b9a3293499ab6ac91a5f4665bcc7387ec245cd7abb530

The earlier16 direct facade controls were rerun on the same query patch:16/16 pass; bundle8a14a95c85c658724b1ffbc632c09f078dc526d81c20f2ee97bea2fe7c2e9863. Full native Nx P5 result is separately owned by the root reviewer; these independent controls support the correction but are not substituted for that unchanged test.

Current bounded disposition: no reproduced blocker remains in these point/root/branch scalar admission controls. The unchanged P5 failure is preserved as a real earlier regression. This review does not certify full release, entity lifetime, restoration matrices, resource cleanup or costs.
