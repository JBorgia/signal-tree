# Independent premise review: authored removal and ordinary deltas

Read-only review of clean source `f7a0ffd9e2e34a23ceae85bff3cd8fa45ecaa82d` in `/private/tmp/link-entity-obligation-integration`, predecessor `0135ef18567573fec627667fc58bc3e7819cc29e`. Contracts read from readiness `392fcf46`; no previous reviewer verdict used. No tests rerun and no runtime/test edits made. Findings below are source inspection and deduction, not a new execution result.

## Governing premises

The successor SPEC, `docs/audits/2026-10-17-incumbent-readiness/link-membership-successor-contract/SPEC.md` at `392fcf46`, states:

> The native source owns positive and negative membership obligations independently of Link registration.

> Physical inspection display is not ordinary publication authority.

> Held entity reference | Its acquired lifetime; never retarget by reused business key

Its fixed-window instruction is:

> Capture the possible-owner set at authorship. Later unrelated transactions must not extend the hold.

A0 at the same revision states:

> The relationship creation baseline stays relationship-relative; it is not a new native ordinary store.

> Preparation reads are not automatically authored facts or dependencies.

> Existing selection determines inverse units. Reuse their exact ordinary edits and completed order domain; carry support of the realized inputs from existing capture/history where available.

A0's removal row requires absence support for addressed membership/lifetime while preserving support still needed by retained storage/history/recovery. Its relationship-baseline rule adopts the current read including pre-creation inspection, without an initial send or independence declaration. Thus “ordinary delta” cannot be silently redefined to mean every relationship's delta.

## Concrete unchanged observable

`packages/kernel/src/lib/ordinary-order-source-boundaries.spec.ts:58` (byte-unchanged between predecessor and candidate) creates ordinary a, connects B, inspection-adds x, connects A, then ordinarily removes x. Both collection and nested-branch modes require:

- B sends nothing (`:76`), since B never adopted x.
- A publishes only a (`:77`), since its creation baseline adopted x.
- Later inspection recreation/reordering sends neither connection anything (`:80–87`). A later ordinary update of the new x adopts it for both and publishes `[x(10), a(1)]` (`:88–95`).

This is a nonempty publication obligation for one recipient even when the source's O transition is absence-to-absence. It does not authorize adding x to O before removing it. The old and newly created x lifetimes are distinct.

The adjacent selected-inverse test (`:102–132`) requires rollback of a's field write to publish `[a(1)]` for B and `[x(9), a(1)]` for A. It expressly preserves their different baselines. Neither replacing both baselines with the source O snapshot nor copying the full physical state satisfies this test.

## Evidence available before installation

`entity-signal.ts:1130` prepares a frame before commit. A `tombstone-subject` gives subject, literal storage key and restore policy. The frame constructs a structural remove with subject, key, captured backing value and physical neighbors (`:1211–1233`), independent of O eligibility. It also has write metadata, physical placement and O placement, and an installed-unit identity can be allocated before installation (`:1320`, `:2026`). This is enough to distinguish an explicit ordinary removal of lifetime L from merely observing L absent. It does not establish hidden application inputs or a particular publication proof on its own.

`prepareOrdinaryTopology` deliberately emits an O remove only if that lifetime is O-present (`:978–981`). For inspection-only x, its `byPhysicalSubject` group is empty. That emptiness loses the authored target and cannot answer whether A adopted x at connection creation. Inferring “no recipient effect” from it is invalid.

The candidate passes physical frame edits and O edits separately (`:1320–1324`). `entity-egress-projection.ts:184–190` treats every physical edit as inspection/topology-only and only O edits as eligible authority. `link.ts:622` then skips the prior notification route when the packet marker exists. This composition explains the lost removal without requiring a new policy: the reducer has discarded existing ordinary authored removal evidence before applying the recipient-relative operation.

Predecessor `link.ts`'s `applyCollectionNotification` (same function at candidate `:62–94`) distinguishes ordinary authorship from selected realization. Non-selected notifications apply the explicit authored effect under participation. Selected realization first updates latent physical topology, then applies exact selected ordinary entries. This is evidence of the existing distinction, not a proposal to resurrect delivery-time admission.

## Writer differences and limits

| Writer | Existing pre-install facts and boundary |
| --- | --- |
| `removeOne`, `entity-signal.ts:3966` | Resolves one physically present lifetime/key, runs removal interception, stages one tombstone. Emits explicit remove plus separately captured O changes. Missing physical key throws; this is not an arbitrary negative-key setter. |
| `removeMany`, `:4038` | Resolves requested physical rows and their neighbors, runs interceptors, stages a multi-row frame, then emits per-row effects. Shared frame preparation does not make every recipient eligible for every removed row. |
| `clear`, `:4400` | Enumerates current physical active rows and stages the same per-lifetime tombstones. Its comment and implementation expressly preserve the removal/restoration semantics; it also clears active selection. It does not invoke `removeOne`'s removal-interceptor loop. Its physical enumeration is not evidence that all O-only or recipient-only retained rows were authored. |
| `setAll`, `:4503` | Snapshots physical keys/lifetimes; stages removals for omitted physical active rows, replacements for existing incoming rows and fresh adds; validates topology after callbacks. Neighbors are captured for removed rows (`:4635`), and surviving-order changes have separate order authority. O reorder only permutes admitted domain; omitted O lifetimes retain slots (`:1076–1093`). Omitted-key syntax is not blanket permission to wipe every recipient baseline. |
| Selected inverse, `:628` | `prepareOrdinaryRealization` receives selected effects separately from the complete physical effects/target. Its selected remove is explicitly emitted even if O was already absent (`:712`); selected field effects require an O lifetime and a precise top-level footprint (`:766`). Exact selected effects, historical support and disposition remain the authority. A physical removal in a larger realized target is not by itself a freshly authored ordinary removal. |

RemoveOne's exact later-baseline outcome is pinned directly by the unchanged test. The shared structural frame and explicit method semantics support extending the same per-target distinction to removeMany/clear/setAll. The test alone does not settle every bulk corner case, intermediary lifetime, reentrant interceptor outcome, or selected-removal history. A bounded design must enumerate those cases against existing units rather than declaring the methods interchangeable.

## Identity and support invariants

- A removal targets collection/source incarnation plus lifetime, with the addressed key/occupancy retained separately. `physical/structural-store.ts:77,118` allocates increasing subject IDs within a store; numbers alone are not global identity. `entity-signal.ts:3336` documents why a reused key cannot retarget an old held reference. Source-instance identity supplies the necessary scope.
- Storage keys come from source mappings, not payload `id`. Rekey changes mapping; it does not create a new lifetime or authorize unrelated values/order. Removal of an old lifetime must not erase a later lifetime merely because their keys match.
- Authored ordinary removal can advance a recipient that already contains that lifetime without adopting it into a recipient that does not. It needs no public value event when irrelevant, but any installed support/recovery work must still complete.
- Source obligations remain source-owned without recipients. Recipient adoption/uncertainty is separate and cannot establish native O membership, clear other recipients' obligations, or manufacture independent proof.
- Ordinary authored evidence, O deltas, physical effects, and selected inverse identity must remain distinguishable through pre-install preparation, composed installation and private completion. No replay of user callbacks or after-install inference is justified.

## Alternatives and unresolved decisions

Two representations can satisfy the established observable: carry an explicit authored-removal footprint alongside P/O, or carry a general installed operation descriptor from which each relationship derives the same per-lifetime effect. Existing source preparation provides the inputs for either. These are representation alternatives; this review selects neither.

Treating all physical edits as ordinary authority violates inspection and selected-inverse boundaries. Treating all O-empty operations as irrelevant violates the preserved removal test. Replacing recipient baselines with source O violates the selected-field-inverse test. Using recipient membership to rewrite source O reverses the ownership contract.

The existing evidence does not select a new publication policy for unsupported pre-creation history, nonexistent-key removes, O-only rows absent physically during bulk operations, or proof retirement when physical reclamation occurs but negative input/recovery obligations remain. Nor does this test decide whether an omission is certified independent while another owner is pending. The approved fixed-window/native-support rules must govern the already-authorized authored removal; where those rules lack an exact mapping, record the missing premise rather than infer permission from O emptiness or endpoint equality.
