# Selective v15 → v16 integration manifest

Prepared 2026-10-01 by source/history inspection only. V15 published and registry-verified on October 1; integration is now authorized. No integration, test, build, mutation or publication was performed for this manifest. No active validation-clone artifacts were read. No v14 work is included.

## Pinned inputs and scope

- Destination: `/Users/jonathanborgia/code/signaltree`, `628d302dadb082a48c58528651c9088234d0a777` (v16).
- Source: `/private/tmp/signaltree-v15-followups`, `4ceb24a2a62dc893bf28c50ad971a955190539a7` (published v15.4.0).
- Common ancestor: `4ee6b001fe41af77101bb58c90b922f96d2b2873`.
- v16 already selectively carried v15 round-4 runtime through `0faa878d` in `148d57c5`. Therefore the useful donor series is the **15.4 follow-up work after that checkpoint**, especially `cf98697a` and subsequent repairs. A whole branch diff also contains v16 features absent from v15; those apparent deletions are not port instructions.
- File paths below are repository-relative. `K` means `packages/kernel/src`; `E` means `packages/kernel/src/enhancers`; `I` means `packages/kernel/src/lib/internals`; `C` means `packages/kernel/src/lib/internals/causal-runtime`.
- Source differences identify port candidates, not demonstrated v16 runtime failures. All named tests below are existing source fixtures to adapt/run **later**, not results from this audit.
- Do not wholesale merge or cherry-pick the large mixed `cf98697a` commit. Apply conceptual hunks against v16, bring their falsifiers, and retain v16-only tests. Even small donor commits touching transactions/restoration require semantic review.

## Destination contracts that must survive every slice

1. **Public spelling and inspection:** retain `transact()` without a `transaction()` alias; retain `PendingTransaction.inspect()`, `ChangeStatus`, `InspectedChange`, `TransactionInspection`, lossless addresses and entity lifetime identity. Preserve inspection frozen at settlement and inspection on recovery handles. Authorities: `E/transactions/transactions.types.ts`, `K/index.ts`, `E/transactions/transactions.ts` (`decorateHandle`).
2. **Recoverable refusal:** preserve v16 pending authority and the usable `error.recovery.transaction` on eligible failed automatic compensation; preserve `callbackFailed`/`callbackError`, including `throw undefined`. Do not copy v15 automatic-abort record-as-committed/retire/release behavior. Preserve the existing distinction between a reversal refused before application and a consumer error after application. `148d57c5` explicitly preserves this branch difference.
3. **Current truth versus settlement:** retain current-state invalidation independent of transaction settlement, including React `useSyncExternalStore` observation. Preserve `I/owner-invalidation.ts`, `I/entity-egress-projection.ts`, framework realization behavior, and v16 queued/inspection evidence. New read-only readers observe these authorities; they do not become authorities or backend acceptance receipts.
4. **Lossless addressing and chronological evidence:** v16 already carries `subjectFieldSegments` through causal/reversal effects, queued field footprints and `PathNotifier.observeEnqueue`. v15 adds `fieldSegments`, presence and membership facts. Integrate the facts through v16's existing paths; do not delete the enqueue observer/footprint arguments or substitute display-path parsing. This manifest does not select a new internal ownership model or mandate a rename.
5. **Retention:** v16 already defaults to correctness-only retention with optional diagnostic retention. Preserve its inspection/evidence observer demand gating and live-obligation retention. Do not reintroduce v15 behavior merely because a copied fixture assumes it.
6. **Framework and lifetime features:** do not replace v16 adapter, hydration, native-cell, dynamic-field batching or cleanup implementations with older v15 versions. Do not delete tests appearing only on the v16 side of the diff.

Destination regression anchors to retain throughout:

- `E/transactions/recovery-handle-0.spec.ts`, `settlement-inspection-terminality.spec.ts`, `proposal-inspection-0.spec.ts`, `proposal-inspection-safety.spec.ts`, `queued-inspection-review.spec.ts`, `rollback-refusal-scope.spec.ts`, `history-retention-0.spec.ts`, `history-retention-15.spec.ts`, `rekey-supersession-0.spec.ts`, `rekey-occupancy-0.spec.ts`.
- `K/lib/path-notifier-enqueue.spec.ts`, `path-notifier-queued-witness.spec.ts`, `entity-egress-footprint.spec.ts`, `entity-egress-footprint-delivery.spec.ts`, `entity-inspection-egress.spec.ts`, `owner-invalidation.spec.ts`.
- `K/transaction-realization-contract.ts` and framework `transaction-realization.spec.*`; `packages/react/src/pending-turn-realization.spec.tsx`.
- `E/batching/batching-adversarial.spec.ts`, `batching-context-safety.spec.ts`, `batching-detachment.spec.ts`; framework `batching-dynamic-field.spec.ts`.

## Already present or equivalent: retain, do not reapply

| Area | Verified source disposition |
| --- | --- |
| Shared declarations | `packages/kernel/rollup.custom.mjs` is byte-identical between the pinned revisions: one declaration graph for `index`, `adapter`, `internals`, private `_[name]-[hash].d.ts` chunks. Do not reapply the configuration part of `5f6c68ca` or restore root redirects/declaration rewriting. Its new admission fixtures remain useful. |
| React subscription hook | `packages/react/src/use-signal-tree.ts` is byte-identical. Keep it; the dangerous differences are the underlying current-truth/egress paths, not a new hook implementation. |
| Existing write observation | `I/write-observation.ts` differs only in formatting in this comparison. `observeWrites`, scope observation, tree runtime identity, capabilities and confirmed-turn reader already exist. Extend the confirmed projection/admission where needed; do not invent a replacement observation channel. |
| 15.3.1 failure repairs | v16 commits `cf310d6c`, `1c348f23`, `fcc7e7c5`, `4ebf4cc0`, `a45500fc`, `148d57c5` already carried earlier observer isolation, descriptor sparing and narrowed round-3/round-4 fixes with v16-specific adjustments. Keep those adjustments. `error-reporter.ts` changes after `0faa878d` in the donor are documentation corrections, not a new reporting-budget algorithm. |
| V16-specific correctness | Recovery handles, on-demand inspection evidence, queued witness/field footprints, typed addresses and current-truth observation are destination features. Their absence from v15 is not evidence to remove them. |

## Dependency-ordered implementation slices

### 1. Collection-scoped reversal identity and entity field presence — high risk

Donors: selected `cf98697a` correctness hunks plus `f14280ee`.

- Scope prepared realization rows/occupancy to the actual collection node and owner position rather than a bare lifetime number. v16's `PreparedRealizationContext` still indexes subjects by number; different collections can share those numbers. Preserve resolution of literal dotted collection names versus nested names.
- Carry optional entity-field own-presence into effect capture, normalization, reversal/reapply and physical application. An absent property must be deleted on reversal; explicit `undefined` must remain present. Preserve producer-known field coordinates already used by v16 inspection.
- Source: `C/tree-realization-adapter.ts`, `causal-types.ts`, `pending-rollback.ts`, `reversal-planner.ts`, `reapply-planner.ts`, `target-transition.ts`; `E/transactions/transactions.ts`; `E/restoration/restoration.ts`; `K/lib/physical/entity-mutation-frame.ts`; relevant `entity-signal.ts` producers.
- Donor fixtures: `E/restoration/cross-collection-lifetime.spec.ts`, `literal-dotted-collection.spec.ts`, `entity-field-presence.spec.ts`; `E/transactions/typed-entity-address.spec.ts`; `K/lib/lossless-addressing-followup.spec.ts`.
- Later falsifier: two collections both containing lifetime 1, literal dotted keys, absent↔own-undefined, plus v16 inspected addresses before/after supersession. Do not blindly rename v16 `subjectFieldSegments` or drop its queued footprints to accommodate donor `fieldSegments`.

### 2. Reversal application versus observer failure; settlement reentry — high risk

Depends on slice 1's realization changes. Donor: selected `cf98697a`.

- Add identity-based recognition of a failure after a reversal physically applied, so history/transaction bookkeeping reflects the applied state before propagating the observer error. Do not classify by exception-message text.
- Prevent `confirm()`/`rollback()` from settling the same handle another way while its compensation is being applied. Preserve v16 inspection-at-settlement and recovery attachment only while authority genuinely remains pending.
- Source: new `C/post-application-failure.ts`; `C/tree-realization-adapter.ts`, `pending-rollback.ts`; `E/restoration/restoration.ts`; `E/transactions/transactions.ts`.
- Donor fixtures: `E/transactions/rollback-reentry.spec.ts`, `transaction-restoration-coherence.spec.ts`, relevant `K/lib/transaction-observer-failure.spec.ts` cases; `E/restoration/restoration-operation-outcome.spec.ts`.
- Later falsifier: observer throws after successful physical rollback → settled handle/inspection, no false recovery; refusal before physical application → pending authority and valid recovery. Preserve destination recovery and terminality fixtures rather than replacing them with v15 containment expectations.

### 3. Plain branch membership and semantic-scope drains — high risk; adapt, not replace

Donors: membership/scope portions of `cf98697a`, observer-less reachability from `3129e8fc`.

- Capture omitted/present plain members explicitly, preserve chronological membership barriers across descendant writes, restore membership atomically, and keep external membership truth authoritative.
- Drain deferred writes before their semantic scope closes, preserving write context and whole-turn restoration designation.
- Source: new `I/plain-branch-membership.ts`, `I/deferred-write-scope.ts`; `I/source-mutation.ts`, `restoration-eligibility.ts`, `path-observation-port.ts`, `visit-tree.ts`; `K/lib/path-notifier.ts`, `write-context.ts`, `signal-tree.ts`, `utils.ts`; `E/batching/batching.ts`, `batching.types.ts`; selected capture/planner hunks from slices 1–2.
- Donor fixtures: `K/lib/plain-branch-membership.spec.ts`, `branch-omission-correctness.spec.ts`, `path-notifier-membership.spec.ts`, `path-notifier-attribution.spec.ts`; `E/batching/batching-semantic-scopes.spec.ts`; `E/transactions/membership-history-projection.spec.ts`; `E/restoration/pending-membership-admission.spec.ts`.
- Adaptation boundary: v16 batching currently has lazy field interception, disposal ports, drain-all error handling and explicit cross-transaction coalescing checks. The donor changes several of those behaviors. Reconcile each scope test against the destination contract; do not delete dynamic-field interception or silently change failure/drain policy. If requirements conflict, report the concrete conflict rather than selecting new ownership here.
- Preserve enqueue-time evidence while inserting membership barriers. Preserve v16 queued inspection/restoration tests, including `E/restoration/restoration-queued-authority.spec.ts` and `restoration-structured-authority.spec.ts`.

### 4. Committed entity capture, pending overlap and descriptor lifetime — high risk

Depends on slices 1–3. Donor: remaining capture/retention portions of `cf98697a`.

- Bring committed entity mutation evidence into open transaction/restoration capture; preserve pending overlap admission and prevent reentrant ordinary flushes from deleting descriptors still owned by open captures.
- Retain collection routing shells while releasing unclaimed subject details. Preserve correct notification/Link compensation and per-owner/per-subject sequence bookkeeping.
- Source: `I/mutation-capture-runtime.ts`, `K/lib/entity-signal.ts`, `C/tree-realization-adapter.ts`, `E/transactions/transactions.ts`, `E/restoration/restoration.ts`.
- Donor fixtures: `E/transactions/descriptor-retention.spec.ts`, `reentrant-order-bookkeeping.spec.ts`; `E/restoration/committed-entity-capture.spec.ts`, `pending-active-entity.spec.ts`, `pending-overlap.spec.ts`, `pending-overlap-admission.spec.ts`, `entity-membership-capture.spec.ts`; `K/lib/transaction-reentrant-order.spec.ts`.
- Later falsifier: an observer opens/settles another transaction during capture; unrelated rows remain reversible, conflicting rows preserve refusal authority, and compensation still notifies. Evaluate committed capture alongside v16's existing enqueue witness; do not replace inspection evidence with a later coalesced diff.

### 5. Collection order, scale and staging coherence — medium/high risk

Depends on slices 1 and 4; membership delivery tests also depend on slice 6 below. Donors: order hunks of `cf98697a`, `7463f4eb`, `c2f72e6e`, `737e0074`, `cb3de973`, `8fe2664f`.

- Preserve `setAll` survivor order and pre-state removal neighbours through undo/rollback; repair `addMany` redo order. Replace repeated neighbour searches/pairwise permutation checks with bounded indexed work; replace argument spreads that overflow at large counts.
- Stage from one structural traversal, share active-key snapshots and keep `ids()` identity across field-only writes. Keep the final staging-callback correction: observation demand or collection state can change during user callbacks; cached assumptions must not publish stale metadata/order.
- Source: `K/lib/entity-signal.ts`, `K/lib/physical/structural-store.ts`; `C/target-transition.ts`; `E/restoration/restoration.ts`; `I/entity-membership-inventory.ts`, `subject-restoration-claims.ts`; new `I/utilities/append-all.ts`. Apply matching bounded append fixes in `E/devtools/devtools-impl.ts` and existing serialization code where those call sites survive on v16.
- Donor fixtures: `E/restoration/set-all-order-reversal.spec.ts`, `add-many-redo-order.spec.ts`; `K/lib/entity-large-batches.spec.ts`, `entity-set-all-staging.spec.ts`, `entity-ids-identity.spec.ts`; relevant `entity-observation-gate.spec.ts` staging controls; `tools/verify-setall-neighbour-search.mjs`.
- Use the final deterministic neighbour-search guard from `8fe2664f`; do **not** forward-port the intermediate timing-margin relaxations `a2117020`/`36409c42`. Preserve the 130k correctness cases. The work guard detects the repeated-search mechanism, not every possible quadratic implementation.

### 6. Read-only runtime observation producers and API — high risk at lifecycle integration

Depends on the corresponding correctness owners above; entity membership can be implemented alongside slice 5, then validated together. Donors: reader portions of `cf98697a`, `dd45a194`, `3a8451d2`, admission parts of `5f6c68ca`.

| Public internals delta | Source / producer | Donor fixture |
| --- | --- | --- |
| `transactionLifecycleReader` and its snapshot/event/refusal types | New `I/transaction-lifecycle-view.ts`; transitions in `E/transactions/transactions.ts` | `E/transactions/transaction-lifecycle-view.spec.ts` |
| `restorationReader` and lineage/operation/event types | New `I/restoration-reader.ts`; owner transitions in `E/restoration/restoration.ts` | `E/restoration/restoration-reader.spec.ts`, `restoration-operation-outcome.spec.ts` |
| `entityMembershipReader` and membership/event/location types | New `I/entity-membership-view.ts`, `entity-membership-inventory.ts`, `entity-observation.ts`; EntityMap and reversal producer hooks | `K/lib/entity-membership-view.spec.ts`, `entity-membership-producer.spec.ts`; `E/restoration/membership-reversal-delivery.spec.ts`; `K/lib/entity-membership-link-restoration.spec.ts` |
| `linkStateReader` and snapshot/event types | New `I/link-state-view.ts`; `K/lib/link.ts` producer | `K/lib/link-state-view.spec.ts` |
| `stateLocationReader`, target/segment/reader types | New `I/state-location-view.ts`; existing position/lifetime identity and current membership | `K/lib/state-location-view.spec.ts` |
| Confirmed effect `fieldSegments` and `plainBranchMembership` | `I/confirmed-turn-view.ts`, projection in `K/internals.ts` | `E/transactions/confirmed-turn-reader.spec.ts`, `membership-history-projection.spec.ts` |

- Export additive reader symbols through `K/internals.ts`; update v16's API baseline selectively. Keep all v16 public inspection exports and the `transact()` spelling.
- Lifecycle sequence/snapshot capture belongs at the actual state transition before reentrant owner callbacks; listener delivery order remains distinct. A v16 refused automatic compensation must report its **actual retained pending/recovery state**, not v15's commit-on-refusal outcome. `consequencesReleased` must describe the real scope state, not be inferred from a refusal alone.
- Membership events publish after all participating collections have installed, in commit order, including observer-throw/reentry cases. Readers retain no event history and must not install transaction/restoration capability on a bare tree simply to inspect it; membership observation may activate its existing producer on demand.
- State location is strictly current, resolves typed keys/lifetimes without parsing labels, returns no location for absent/dormant targets, and does not descend into opaque leaf payloads. Preserve v16 position/address ownership; do not replace its `observation-substrate.ts` wholesale with v15's allocation/claim logic.
- Type admission: bring `I/tooling-tree.ts` and actual-accumulated-topology admission to the readers/peek helpers as needed, preserving carrier parameters and existing explicit generic callers. Do not reconstruct `TreeNode<T>` from already unwrapped state or weaken admission to arbitrary `object`/`any`.
- Typing/runtime fixtures: `K/tooling-admission.typing.spec.ts`, `packages/vue/src/lib/tooling-admission.spec.ts`, expanded `tools/verify-consumer-typecheck.mjs` fixtures for all eight observation helpers across all five facades. Keep framework imports out of kernel tests to avoid the kernel→Vue→kernel Nx cycle. Shared declaration configuration is already equivalent.

### 7. Link asynchronous settlement — medium/high risk

Depends on slice 3's scope handling and slice 6 for Link reader traces. Donor: Link hunks of `cf98697a`.

- Port the falsifier for `settled()` resolving before a newly queued same-turn asynchronous endpoint write finishes, plus address/lifetime delivery cases.
- Source: `K/lib/link.ts`; observation producer `I/link-state-view.ts` from slice 6.
- Donor fixtures: `K/lib/link-same-turn-settlement.spec.ts`, `link-async-settlement.spec.ts`, `link-address-lifecycle.spec.ts`.
- Preserve destination `link-inflight-settlement-audit.spec.ts`, `link-commit-ordering.spec.ts`, `link-drain-settlement.spec.ts`, `link-structured-address-audit.spec.ts`, `link-value-roundtrip.spec.ts` and current-truth versus deferred consequence separation. Source divergence is substantial; use tests to decide which donor repair remains necessary, not a whole-file replacement. No backend durability claim.

### 8. Atomic registered-terminal reversal — medium/high risk

Depends on slices 1–4. Donor: `2892b650`.

- At capture and admission, distinguish an already registered terminal slot from an object-shaped branch. Keep registered object/array/Date/Map/Set replacements atomic. Preserve external `undefined` provenance for a live terminal; slot registration alone does not prove current liveness.
- Source: `E/transactions/transactions.ts` decomposition, `E/restoration/restoration.ts` decomposition/admission/external truth; existing scalar-slot authority remains the boundary.
- Donor fixtures: `K/lib/opaque-leaf-restoration.spec.ts`, updated `undo-nonscalar-leaf.spec.ts` and `conforming-collection-prototype.spec.ts`; `packages/vue/src/lib/opaque-leaf-restoration.spec.ts`.
- Later falsifiers: both enhancer orders, undo alone/after entity transaction, transaction-only rollback, omitted terminal, external undefined before undo/redo/pending rollback, and atomic refusal with unchanged history. Retain v16 `opaque-terminal-snapshot.spec.ts` and recovery/inspection controls.
- Scope remains replacement, not in-place payload tracking or new deep-copy guarantees. Preserve historical failure evidence with the adjacent closure; do not erase it when adapting tests.

### 9. Demand gating, reclamation and bounded allocation work — medium risk, after semantic slices

Donors: `172a8268`, `115791e1`, `87a6b116`, `97affed3`, `dc8c3e5a`, allocation portions of `03deb906`, `4d3e066b`; selected cleanup `dda146ed`, `2051e605`, `14a06051`.

- Install entity membership production on first demand; avoid notification payload construction and survivor-order work without a consumer. Preserve all v16 consumers: inspection enqueue witnesses, current-truth observation and committed capture count as demand. Demand can arise inside staging callbacks.
- Release reclaimed subjects' activation carriers; preserve the destination's native-cell ownership and cleanup. Do not infer that one successful reclamation probe eliminates every lifetime/retention issue.
- Port ordered confirmed-ledger bookkeeping and skipped immediately discarded records **only after** reconciling v16's correctness-only retention and inspection obligations. Preserve IDs, truncation, readers, open/pending captures, fractional retention, reentry and same-turn designation.
- Preserve restoration raw capture until flush can decide no designation/no retained history/no pending obligation. No enqueue-time skip of ordinary writes; no lazy mutable-payload diff. Then port the unchanged-child shortcut preserving getter read order/once, `===`, and own-presence.
- Source: `K/lib/entity-signal.ts`, `markers/entity-map.ts`, `physical/structural-store.ts`, `physical/entity-value-store.ts`; `E/transactions/transactions.ts`; `E/restoration/restoration.ts`; selected constants/diagnostic guards only after checking v16 callers.
- Donor fixtures: `K/lib/entity-observation-gate.spec.ts`, `entity-projection-allocation.spec.ts`, `entity-where-external-dependency.spec.ts`; `E/transactions/confirmed-ledger-order.spec.ts`, `ordinary-record-materialization.spec.ts`; `E/restoration/ordinary-capture-materialization.spec.ts`, `unchanged-child-capture.spec.ts`; `K/lib/physical/structural-store.spec.ts`, `surviving-messages.spec.ts`.
- `where`/`find` external reactive dependencies (`7463f4eb`) are correctness, and may be ported earlier as an independent entity slice. Keep that fix even if optional performance work is deferred.
- Durable evidence tools to adapt: `tools/verify-setall-neighbour-search.mjs`, `probe-restoration-child-capture.cjs`, the replacement retired-lifetime direct-cleanup/gross-retention tools, `bench-entity-churn-retention.mjs`. Counter proofs establish concrete avoided mechanisms, not universal complexity or end-to-end speedups. Do not transfer benchmark numbers between release lines.
- Delete the unused structural implementation and fold diagnostic guards only if v16 has no surviving consumers of those specific members. Keep test-only integrity checks in specs rather than shipping them. Do not copy the approved v15 budgets to v16 by implication.

### 10. Installed-artifact and harness validation coverage — low/medium risk; after relevant APIs

- Carry selected installed-consumer cases from `tools/fixtures/v15-followup-consumer.mjs`, `runtime-observation-consumer.mjs`, `v15-composition-consumer.mjs` and their runners/registry entries, adapted to v16 spelling and semantics. Review `v15-refusal-lifecycle.mjs` as a **contrast**, not expected v16 behavior: its v15 commit-on-refusal assertions must not become v16 requirements.
- `tools/verify-consumer-typecheck.mjs`: preserve existing v16 negative Link/hydration/inspection coverage while adding all-facade reader topology/nominal-identity cases. Keep strict bundled and node16 consumers. No declaration graph rework needed.
- `tools/bench-history-ownership.mjs` donor `d40aaa0f`: replace finite HEAD dependency copies/shims with complete pinned committed-source staging, unique temporary directories and source identity. Preserve workload/verdict and the wrong-owner mutation. This is harness correctness, not a new perf result.
- Add/adapt registry proofs only for ported capabilities; preserve v16's independent gates. Budget policy, v15 version/release manifests, publication receipts and archived v15 metrics are not forward-port inputs.

## Integration exit conditions (future work, not performed here)

For each slice, first run its adapted donor falsifiers against v16 and preserve initial results; some cases may already pass. Apply only the needed changes, then run the relevant destination anchors listed above. Keep read-only readers subordinate to the actual owners and preserve recovery/current-truth behavior through reentry and errors.

After the selected slices stabilize: run v16's authoritative kernel/framework/source/typing/spec-type/lint gates, then fresh packed strict consumers and API compatibility checks. Schedule heavy/performance work separately. Test only exact built/packed identities and make no v16 performance assertion from v15 measurements. A successful v15 publication is the prerequisite to begin integration, not evidence that any v16 slice is already validated.

This manifest does not authorize publication, decide a new ownership model, restore removed APIs, or convert archived guidance into active instructions.

## Post-manifest donor delta

Published v15.4.0 additionally includes `6e5d9aef`: a first read after permanent
entity removal must not recreate an activation registry entry. Carry its six
regression controls, including actual undo subscriber delivery, with the fix.
The v15 slope estimator was retired after independent Linux validation and
replaced by separate direct-cleanup and gross-retention checks. Its 40 MiB
threshold and runtime measurements are **not** v16 qualification. Adapt useful
direct mechanism proofs only after inspecting v16 reclamation ownership.

The older experimental `transaction-options/current.mjs` intentionally pins
7ade0e3e; do not mistake it for the current integration baseline. The current
supplemental runner selects actual working-tree source and records input hashes.
Record exact IDs/statuses for scalar, structural, composition and authority,
plus the original 13-case suite before production changes and after integration.
