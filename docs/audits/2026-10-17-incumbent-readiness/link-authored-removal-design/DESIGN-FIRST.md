# Authored removal versus ordinary delta: bounded design candidate

2026-10-27. Design only; no runtime or test edits. Rejected runtime f7a0ffd9e2e34a23ceae85bff3cd8fa45ecaa82d is compared with0135ef18567573fec627667fc58bc3e7819cc29e. Production87f6831fa60cafe87508f0ace84b7638698ca3b0 and conservative hold remain unchanged. B stays closed. This review does not resume the broader migration or qualify entity integration.

## Frozen premises

A0 at4ed3b6094404f59b940e601626408dbbadbec588, Authorities:

> The relationship creation baseline stays relationship-relative; it is not a new native ordinary store.

Same A0, source unit:

> It has an immutable identity and sequence, exact authored footprint, separate physical P and ordinary O changes, participation/origin, selected inverse identity when applicable, and an optional prepared publication-support edit.

Same A0, removal/omission:

> Install absence support for the addressed membership/lifetime. Hidden value facts cease contributing to the visible payload but may remain needed by retained storage, history or recovery.

Same A0, selected inverse:

> Realization is not a new independent declaration or ownership engine.

392fcf46bb0cfa2e2a77dd6c4cae36c477331d6f, distinct records:

> Recipient permission/uncertainty | Connection and projection revision | That recipient only; passive enrollment cannot contaminate others

Same contract, retirement:

> Superseding a negative fact retires only its current reference; historical inputs, inverse/recovery and in-flight obligations keep their exact versions.

Dabd8880 obligation rule:

> Known write ownership cannot remove input dependencies or possible-owner obligations. Each obligation needs its own justified discharge.

Owner's latest inspected-input decision is fixed possible-owner hold, captured at authorship; it does not authorize extending inherited windows. That implementation is a separate unresolved obligation, not borrowed here.

## Observable issue and evidence

Unchanged ordinary-order-source-boundaries.spec.ts:58–95: early recipient baseline[A]; inspection-add X; late recipient baseline[A,X]; ordinary remove X. Early recipient emits nothing, late recipient must emit[A]. Same assertions: predecessor all5 pass, f7a0ffd9 two removal variants fail; logs018 and020 in the entity integration archive. Subsequent re-adoption assertions in those failing cases are unexecuted. No new test run in this review.

Frame changes retain explicit tombstone subject/key before installation. prepareOrdinaryTopology emits no O removal when the lifetime was already O-absent. Publication treats P effects as inspection-only, uses only O effects to advance eligible authority, then skips the marked notification. The loss is before delivery. O delta is correct for source state; it is not a complete description of authored publication work.

A0 installation step5 currently says “apply its exact O delta to each relevant relationship”. Read literally in isolation that is insufficient. The source-unit and relationship-baseline clauses plus unchanged tests require interpreting the exact authored transition against the relationship baseline. This document clarifies that implementation rule; it does not change creation-baseline semantics, authorize inspected values, or add transaction contributions for O no-ops.

## Four separate facts, not four canonical stores

| Fact | Meaning | Existing/proposed owner |
| --- | --- | --- |
| P transition | What physically changes, including inspection and realization logistics | Native prepared installation |
| O transition | Ordinary before/after plus selected inverse responsibility | Existing ordinary topology/value owner and incumbent selection |
| Authored semantic footprint | Which addressed facts this unit actually removes or otherwise authors, even when source O has no delta | Native prepared operation, captured before O reduction; ephemeral unit data |
| Recipient projection | That connection's baseline advanced by applicable authored facts | Existing EntityEgressProjection and ticket lifecycle |

No permanent row mirror or second settlement engine. Authored removal carries collection identity, lifetime, guarded key/occupancy identity, source-unit identity and ordinal, participation/realization provenance and the native proof reference. It does not need the inspected payload or historical neighbors to delete a lifetime from a recipient. Existing restoration capture may retain those separately for its own obligation.

## Proposed mechanism

1. Preserve ordered source-step correspondence while preparing the native unit. Each step retains its explicit authorized footprint and the derived O effects generated for that step. Current byStep/changes data is the starting point; no reconstruction from the delivered Row[] or string path.
2. For ordinary authoring, an accepted lifetime tombstone is an authored removal even when its O effect list is empty. Inspection has no authored publication removal. Maintenance forgetting is not a removal operation. Selected realization gets its semantic footprint only from the selected explicit inverse edits; its physical moves/removes used to realize those edits do not independently authorize recipient changes.
3. Prepare ONE ordered publication effect stream from those paired steps. A source O removal already representing the same step/lifetime is emitted once. A semantically authored removal missing from that step's O effects remains in the stream. Keep O-implied displacement/remapping and field/order effects in their established position. Never concatenate all O effects and then all extra removals, deduplicate by business key, or erase remove/re-add transitions across steps. If source-step mapping is absent, stop that path rather than guess order.
4. Each removal applies to the addressed lifetime in the recipient's existing eligible map. Present: remove that lifetime and its slot; absent: no payload change. It never adopts inspected fields, invents membership in source O, removes a replacement lifetime at the same key, or deletes unrelated latent recipient entries. Point row/field recipients use the same lifetime removal and become absent; collection/root/nested projections reduce that same stream, not separate per-connection removal rules.
5. Source native publication support records the addressed authored absence independently of whether O changed. The outgoing removal revision must carry D/I/W/V when applicable, even if O had no value/membership delta. Existing input descriptors must retain negative support without any recipient enrolled. A physical certificate and source O proof are not interchangeable. The removal's proof can constrain a recipient that actually consumes this removal; passive recipients add no source dependency.
6. Recipient payload equality is not support equality. Prepare support/revision completion when evidence changes, even if a projection already lacked the subject or its leaf value was undefined. Preserve public value-event suppression. An unchanged early recipient must not acquire a spurious send solely because another recipient changed; it can still need private proof bookkeeping if its addressed current facts changed.
7. Use the existing admission protocol: privately prepare source and all participating recipient/index records, validate lifetime/revisions after callback-capable work, install admitted state/responsibility/support together, then complete once. Completion and a transport queue do not author new facts. Existing selected units must not be claimed atomic until their already-open rich-capture/preparation gate passes.
8. Preserve installed sequence through reentry. Newer callback operations have new unit identities. Delayed completion of an older remove cannot overwrite a newer re-add/current ticket, and cannot target a fresh lifetime at a reused key. An already-started send may need a later corrective send. Validate aggregate current revision without dropping unrelated sibling changes.
9. Destination transaction ownership gates publication but does not fabricate an O contribution. Confirmation may release a valid removal; rejection uses the existing selected inverse and fresh surviving relationship projection, never confirms the old ticket or revives a receipt. Refusal installs no inverse/support change and retains authority. The source's current absence can survive rejection of an O-neutral physical removal under the approved ordinary-topology rule; do not restore inspection-created membership merely to undo a publication receipt.
10. Retire ephemeral step descriptors after admission/completion consumers finish. Native current negative support, captured inputs, inverse facts and in-flight tickets each retain only their live obligation. Recipient disposal releases only recipient records. Existing bare-churn retention and foreign-W compaction remain separate failed/unqualified gates; no delete-on-forget shortcut or zero-count claim follows from this design.

## Producer/consumer map

| Route | Prepared authority for removal | Boundary to preserve |
| --- | --- | --- |
| removeOne / removeMany | Accepted tombstone steps after interceptors, paired with byStep O effects | Exact lifetime; errors/reentry before install; bulk unit ordering |
| removeWhere | Existing predicate input scope plus selected removeMany steps | Predicate inputs affect proof; nonselected rows are not removed |
| clear | Tombstones of its existing selected active lifetimes | Not a blanket deletion of all latent recipient rows; existing reset/callback semantics stay separate |
| setAll omission / replacement with remove+add | Explicit tombstone/add steps in the existing complete frame | Distinct lifetimes at one key, original step ordering and explicit reorder domain |
| Selected rollback / undo / redo | Selected ordinary realization effects and their ordered realization edits | Never infer authority from physical relocation alone; no new ownership/capture engine |
| Inspection / physical retirement | P-only transition or maintenance | No publication-authored removal; preserve existing obligation-free reclamation authority |
| Entity fields/rows and collection/root/branch Link | Same source semantic stream, interpreted against each baseline | Source O neutrality is not recipient neutrality; no per-source-form exception |
| Whole branch omission / connection reseed | Existing distinct member/ingress semantics | Not recast as every nested entity being individually authored away |

A public remove of a nonexistent row retains its existing error/no-op contract; this design does not manufacture a command to clear a latent recipient row. A full setter's domain is whatever the existing producer authorizes, not a newly invented endpoint-wide replacement. Verify its existing tests before claiming broader removal coverage.

## Alternatives compared on the same falsifier

| Alternative | What it can do | Failure/limitation |
| --- | --- | --- |
| Keep O-delta-only admission | Preserves source ordinary facts | Proven to omit late-recipient removal |
| Re-admit old notifications for O-empty removals | Could reproduce predecessor output | Reintroduces notification-time authority, delayed-order/duplicate admission and recipient-dependent capture; does not fix native absence proof |
| Treat every noninspection physical remove as authoritative | Captures simple forward remove | Selected realization/maintenance can remove physically without owning that semantic footprint; loses selected inverse boundary |
| Replace recipient with source O snapshot | Removes X | Erases legitimate relationship baseline differences and unrelated inspection-adopted fields; broader work |
| Ordered paired semantic footprint | Represents removal without changing source O | Requires exact producer-step map, proof admission and lifecycle verification; no performance/acceptance claim yet |

## Prewritten acceptance boundary (not executed here)

Keep all original assertions; add discriminators without replacing them:

- Existing two collection/nested-branch failures must pass, including later re-adoption assertions and selected-field inverses.
- Same source operation with early/late recipients, root, held row/field, absent eligible lifetime and passive/disposed recipients. Useful correction only where the recipient baseline requires it.
- removeOne/removeMany/removeWhere/clear/setAll omission, with a physically absent but recipient-latent unrelated row: no blanket deletion. Explicit selection determines removal coverage.
- Same-key X1 removal followed by X2 add; held X1 remains detached. Same-lifetime restore/re-add and ordered sequences preserve later authored work. No cross-step normalization by key or final value.
- D(p) removal with I(q)/W(q) holds through p confirmation until q discharges; qualified independent D(p) can progress after p while unrelated q remains. Capture before callbacks and immutable late-owner window remain unchanged.
- O-neutral removal inside p: no invented native undo effect; p confirmation/rejection follows existing source ordinary-topology disposition and fresh surviving publication. Keep inspection/receipt assertions, no assumption that receipt authority is transaction ownership.
- Recipient preparation throws before install: no state/proof/index writes, useful retry. Disposal/enrollment during preparation must obey existing reentry validation, never install a stale draft over reentrant work.
- onRemove reentry, nested declarations, validation-getter errors, queued versus already-started requests, terminal receipts and disposal: preserve original delivery and scalar controls.
- New source support for O-neutral removal must hold a subsequent native snapshot consumer correctly without a Link. Retained negative support must not become independent just because physical lifetime is forgotten.
- Point removal support work follows affected lifetimes/dependencies; no scan of unrelated trees or accumulated operation history. Full collection serialization and genuinely bulk removals remain accounted separately.

Do not fold the inspected-input owner-window correction, inherited selected-rich-capture extraction, four inherited semantic verdicts or retirement compaction into an unreviewed removal patch. They remain independent qualification obligations. This design review can authorize no runtime itself; a successor must explicitly state its gate and preserve f7a0ffd9 and all first failures.
