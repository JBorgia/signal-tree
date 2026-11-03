# Concrete selected-unit preparation boundary

This is a source-grounded refinement of Main/Hume's authorized private prepared-operation direction, not an owner-policy question. Public comparison is complete. No runtime edits in this evidence set.

## What must be shared, and what may change

Extract the current updateOnePrivate and replaceOnePrivate user-capable preparation into shared private preparation functions: resolve exact source/lifetime, run public onUpdate/block/transform exactly once, materialize user getters once, validate transformed value/selected field, and return a finite prepared edit plus delivery facts. Ordinary public calls immediately install/publish through their current semantics; selected calls return/queue that prepared edit. No second interceptor pass during install; no interception suppression flag; no calls to raw writeField/store to bypass public callbacks.

Private selected continuation now authorizes one preparation, not one immediate commit. It is consumed before projection observer-before-read and forwards the context through the existing location interceptor/batching chain. A selected private interceptor calling proceed then readTarget sees committed pre-unit truth until installation; throwing then refuses the entire selected unit. This is an explicit change of the unaccepted private lane. Historical tests are archived; useful reentry/no-borrow assertions are ported to the complete-unit boundary. Ordinary public proceed continues its normal immediate write behavior. Public onUpdate remains preinstall, in existing selected effect order, with its original operation arguments and one call per effect; tap/intrinsic/framework delivery follows installation.

No invented public staged-read facade: preparation computations use private row drafts to combine edits; public reads remain canonical committed reads. Add exact tests for row-callable versus projected-field reads during callbacks rather than claiming their caches are identical. Independent nested public writes execute normally. If their source revision/lifetime changes invalidate the prepared unit, refuse selected installation and keep those independent writes; do not reverse them. Old private tests expecting an outer inverse to overwrite such a write cannot establish the new atomic selected contract.

## Finite same-row record; no whole-row support reconstruction

Each source-issued prepared edit records:
- exact source, lifetime, key, field/domain and ordered selection input;
- materialized update delta or replacement payload, own-presence, and the original authored field scope;
- the exact selected field endpoint(s), unchanged sibling support, and per-step ordinary facts;
- frozen before/after observation arguments and delayed delivery work;
- source revision/lifetime validation information and a one-use preparation receipt.

A request-local builder groups by exact source then subject lifetime, with ordered edits. For one row y0 then x0, compose both into a SINGLE final physical row and SINGLE ordinary transition; preserve both endpoint selections. Do not independently prepare two rows from the same original backing, which could make x's plan restore y11. Do not infer sibling authority from the combined row value. Absence comes from the supplied certified field endpoint; own undefined stays present. Each public transform's actual admitted delta is included; transformed siblings need source-issued ordinary support for that authored step, not the inverse field certificate copied across the row.

## Reusable source seams and required changes

entity-signal.ts:preparePointValues:516 already returns install/invalidate/publish and uses valueStore.prepareRealizationTransition with EntityRealizationEdit selections. It does NOT invoke onUpdate and currently emits one row-level tap/publication description. Consequently forwarding raw effects to it is insufficient and would bypass public refusal/transform or flatten step participation. The reusable lower layer must consume the already intercepted ordered edit records, preserve per-step ordinary/publication facts and delivery descriptors, and prepare the final combined row/support/terminal record once. Update the helper's private input contract; do not reconstruct those facts at delivery.

Adapter prepared-point assembly:875–937 already separates collection/scalar installs from invalidation/publication and validates the common revision. Use those phase boundaries for the selected unit AFTER each existing selected write/interceptor continuation has produced its prepared edit. This is an explicit integration in the existing selected route, not an unexplained planner switch to the current interception-free point path.

Complete all user-capable preparation, lifetime/revision checks and terminal-record preparation for every required unit BEFORE any selected installation. Finalize requirements before commit where finalization can fail. The install phase contains only prepared source-owned storage/support/terminal operations; no callback/getter/equality preparation between participating rows. Member/scalar/structural units cannot be silently excluded from unit completion; keep their existing prepared APIs and qualify exact coverage before claiming the bridge handles them.

transactions.ts:installPreparedCompensation:3368 is the terminal receipt pattern: selected accounting chosen before preparation can throw; committed only after the complete unit installs, before delivery. Shared clock advancement by independent writes never supplies the selected completion fact. Refusal retains pending authority and its obligations; completed installation plus delivery error remains terminal. No any-installed/all-installed rule applied to an already partial loop—the loop must no longer partially install before later preparation.

Frame receipt note: the current entity frame caller has responsibility undefined. Generic frame.commit invokes installOrdinary before a separate responsibility install, so a general completion mark belongs after both and before observeCommitted, not universally inside installOrdinary.

## Continuation lifecycle and obligations

One shared explicitly passed invocation record holds clearable value/selection/target. Saved proceed captures only that record, its per-edge forwarding guard and downstream function. Terminal preparation consumes once before user reads; dispatch finally clears authority/value/target, not only a flag. A separate unit builder owns admitted prepared edits until install or abort; close of a per-effect preparation cannot destroy edits still needed by the unit. Unit abort must release all prepared publication/requirement/delivery references; unit success transfers only required history/source obligations and drops temporary records. User-retained operation.value is a distinct owner. No ambient token, global authority index or heap-release claim from counters.

## First implementation gates

- Both public safety permutations: block x after y preparation leaves both selected values/support unrolled-back; removing blocker allows one whole retry. Confirm remains legal after atomic refusal.
- Same-row accepted transforms and multiple fields: callbacks once, getters once, both selected endpoints preserved, sibling support not reauthored.
- Public callback independent writes: preserve them and atomically refuse stale selected preparation.
- Private selected proceed/read/throw: read pre-unit committed target, throw aborts unit, no support installation. Public ordinary equivalent keeps ordinary immediate semantics.
- Hume saved-after-success/throw/twice controls adapted to preparation receipt plus unit installation; no closed continuation can prepare/install later.
- Main getter-reentry controls, certified absence/undefined, lifetime change, synchronous coalesce, outer-scope guard, dedup/order/notifications/detachment; no bypass.
- All-install-then-delivery-throw: full unit remains installed/terminal; preserve original error handling.

Current helper cannot be reused unchanged because it drops per-step callback/publication detail and never invokes public interceptors. That is a concrete implementation gap to close, not grounds to invent a new partial-settlement policy or request an owner decision about private proceed semantics.
