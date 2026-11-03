# Ordinary occupancy: independent finite transition inventory

Read-only review, 2026-10-22. Production/readiness checkout HEAD `6bd4ee8a`; existing dirty AGENTS.md and performance measurement contract preserved. Rejected slice2 source and its original results remain unchanged. No prototype, runtime edit or new test run.

## Contract basis and notation

P means physically displayed occupancy; O means ordinary occupancy. A key maps to a non-reused lifetime, not merely its payload id. Values, placement/order, selection and key occupancy remain distinct facts. `P(k)=L`, `O(k)=M` can legitimately disagree after inspection. A lifetime may be physically active at a different key from its ordinary key.

Governing records in the readiness checkout:

- `docs/audits/2026-10-17-incumbent-readiness/semantic-transition-execution/README.md:102–108`: approved restoration of ordinary topology within the authored footprint; unrelated inspection remains.
- `.../semantic-transition-plan/README.md:114–120,131–140`: W1 necessary existence; W4 explicit existence; W5 explicit key occupancy, without implicit field/order adoption; W6 removal without adoption of inspected existence; W10 exact lifetime restoration.
- `.../semantic-transition-slice2-prerequisites/REVIEW.md:11–18,38,46–48`: C1–C3 settled, nested missing-parent semantics not implied, inverse support required for admitted slice2 operations, complete-target extension bounded.
- `packages/kernel/src/lib/entity-inspection-egress.spec.ts:10–28`: traversal does not promote neighbors; structural references are not causal dependencies; update adopts necessary inspected existence, removal does not.
- Rejected-source C1–C3 and unchanged rekey-vacancy/active-old refusal witnesses remain the executable acceptance evidence. This inventory does not replace their assertions.

## Finite occupancy cases

The table classifies actual authored operations. Inspection-only operations change P but preserve O; neither exiting write context nor reading a handle is an authored adoption. Actual physical conflict/refusal rules still apply before these cases are admitted.

| Case | Prior physical facts | Prior ordinary facts | Authored footprint / required ordinary consequence | Inverse obligation |
| --- | --- | --- | --- | --- |
| 1 Fresh creation | destination empty | destination empty | New lifetime/value/existence at destination, plus explicit placement intent | Remove precisely the new lifetime; no historical occupant |
| 2 Creation in inspected vacancy (C2) | destination empty; old lifetime inactive | destination belongs to old lifetime | Displace ordinary old occupant, install new lifetime at that key | Restore exact old lifetime/key/value, detach fresh reference |
| 3 Field adoption (C1) | inspected lifetime active at destination | lifetime/destination ordinarily absent | Necessary existence plus only applicable authored value rule | Remove adopted existence on rejection; unrelated inspected rows remain |
| 4 Field adoption of inspected replacement | new inspected lifetime active; old ordinary lifetime inactive | same key still belongs to old lifetime | Necessary existence replaces ordinary occupant; value authorship remains explicit | Remove inspected replacement and restore exact old occupant |
| 5 Ordinary field update | same lifetime active | same lifetime ordinary | Field facts only; no structural or ordering authorship | Restore authored fields without promoting inspected sibling values |
| 6 Rekey to ordinarily vacant destination | source lifetime active; destination empty | source lifetime/key known; destination empty | Move source key occupancy, preserve lifetime; no implicit field/order adoption | Restore source ordinary key, preserve held identity |
| 7 Rekey into inspected vacancy (decisive failure) | B active; A physically empty | B owns source; old A owns destination | Source and destination occupancy both authored; prior old A is displaced | Restore old A at A and B at B; successful omission of old A is invalid |
| 8 Creation at ordinary key whose prior lifetime is displayed elsewhere (secondary failure) | old A lifetime physically at B; A empty | old A still ordinarily at A | A creation displaces old ordinary occupant; physical location B is a distinct installation fact | Restore old lifetime to A without creating a duplicate; do not attempt blind add of an already-active lifetime |
| 9 Rekey of inspected-created lifetime | lifetime active at source | that lifetime absent ordinarily | Necessary existence is required to represent resulting authored occupancy; no incidental neighbor adoption | Restore ordinary absence, not the inspection-only source membership |
| 10 Removal of ordinary lifetime | target lifetime active | target lifetime ordinary, possibly at different key | Remove that exact lifetime's ordinary existence/occupancy; retain inverse facts | Restore exact ordinary lifetime/key and required value, subject to existing admission |
| 11 Removal of inspection-created lifetime (C3) | inspected lifetime active | lifetime absent ordinarily | Ordinary absence remains absence; physical removal still publishes | No inverse existence addition |
| 12 Removal of inspected replacement with a different ordinary occupant | inspected lifetime active at key | different lifetime owns key ordinarily | Removing the inspected subject does not by itself author removal of the other lifetime | Must not resurrect inspected subject or silently erase other ordinary lifetime; actual key-wide APIs require their declared footprint |
| 13 Occupied physical destination | another physical lifetime active at destination | any ordinary occupancy | Existing physical occupied-destination contract governs admission | Refusal must leave state/authority intact; O bookkeeping cannot bypass it |
| 14 Explicit broader replacement / mixed batch | several source/destination facts | corresponding O occupancy can differ per member | Each explicit add/remove/rekey/field/order fact retains its own footprint; earlier staged facts affect later operations | Ordered inverse of admitted facts, preserving identities and unrelated inspection; no deduced ownership from final target diff |

Cases 9 and 12 are discriminating inventory cases derived from necessary-existence versus removal minimality, not newly executed proofs. If an API actually authors key-wide replacement rather than subject removal, classify that explicit operation accordingly; do not choose its meaning from the helper branch it happens to use.

## Active-elsewhere interpretation

For the unchanged minimal witness `ordinary A7; inspection rekey A→B; transaction add fresh A99; reject`, restoring ordinary topology means the old lifetime must be at A. It cannot remain at B while fresh A disappears, nor exist at both keys, nor be replaced by a new lifetime. B is the inspected location of that same affected lifetime; restoring its key is not removal of an unrelated inspected entity. There is no new public semantic decision in that minimal case. Existing output is safe refusal, not silent corruption.

The distinction that must survive preparation is ordinary prior occupancy versus physical installation status: inactive old lifetime needs revival, active-elsewhere old lifetime needs a location transition. This names required facts, not a selected representation or new authority. A later independently authored occupation of A or change to the affected lifetime must still obey existing atomic refusal/retry protections; it is not permission to overwrite newer truth.

No additional value/order behavior follows automatically. A variant with unrelated inspected field changes must preserve the established authored-field boundary rather than copying an entire old row merely to restore a key. The simple active-elsewhere witness has unchanged payload, so it does not need such a decision to adjudicate. Missing nested-parent construction remains outside this inventory's authorized interpretation.

## Required lifecycle checkpoints, independent of representation

1. **Before admission:** identify exact P/O source and destination occupants, including physically inactive and active-elsewhere lifetimes; distinguish absent key from present undefined field; preserve ordinary value/placement obligations separately. A snapshot observed only for validation does not become authored responsibility.
2. **After preparation, before installation:** every authored occupancy displacement and necessary existence change must be represented in the same ordered responsibility facts. Physical application status must be known. Reentry can invalidate preparation; no ordinary index or capture record may be partially installed.
3. **During a multi-operation unit:** subsequent admission must observe earlier staged occupancy changes. A key reused twice cannot independently consume the same pre-unit displaced occupant twice, nor lose an earlier operation because a per-subject slot was overwritten. Existing primitive-operation order and nested checkpoint semantics remain the authority.
4. **After installation:** state, ordinary occupancy, key/lifetime indexes and responsibility agree before callbacks. Inspection chronology and ordinary publication consume that responsibility, not physical-only reconstruction. Native callbacks still report physical changes.
5. **Pending supersession:** retain the facts required for supported rejection/retry. Mere physical displacement does not mean ordinary authority terminated. A newer field-only write does not acquire structural ownership; a genuine structural write does.
6. **Confirmation / committed supersession:** confirmed occupancy becomes surviving truth. Older recovery information must not overwrite it. A completed older transaction remains terminal. Preserve refusal where existing newest-open-first rules require it; do not import arbitrary-order success.
7. **Inverse:** validate the complete admitted footprint against current physical occupants and prior ordinary obligations; lifetime restoration may require revival or relocation. Do not infer inverse authorship by diffing a complete physical target. Preserve existing successor/predecessor placement and occupied-destination checks.
8. **Reclamation:** keep records while ordinary divergence, pending inverse, held-reference semantics or another live obligation needs them. Ordinary-absent plus physically inactive with no live obligation does not by itself justify retaining a divergence record. A held retired reference must stay detached without requiring all retired metadata forever. Destruction has distinct cleanup obligations; no count/GC claim follows from passing identity tests.

## Facts exposed by the rejected implementation

Source anchors in the frozen slice2 candidate: `entity-signal.ts:607–662` prepares O topology, but the destination displaced lookup at640 occurs only for add/adoption, not the rekey branch649–652. Source-key capture and destination-key capture are not interchangeable. The prior `byPhysicalSubject` grouping and raw installed `atKey` lookup must also be challenged against multi-op checkpoints rather than presumed complete.

The secondary inverse refusal comes from `target-transition.ts:679–685`: an add of an already active subject is rejected. That guard is correct for its declared physical instruction; the preceding ordinary occupancy description did not establish an appropriate physical transition. Suppressing the guard would not fix the missing preparation facts.

`entity-ordinary-topology.ts:10–24` and inspection branch622–626 identify a separate cleanup concern: false/absent divergence can survive inspection create/remove even after no divergence remains; clear has no call site. This remains source-only retention risk, not measured growth or a demonstrated general leak. Live old ordinary occupants are legitimate obligations and must not be reclaimed with these obsolete facts.

## Disposition

No new owner semantics are needed to adjudicate the two unchanged minimal failures or to write the above bounded occupancy cases. This does not approve a successor implementation. The account must preserve both complete ordinary responsibility and valid physical realization without duplicating settlement authority. The next design review should challenge that account against cases7/8, staged key reuse and terminal cleanup before runtime work; no mechanism is selected here.
