# Collection binding: concrete revision 2

2026-10-29. Supplements preserved DESIGN-DRAFT-1; this file resolves its ambiguous rules. Runtime75416029 is unchanged. The full production-route authorization permits implementation after the bounded design gate, not public acceptance. No premise-review or mechanism-review verdict is replaced by this revision.

## Unit and evidence identity

Every packet has stable unit identity; every physical/ordinary edit is attached to `(unit, ordinal, lifetime)`. Preserve per-step physical edits alongside ordinary edits and authored tombstones. A single `physical.find(subject)` is prohibited: two edits to the same lifetime in one operation must resolve different step certificates.

A native prepared fact result exposes immutable reference identities, not a catch-all whole-source proof:

- member(lifetime, view), field(lifetime, ownKey, view), keyMapping(lifetime, view), placement(lifetime, view);
- view is physical or ordinary; certificate identity derives from source-issued revision/step, never Object.is;
- before/after presence is explicit; field deletion and present undefined differ;
- touched next facts overlay current facts privately until commit; fact lookup cannot call user code;
- current unit's authored requirement and retained contributors are separate results. Contribution transport does NOT promote D to I; actual instrumented input capture does.

The producer computes this result before recipient preparation, with authored input context frozen at its own admission. Combined point preparation retains each constituent unit's input certificates and declaration horizon; it cannot adopt the first packet's metadata or the context active after preparation ends for every child. No retrospective pending-owner capture at delivery.

## Exact field selection table

The existing egress reducer remains payload authority. Its executed branch returns a contributor disposition alongside each selected value:

| Selected fact | Evidence source |
| --- | --- |
| Existing eligible untouched field | Exact prior recipient contribution reference, even if latest native P/O differs |
| Authored ordinary field replacement/deletion | Source-issued O after-fact for this unit/step/lifetime/key; declaration admission uses this unit's inputs only |
| Adopted field whose value is supplied by that exact O after-fact | The same O after-fact, with its source ownership preserved |
| Untouched field copied from physical row during partial adoption | Exact P certificate for that copied field revision; unavailable if inspection changed that P certificate without ordinary authority |
| Recipient baseline field retained from connection creation | Immutable recipient baseline reference from initialization table below, not the latest source fact |
| Missing certificate / mismatched physical-vs-ordinary view | Explicit unavailable support. It denies early permission; any actual consumption follows the approved fixed-window rule |

The reducer must carry the selection origin from prepared source metadata. It must not search by value equality. Its copying of an untouched field is a projection selection, not itself an application input read. Consequently it can hold the aggregate without making a valid declaration contradictory. If the native writer's updater actually consumed that field, its input claim was captured before callback and separately participates in declaration validation.

Minimal adoption also selects lifetime existence and an eligible placement. Their supporting facts remain structural contributors; they are not certified by the changed field's declaration. Address reconciliation explicitly lists a displaced eligible lifetime, so its membership/proof changes install together.

## Initialization table and scope

Use the A0 baseline rule exactly. Prepare a seed envelope `{payloadSeed, selectedFacts, baselinePermission, nativeRevision, recipientRevision}` in one callback-capable preparation interval. Validate source and enrollment revision afterwards. Do not seed payload now and attach proof later; if validation reenters, retry privately or refuse atomically under existing behavior.

| Seed case | Per-recipient support | Native source effect |
| --- | --- | --- |
| Coherent creation baseline allowed by existing conservative gate; no known foreign support prevents it | Baseline-safe for those adopted facts, including an inspection-only creation baseline; no initial send | None; inspection P certificates stay unavailable |
| Exact selected fact has native pending support | Retain exact support; no declaration over another fact can erase it | None |
| Relevant pending work prevents baseline and matching evidence is unavailable | Unknown recipient baseline, plus any trustworthy preventing support as constraints; no guessed clean source fact | None |
| P payload differs from O fact | P certificate or unavailable for payload; retain separate known structural prerequisites. Never use O7 certificate to certify P99 | None |
| Seed omits a currently supported negative fact | Carry its exclusion/native input support where it constrains that projection; positive enumeration is not a proof of clean absence | None |

Baseline unknown uses the already-approved ordinary fallback contract; unknown is not an unfinished revision. Carried known/possible obligations gate it first; existing tree-local conservative scheduling gates surviving delivery. When first authored work supplies an unavailable actual input, capture its authorship window under the approved rule. Creation itself is not an authored write and must not invent or extend a native window. The baseline must not acquire a later unrelated owner merely because a second connection enrolls. If C1–C14 or baseline controls show these existing rules cannot resolve a supported case, preserve the reproduction rather than selecting a new permission rule.

Incoming acquisition replaces that recipient's baseline through the existing ingress authority: prepare native installation and exact post-apply seed/proof envelope, validate, install and complete together. It does not confirm other native owners. Preparation cannot consume a guessed future snapshot from callbacks run during install. Existing inbound progress and no-echo assertions are acceptance requirements.

## Authored admission versus aggregate proof

Use two separate inputs to existing lifecycle, not one composite NativeRequirement for both:

1. `authoredRequirement`: this installed unit's D and actual I/W/V, captured at the writer. This alone participates in declaration input contradiction checks.
2. `selectedSupport`: exact current recipient contributors after reduction, including untouched old fields and structure. This gates outgoing revision and receipt progress. Its old input roles are NOT new declaration-input claims.

Prepare the operation/receipt with authoredRequirement; after relevant validation finalization, reduce selectedSupport and project its proof onto the same installed fact revision. `projectRevision` must subscribe to contributing blockers without retroactively invalidating the declaration for untouched facts. This distinction prevents both losing q and falsely rejecting an independent p edit.

Own collection and nested collection both use a typed collection contributor subtree. Scalar is a single slot; branch/root composes child subtrees and its ancestor-presence gates. No fake whole-array field overwrite, no omitted own value fact, no back door through source capability.

## Replacement and ordering

Negative contribution dispositions:

- Positive selected lifetime removed: delete its positive value/order contributors; replace selected membership with the authored absence proof.
- Lifetime already absent with a selected exclusion contribution: replace that addressed proof when the operation authors new support, even if payload remains equal.
- Never selected, no selected exclusion: no new recipient value/send merely from another recipient's removal. Native absence still updates independently.
- Same business key/new lifetime: no alias; source and selected occupancy rules determine whether a prior negative is superseded. A fresh row does not change held old lifetime's certificate.

Explicit ordering transports `authoredDomain`, final eligible positions and source-issued order facts. The domain is not inferred from changed indices: same-order support replacement still completes. Omitted latent eligible slots keep prior proof and position. Minimal placement selects the concrete surviving predecessor/successor relation or end-position fact; its semantic existence/placement prerequisite is retained. Intermediate ineligible neighbors traversed to locate it are search witnesses, not automatically dependencies or owned truth.

Key mapping is source evidence for a key-consuming native input or occupancy decision. A rekey does not become a Row[] payload-id write. An unrelated row-field publication need not wait on a storage key only because an implementation iterated keyOf. Require rekey-only, occupied-key adoption and held-lifetime controls before the key domain is qualified.

The current affected-by-row-edit guard is removed as the authority for revision admission. A prepared selection is affected by value, membership, key/placement participation OR support changes. Pure ordinaryOrder and equal payload/different support install a receipt revision and complete it. Physical-only inspection with no eligible support change produces no authored receipt/send.

## Atomic summary/finalization sequence

1. Capture exact writer inputs and prepare source P/O/evidence overlay.
2. Reduce every affected recipient into one private payload+contributor edit plan, resolving certificates by unit/step.
3. Prepare publication and incumbent responsibility records; invoke callback-capable validation; validate source/enrollment revision.
4. Finalize newly acquired windows before installation. If a declaration horizon is still open, install references to that unfinished horizon, denying early delivery until it closes. Never prematurely freeze a derived summary as clean.
5. Callback-free installation applies state, responsibility and source/recipient proof edits. No user callback, getter or rich-capture observer runs between them.
6. Complete units in order. Reentrant later units do not get overwritten by older completion. A horizon/owner outcome refresh recomputes only its indexed contributors and invalidates its summaries; initial summaries do not permanently cache mutable proof state.
7. Publish coherent current revisions. Support-only completion wakes scheduling without forcing public value notifications. Dirty payload and changed proof remain different facts.

Every outgoing route invokes mandatory enforcement while the experiment is enabled. Missing/unfinished proof holds; an installed governed-unknown revision can use surviving fallback after all its obligations discharge. Only declaration admission uses capability support. Absent binding on a supposed enabled source is an invariant error before permissive delivery, not a return to the old evaluator.

## Retention mechanism and limits

Adopt the reader-domain split in RETIREMENT-MECHANISM.md for review: active/recoverable source index; collection absence summary without retired keys; weak lifetime tokens for already-issued held row/field bindings; immutable issued snapshot/ticket proof references. Explicit and automatic forget must use one prepared transfer, not independent deletion hooks.

No drained-W→initialRequirement conversion. Terminal W-only components may compact to terminal uncertainty, preserving unknown and fresh surviving basis without adding later owners. Actual rejected input and validation roles cannot be erased into that certificate. General role compaction is still a private lifecycle design gate; if not supplied, report its exact growth as an unresolved correctness-resource obligation, not “bounded cleanup.”

Current retired-key/lifetime counters may reach zero only by releasing obsolete identity storage while preserving equivalent current evidence elsewhere. Report the summary and weak/captured roots as well; moving an unbounded table does not qualify retention.

## Selected inverse mechanism gate

The current plan.commit performs callback-capable source responsibility/publication preparation and rich capture during each physical structural install; point and selected-O plans follow later. A completion queue alone cannot qualify atomic preparation.

Before selected inverse runtime changes, factor the existing frame boundary into prepared install, post-unit capture and completion phases. The coordinator gathers the exact ordered physical plans plus selected ordinary plans for all collections, prepares source/recipient/responsibility facts before any physical install, validates final topology and revision, then installs the whole selected unit without callbacks. Only after all P/O installs and projection invalidation may rich capture, notification and taps execute in their existing relative order. Callback-authored later writes have separate units and cannot be overwritten by deferred selected work.

This is a required internal phase separation, not a new settlement selector or ordinary-order policy. Source-plan constructors must expose already-prepared mutations rather than build a new frame and callback preparation inside commit. Review the concrete planner inventory before implementation; do not pretend this collection-proof design already supplies the whole-unit factory. A genuinely new planner/authority required by that inventory triggers the architectural boundary.

## Gate disposition sought

Core collection binding is eligible for implementation only once the exact source-step, proof-finalization and lifecycle interfaces are sufficiently specified and independently checked. Full collection qualification requires C1–C14 including retirement and selected inverse. Passing the core may not lift these sibling gates or start broad suites/costs. Public declaration type and installed consumer acceptance remain separate later gates; no assertion changes or API casts may close them.
