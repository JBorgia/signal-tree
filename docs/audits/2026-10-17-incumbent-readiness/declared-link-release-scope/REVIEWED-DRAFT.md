# Declared Link: two finite scopes

2026-10-26. Decision packet, not runtime authorization. Starting documentation checkpoint: `cebfcd4ae050403452c3dda1e4373a27331d9ab9`. Production source: `87f6831fa60cafe87508f0ace84b7638698ca3b0`. Rejected integration: `f01ed39a7df8a5de185ebec0773e09e36537dacb`. B is closed. The recurrence stop remains active under both alternatives until an explicitly selected scope clears its stated gates.

## The product difference

| | A — expand admission/completion | B — defer declared early publication |
| --- | --- | --- |
| Release promise | Supported, complete application declarations can let eligible writes progress while unrelated transactions remain pending | Automatic Link retains conservative settlement hold; same-tree unrelated pending work can delay outbound synchronization |
| Application responsibility | Declare hidden inputs completely; declarations do not prove arbitrary causality | Decide when to settle proposals or use an explicitly separate review/workflow; no automatic independence promise |
| Useful case | Independent telemetry/edit writes can progress on the same live speculative tree through a qualified declaration | Ordinary synchronization remains useful before proposals and after settlement; isolated review keeps proposals off the synchronized live tree |
| Lost/deferred capability | None of the approved conditional-progress requirement may be silently dropped | Conditional declared progress is deliberately unmet for this release; its original tests stay unmet capability evidence |
| API | Existing experimentally approved declaration surface, subject to qualification; no new override/menu | Do not ship the unaccepted declaration API or its experimental implementation; preserve the current production public surface |
| Additional engineering | Membership-aware admission, projection-support replacement, completion without public events, plus full composition and lifecycle qualification | Document and test the narrower Link guarantee; qualify ordinary Link and the remaining production requirements |
| Not implied | A design/model passing does not accept runtime or cost | Deferring Link does not make production release-ready or waive inspection adoption, restoration, recovery, publication, types or budgets |

The owner previously declined conservative-only independence scope, then permitted conditional progress through complete application declarations. B therefore needs a new explicit product decision. Neither sunk work nor a failed experiment grants it. A likewise needs explicit architectural scope approval; the original entity migration does not authorize every native writer or a new publication-support mechanism.

## Common obligations neither choice removes

- Native state and incumbent settlement remain authoritative. Publication dependencies do not change transaction ownership or rollback semantics. No B revival, canonical mirror or second settlement engine.
- Fresh SignalTree reads; native computed/effect scheduling remains framework-owned. Coherent membership/order and ordinary/physical separation remain required.
- Atomic retryable refusal, retained pending authority, usable failed-abort recovery and first-error semantics remain. Surviving ordinary writes are not retroactively erased because their input was once speculative.
- Approved inspection adoption and authored-footprint inversion remain separate public decisions. Deferring declarations alone does **not** defer them. Production87 does not implement all of the experimentally tested adoption rules. A release under B must implement/qualify those rules or obtain a separate, explicit owner decision identifying exactly which are deferred.
- New-key behavior and the applied string-Record typing migration remain. No deferred-handle or lookup API is introduced.
- Original failures, exact source identities and assertion text remain. Stronger arbitrary-order/canonical-authority targets stay distinct from supported newest-open-first behavior.

This common work is material: complete-operation ordinary/physical consistency may still need repair even without declared early publication. B avoids the additional conditional-publication mechanism, not every remaining shared-transition obligation.

## A: concrete internal design to approve or decline

The proposed unit is **one installed semantic transition**, not a callback, transaction or final public notification. It names actual authored value/presence/key/order facts, separate physical and ordinary views, source identity and participation, prepared revision, publication evidence and completion identity. Outer operations may install several such units and partially fail. Nested operations remain distinct. Existing transaction/history selection continues to decide inverse authority.

### What changes and what stays

| Concern | Existing machinery retained | Replacement/addition required |
| --- | --- | --- |
| Membership admission | Native descriptors/slots, existing responsibility plans and writer equality/updater semantics | Replace value-change-only admission criterion with value **or membership** work. Prepare actual path changes before installation, including equal retained-value re-add; install evidence before callbacks/publication |
| Optional delivery | Nullable private path-observation port and existing native notify protocol | Enrich private capture plans with installed-unit identity/deltas and completion; no new public notification family or runtime framework API |
| Projection | Each Link's current eligible projection and creation baseline; native source-shape reducers | Replace late physical after-image attribution and unrelated latest-fact fallback with exact installed facts applied to that relationship |
| Eligibility | Immutable dependency identities, declaration validation horizons, conservative unknown handling | Replace one-fact-per-connection supersession as the entire payload proof with explicit retained publication support for each relevant source fact |
| Completion | Existing consequence scheduler, serialized sends, error reporting and settled waiters | Register pending projection work at admission; complete it even without a public event; wake/schedule through the same consequence path, including when no held send already exists |
| Lifetime | Existing connection/tree disposal and owner terminal lifecycle | Add affected-source index and support-record retirement to those lifetimes; remove obsolete facts/payload references rather than keeping an operation history |

This replaces experimental late annotation, revision-wide completion and whole-payload latest-ticket assumptions. It does not replace native current state, incumbent compensation, Link's relationship baseline, or public notification chronology. Reuse must remove the replaced experimental path from the selected candidate, not layer a second evaluator over it.

### Publication-support rule that must be specified before implementation

Candidate representation: a connection-local support map over **native semantic facts** (leaf value, literal member presence, entity lifetime/key/field, explicit order), containing dependency/validation identities, not another copy of canonical values. Queued immutable deltas and the existing eligible projection carry values. Installed-unit identity links them. This is a proposed new representation, not an accepted API or demonstrated implementation.

Its transfer table must obey all of these rules together:

1. Authored replacement changes support only for the exact facts it replaces. A field edit does not own sibling values, ancestor membership or incidental order. A complete source replacement may retire support within its complete authorized footprint; equal payload bytes alone cannot establish replacement.
2. A projected payload remains held if any **still-required** fact has unresolved publication dependencies or validation. A later independent sibling write cannot authorize an earlier dependent field. Conversely, an independent replacement of that field must retire its obsolete value support and make useful progress while genuinely unrelated owners remain pending.
3. Presence and value are separate. Omission masks/removes the corresponding output; re-add uses newly installed authoritative facts. A value overwrite cannot silently discard an unresolved existence/lifetime requirement. Same-key replacement uses the new lifetime; old references never retarget it.
4. Inspection affects physical display only, except through separately approved explicit adoption. No delayed physical snapshot supplies ordinary facts. A newly created Link adopts its creation baseline; it does not inherit prior operation tickets.
5. Rejection invalidates prior speculative publication evidence. Native surviving/reversal facts update the ordinary projection under existing settlement rules; terminal outcome alone cannot grant a captured speculative payload. Successful confirmation discharges only the relevant dependency. A receipt can be terminal while separate support still serves a live publication obligation; receipt terminality cannot be reversed by cleanup.
6. Installed units are admitted before reentry; completion may drain only installed chronological prefixes. Later outer completion cannot overwrite nested work. Net-zero public summaries still retire or advance private responsibility without manufactured value notifications.

The exact support transfer/retirement table is a required design deliverable, not left to implementation convenience. In particular, define ordinary overwrite under a still-pending ancestor/lifetime, subset ordering, and restoration reintroducing hidden facts. If existing decisions do not determine one of these outcomes, record that specific owner question before native work. Do not infer it from whichever map representation is easier.

### Additional writer footprint

Explicitly add neutral scalar commit, native scalar replace/derive, the structural-write membership shortcut, whole-branch path reactivation, entity path reactivation and prepared plain-member restoration to the existing entity six-path/eleven-family map. Preparation must trigger independently of scalar equality. Keep the established native capture ordering and membership-before-value announcements. No blanket early call to `reactivatePathOnWrite`: it currently requires the supplied value to be installed first. Separate planning from installation without moving user callbacks across their contracts.

### Acceptance boundary for A

| Gate | Required deliverable; failure consequence |
| --- | --- |
| A0 — design only | Complete writer/consumer and support-transfer tables, explicit replacement/removal list, source mapping for completion/waiters; independent premise and interpretation review. No unfilled lifecycle row can be borrowed from later work. Failure stops before runtime |
| A1 — finite falsifier experiment | Keep original compound-undo and leaf-Link tests unchanged. Execute equal-value re-add vs genuine no-op; nested independent/dependent payload vs complete overwrite; net-zero event with useful settlement; fault-before-install; partial sibling failure; reentry; connection creation/disposal. Require actual payloads, authority, receipts, ordering and waiter completion. A private hold alone cannot pass a progress case |
| A2 — combined scope | All mapped native writers, four-framework timing, inspection/adoption, restoration/redo, entities/order/held references, multiowner/multiconnection, validation throws, in-flight correction and teardown. Verify removal of replaced path and no silent fallback; review independently |
| A3 — qualification and costs | Freeze exact source, run applicable Nx/kernel/framework, types/spec-types/lint/docs/installed-artifact/demo gates and supported semantic matrix. Reconcile each changed verdict. Then preregister matched measurements and acceptance thresholds before samples; budgets stay unchanged |

Fixed-local operations and cleanup must not visit unrelated trees/collections; complete requested snapshots/full reorder can process their output. Track affected facts, bindings, support records, queued deltas and payload retention separately. No prefix copying, no accumulating retired metadata, no unbounded receipt→tree retention. Report bundle, fixed/populated heap, pending ownership, construction/churn, cleanup and timing uncertainty separately. Exact production87 and incumbent8d are separate controls; non-equivalent adoption/progress workloads are capability comparisons, not speed comparisons.

This is one gated successor, not standing authorization for rolling repairs. Recurrence in an already-covered path, support requiring a second state authority, new public semantics/API, unrelated-writer expansion, or a work/retention constraint that cannot be met ends the experiment with an explicit disposition. Unmigrated paths within the selected map remain ordinary investigation work. Budgets or timing thresholds cannot be relaxed to continue.

## B: concrete release scope to approve or decline

The changed promise would read: **automatic Link conservatively defers outbound synchronization while relevant tree settlement scopes remain pending; a write to an unrelated location does not guarantee independent progress. Declared early publication is not a v16 capability.** Exact wording must follow the actual consequence-scope behavior; do not imply that unrelated trees, authoritative incoming traffic or all application work are globally blocked.

Live speculative proposals remain available; the limitation is outbound progress. Publish prominently how pending confirmation, rejection and retry affect synchronization, what `settled()` waits for, and the distinction between local settlement and remote acknowledgement. Do not rename the limitation “independence” or remove its historical failures.

No production rollback/revert of f01 is needed: it was not integrated. Start from production87 plus the already-saved type/docs changes, not a disabled copy of the rejected runtime. Keep experimental source/evidence archived and out of the production artifact. Isolated draft adoption examples remain optional and narrowly qualified. The process-local outbox remains experimental; no durable recovery, receiver deduplication, arbitrary entity merge or four-framework app qualification is claimed.

| Gate | Required deliverable; failure consequence |
| --- | --- |
| B0 — owner contract | Explicitly defer conditional declared progress; document only that scope change. Inventory independently approved adoption/rollback requirements; no implicit waiver. Without this decision the existing progress blocker remains |
| B1 — production behavior | Unchanged conservative safety/leakage, useful post-settlement publication, inbound progress, failure/retry, queued/in-flight correction, inspection isolation, reentry and teardown tests. Preserve ordinary Link absence and restoration controls. Neither indefinite hold after obligations end nor stale output is an accepted limitation |
| B2 — remaining readiness | Disposition/implement independent adoption and other supported requirements, classify semantic matrix against the chosen scope, and verify exact public API/type/docs migration. Unsafe states, lost authority and incoherent publication remain defects |
| B3 — release qualification | Freeze actual candidate, exact-SHA kernel/framework/type/lint/docs/installed artifacts/demo and cost gates. Existing evidence is reusable only for its exact source and obligation. Fresh source changes require fresh relevant evidence |

Deferral carries no demonstrated runtime or byte improvement versus production87: that runtime already lacks the experimental machinery. Its benefit is avoiding the additional mechanism in this release. It shifts burden to applications that need independent publication while showing live proposals. It does not make draft/outbox capabilities equivalent or their costs comparable.

## Evidence limits and decision

The earlier leaf timeout and compound-undo production differentials were executed on f01/production87 and remain preserved. The most recent equal-value preparation, mixed-authorship and no-event scheduling gaps were established by source/test inspection; this comparison does not promote them to newly executed reproductions. No tests, models, runtime patch, builds or benchmarks ran for this comparison.

The rejected candidate's 79/84 gates, 66 kernel failures and four budget failures belong to f01. They neither measure the proposed A mechanism nor establish those same failures on production87. Current production readiness has its own recorded obligations and artifact blockers; no ceiling or previous approval is transferred between them. The support map's CPU, memory and bundle costs are unknown. No dates, effort estimates or performance ranking are inferred from source size or old prototype timings.

**Selection criterion:** choose A only if conditional same-tree progress remains a v16 release requirement worth the additional native-writer and support-lifecycle qualification. Choose B only if deferring that capability is acceptable to users, with the limitation and remaining adoption work explicit. A failure does not automatically select B; B being narrower does not make it safe to release.

This packet asks for a scope selection, not implementation permission by implication. A can first be authorized through A0 only; A1 requires the exact completed design and its acceptance controls. B authorizes a product-contract/readiness revision, not release. No activation, API expansion, budget increase, merge, push, tag or publication follows either choice.
