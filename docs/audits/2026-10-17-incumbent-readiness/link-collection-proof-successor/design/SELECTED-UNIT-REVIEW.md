# Selected-unit feasibility-to-implementation gate

2026-10-29. Read-only challenge of SELECTED-UNIT-MECHANISM against frozen source `75416029be1e0c1d9735ed3bdc0f4e8e6c02f775` and approved selected/ordinary-footprint contracts. No runtime/tests changed or executed. **Independence limit:** I authored the mechanism inventory; this is a separate source/contract challenge, not independent external certification of my own design. Root should retain its independent final gate.

## Gate conclusion

A bounded private extraction is feasible on the inspected data, **conditional on the concrete preparation representation and discrimination gates below**. No new settlement selector, order policy or second canonical collection store is justified. The current code cannot meet the selected-unit contract by merely deferring capture/notifications; precomputed progressive placement/occupancy and callback-free selection installation are missing capabilities. Runtime should not begin under a claim that these already exist.

No unresolved public outcome was found for the original selected capture falsifier: it explicitly requires complete left/right inverse visible before the callback and protects the callback's newer777. Reentry must remain a separate authored operation, not be folded into the selected inverse or its undo/history unit. The local callback granularity and error-containment constraints are concrete, not discretionary cleanup.

## Callback granularity and sequence: preserve what is promised

- `physical/entity-mutation-frame.ts:260–266` promises one complete frame observed only after every prepared instruction and before publication. `enhancers/restoration/committed-entity-capture.spec.ts` first test observes both rows plus rekey in one callback, not intermediate mutation callbacks. Keep standalone `frame.commit` behavior as a wrapper over extracted phases; do not make it emit one callback per instruction.
- Selected structural plans currently each create a frame and therefore each rich capture, while `__preparePointValues` has per-lifetime invalidate/publish but no rich committed-entity observer call (`entity-signal.ts:511–595`). The extraction must retain the existing structural evidence slices and callback count/order, even if it uses one private placement/value preparation arena per collection. **Do not combine all selected collections into one capture object or invent new rich point callbacks.** Preparation can share final topology while delivery retains its original evidence slices.
- `entity-occupancy-steps.spec.ts` preserves duplicate-key updateMany's three sequential ordinary changes; it expressly says notifier coalescing is not chronology. A combined selected plan must preserve exact selected step identities and cannot net remove/readd or repeated field changes into convenient final snapshots.
- `createMutationCaptureRuntime.publishCommittedEntity` (`mutation-capture-runtime.ts:153–181`) snapshots listeners, contains each failure, reports it and attempts later listeners. Moving delivery after complete selected install must not turn these errors into preparation failures, drop remaining listeners, or alter reported error identity.
- Source publication/minimum responsibility must already be installed before rich capture and invalidation can run user code. Existing helper `entity-signal.ts:1358–1375` finalizes source, commits frame with responsibility, then completes source/membership tap. Selected coordinator must lift those *phases*, not reenter the public mutator later or replay user preparation after installation.
- Public taps/PathNotifier preserve existing relative order: selected publish loops removals, restores, fresh adds, rekeys, live points, then remaining scalar effects (`tree-realization-adapter.ts:1486+`). Preserve this order and first-error containment. Source eligibility must already be coherent; these callbacks are delivery, not a place to infer current authority from displayed physical data.
- Complete selected inverse is a stronger unit than an individual structural frame. Original `committed-entity-selected-unit.spec.ts` requires the first left callback to see restored right11/12. The current left-only view is the preserved defect, not a compatibility promise. After that callback authors777, no delayed old install may still write right11. Later callbacks can legitimately observe777; their frozen evidence remains the earlier installed unit's exact facts, not a reread relabeled as their authored transition.

## Exact selected O footprint

`tree-realization-adapter.ts:1385–1414` already supplies two distinct inputs: selected ordinary effects grouped by owner, and physical execution order. Use these inputs without converting one into the other. `__prepareOrdinaryRealization` produces exact selected changes from ordinary effects (`entity-signal.ts:627–875`). Inspection-only relocation payload, physical helper effects, retirement, or observed neighbors do not become ordinary authored changes.

Required prepared result carries:

1. Source/unit identity and per-step order; completed P placement/value transitions plus separately selected O placement/value transitions.
2. Exact P/O before/after interval/frontier evidence, including ordinary-only and physical-only transitions and field presence.
3. Already-prepared source native/recipient proof edits and minimum transaction/history responsibility records.
4. Per-existing-capture evidence slices, postinstall invalidation plans, and delivery closures. These closures must close over prepared immutable evidence, not rediscover it from current state after reentry.

Incidental placement support is not owned membership/order. A foreign fact is validated/preserved/refused under the existing selector and successor policy; preparing a witness does not expand selected footprint. Pure physical selected logistical plans must not independently publish an ordinary authorship stream before selected O installation. The current publication:'physical' marker suppresses added tombstones only, so its remaining O emissions need explicit audit within this extraction.

## Preparation representation: needed, but not new policy

PreparedRealizationContext (`adapter:160–289`) already handles scoped value/key occupancy and sequential effect dependencies. Keep it. EntityPlacementStage already handles private sparse adjacency. Keep the existing `orderPhysicalPlacements` dependency order and source successor/predecessor fallback. Combine these into one source-owned prospective preparation arena per collection, discarded on failure; do not create a second live representation.

Frame.prepareCommitInstructions currently resolves every restore through live StructuralStore (`frame:416–445`). A list of eagerly prepared single-plan closures is therefore insufficient. Source preparation must resolve each placement against the prospective stage at its established execution step, validate key occupancy/lifetime/backing there, and carry the primitive resolved witness. Reuse/extract the existing resolution algorithm over a read interface; do not replace it with EntityPlacementStage.insert's permissive fallback or a bracket/replay policy.

A restore's predecessor/successor may itself be restored or rekeyed in this unit. Proposed-final-topology dependency ordering and sequential validation remain distinct. Validate removed anchors, occupied destinations and exact lifetimes before any install. No new whole-collection scan for a point footprint is implied; explicit full-order output may process its domain. Fixed work bounds need separate deterministic counters.

## Additional missing capability: active selection

My earlier inventory's phrase “move updateSignals/active selection out of install” was incomplete if interpreted as sufficient. `planPreparedRekey` writes `activeIdSignal` with `replaceLocation` at `entity-signal.ts:1811–1812`. That combines raw value installation and callback-capable native publication. Moving that entire setter to delivery would leave selection's ordinary/raw value stale during earlier complete-unit reads; keeping it inside install violates callback-free installation.

A source-owned prepared replacement for the existing private activeId cell is required: evaluate equality/prepare records/validate raw revision first, raw assignment in unit install, adapter invalidation/observer publication after all unit installs. The private source closure exists in `location-runtime.ts:createCell` and `native-location-realization.ts:createCell`; current ordinary setter does not expose these phases. Do not expose a new public setter/API, use adapter-specific raw-value pokes, or assume token invalidation is harmless. Vue's published carrier in particular may cache separate displayed value until invalidate.

This is a bounded private capability extraction, but it expands the implementation file inventory beyond entity frame/adapter only. It must preserve ordinary setActiveId/clearActive behavior, equality/reentry and the established policy: rekey follows selected lifetime; removal does not implicitly clear selection. If contributor contracts make the new runtime capability mandatory for external adapter authors, stop for compatibility review instead of adding a silent callback-capable fallback.

## Prewritten discriminator matrix (before implementation / no new results)

| ID | Fixture / unchanged control | Required oracle |
| --- | --- | --- |
| S1 | Original `internals/causal-runtime/committed-entity-selected-unit.spec.ts` | First capture sees complete left/right restored values; callback777 survives; exact unchanged assertions. |
| S2 | `enhancers/restoration/committed-entity-capture.spec.ts` | Standalone frame still one complete callback, removal exposes absence rather than retained backing, preparation fault publishes nothing, observer errors contained. |
| S3 | Existing multi-restore/removed-anchor cases; add exact A/B-before-C discriminator only if no equivalent exists | P=C, restoreB beforeC thenA beforeB yieldsABC; proposed witness preparation must not freezeA fallbacktailC. Preserve successor-placement policy. |
| S4 | Existing same-key remove/recreate + occupied destination inverse | Different lifetimes at keya: selected removal vacates before old lifetime restores; unrelated occupied destination refuses atomically with inspectable/retryable authority. No key/lifetime alias. |
| S5 | Existing selected rekey/placement and same-lifetime rekey chain | Correct sequential key occupancy + final placement; old retained references stay lifetime-isolated; no arbitrary new anchor choice. |
| S6 | `enhancers/restoration/paired-ordinary-boundary.spec.ts`; original mixed footprint failures | P-only inspection has unchangedO; O-only adoption unchangedP; selected inverse preserves physical99/ordinary7 and unrelated inspection; capture/history/publication use same selected facts. |
| S7 | `entity-occupancy-steps.spec.ts` + selected transient remove/readd controls | Retain repeated step evidence and same-lifetime later readdition; no netting by business key or final rows. |
| S8 | Preparation fault after one collection/recipient has PREPARED, not installed | Original thrown value; zero outer physical/O/history/proof installation; inner already-authored reentry survives; useful retry after fault removed. This tests supported preparation failure, not universal processOOM. |
| S9 | Equality/source preparation reentry into one touched collection or activeId | Source revision invalidates stale outer plan; no overwrite of newer callback work; unrelated compatible reentry not blanket-refused beyond existing guards. |
| S10 | `internals/causal-runtime/heterogeneous-independent-invalidation.spec.ts` and `heterogeneous-invalidation-containment.spec.ts` | Per-lifetime invalidation still attempted for both rows; scalar publication attempted; first failure preserved; all installed delivery obligations attempted. Do not coalesce rows to defeat the spies/count. |
| S11 | Original `heterogeneous-reentry-publication.spec.ts` + `separate-boundary-contract.spec.ts` | Original/reversed row order and queued/inflight corrective delivery preserve newer field and untouched sibling; no late selected completion overwrites endpoint. |
| S12 | ActiveId selected rekey control in all native realizations | Complete-unit fresh reads observe moved selection and rows coherently; equalselection is genuine no-op; selection callback reentry cannot be overwritten by older install. Ordinary selection API unchanged. |
| S13 | Source/recipient enrollment/disposal during preparation | Stale prepared recipient draft installs neither old payload nor old proof; useful retry; source obligations remain independent of recipient registration. |
| S14 | Indexed local-work/retention controls | Point selected footprint work depends on touched subjects/anchors, not untouchedN; full requested order/output classified separately; discarded prep descriptors released, pending inverse claims retained. No GC claim from counters. |

S3/S4/S5 must reuse exact archived assertions where available; new tests cannot replace them. The original selected rich failure is not classified as passed merely because a new narrower frame test passes. Inspect source/error masks in rejected fixtures rather than declaring success from lack of callbacks.

## Precise implementation ownership/files

A single coordinated structural lane should own these coupled files; source scalar/proof workers must not edit them concurrently:

- `lib/entity-signal.ts`: expose source-private prepared selected collection unit; factor current combined frame helper; carry exact selectedO and per-step evidence; defer signal/selection/capture/delivery phases while retaining ordinary standalone wrapper behavior.
- `lib/physical/entity-mutation-frame.ts`: prepare against supplied prospective placement/value view, cache resolved primitive instructions, expose callback-free install plus existing capture result; retain public-to-internals commit wrapper for unchanged standalone tests.
- `lib/physical/structural-store.ts`: extract restore-placement witness resolution over a prospective read interface and validate occupancy/lifetime against prepared sequence; primitive install consumes checked witnesses. No new topology authority or changed policy.
- `lib/physical/entity-placement-stage.ts`: only any missing checked read/occupancy helper required by the extracted algorithm; preserve sparse patch and no full mirror.
- `lib/internals/causal-runtime/tree-realization-adapter.ts`: gather accepted source plans, prepare/finalize/validate ALL before any install, install all, invalidate all, then existing capture/publication ordering/error containment. Keep selector and selected O effects intact.
- `lib/internals/entity-publication.ts`: bounded source grouping/completion capability for the existing complete selected unit; preserve recipient revision guard and source metadata identity; do not implement a second lifecycle.
- `lib/internals/location-runtime.ts` + `lib/internals/native-location-realization.ts`: narrow prepared backing capability for the existing privately owned activeId cell, with normal setters unchanged. May require coordinated optional private LocationRuntime typing; contributor compatibility gate before a required interface change.
- `lib/internals/mutation-capture-runtime.ts`: no API/type change presently shown necessary. Existing prepared records/contained rich-delivery interface should suffice; edit only if a concrete missing private record field is demonstrated.

Native value-store transition routines are reused. A change there needs an exact future/restored-value input gap, not broad cleanup. Publication lifecycle/private reducer changes remain separately owned collection binding work; they are not to be smuggled into this selected extraction.

## Ambiguities versus mechanical work

**Determined by contract/source:** complete selected P/O before first rich callback; callback-authored later work distinct; exact selected ordinary footprint; frozen successor placement; lifetime/key distinction; per-lifetime invalidation and first-error containment; no observer from uninstalled preparation.

**Implementation details requiring proof, not an owner semantic choice:** shape of prepared source result, prospective stage interface, callback-free selection backing seam, composition of prepared terminal records, reuse of capture slices without changing their count/order, guards/release indexes.

**Stop if reached:** a supported callback demonstrably depends on a different selected invalidation/capture order than the approved complete-unit rule; a fresh/missing ancestor requires new ordinary creation authority; adapter compatibility requires new mandatory public capability; prospective placement needs a different selector/order policy or retained canonical state. Preserve the concrete producer and ask the smallest decision rather than choose convenience. None was established merely by this read-only inventory.

Conditional design gate recommendation: proceed only with the explicit file/phase scope above after root's independent mechanism review, prewrite remaining discriminators, preserve all originals, then start the cheapest focused falsifier. Do not describe this as already-qualified infrastructure for collection proof or retirement.
