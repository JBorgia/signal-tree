# Refused construction: causal disposition and bounded correction proposal

This is a source-grounded proposal for review, not a reviewed implementation or a runtime edit. The original zero-growth assertion and all original occurrence assertions remain unchanged.

## Demonstrated defect and ownership

`runs/final-independent`: 17 pass / 1 fail. Three refused a-member preparations leave scalar slotCount 3, expected0. `C0/runs/preinstall-slots` reproduces the same assertion unchanged. Thus Helm did not introduce the allocation defect. It is not merely a fixture mismatch: the kernel owns strong values/equalities arrays and position-to-slot map entries, and the leaf runtime owns publication bindings and position-to-leaf entries for children which never installed. Lack of observer delivery does not release those references.

Exact path:

1. `signal-tree.ts:943` prepares descriptions, correctly delaying allocation during description traversal.
2. `signal-tree.ts:1044` invokes buildAddition before installPreparedMember.
3. Builder at1565 calls createSignalStore using the live tree scalar runtime and materialization context, then prepares responsibility.
4. `tree-scalar-leaf-runtime.ts:199` calls kernel.createSlot; lines207–209 immediately bind publication and position→leaf. Native counterpart `native-tree-scalar-leaf-runtime.ts:378` has the same live allocation pattern.
5. `tree-scalar-slot-runtime.ts:createSlot` appends initial value/equality and publishes position→slot immediately. slotCount is actual values.length, not a diagnostic constant.
6. `materialize-markers.ts:800` calls the membership preparer before physical membership, terminal-record installation and observation inheritance. That preparer can throw. There is no exact allocation cancellation spanning the build and this call. Responsibility preparation itself also lies after allocation and needs the same ownership treatment.

The new Helm comment at signal-tree.ts:970 (“No slot ... until a member is actually installed”) holds for description preparation only, not this reached build→membership-preparation interval. The first failure contradicts the broader claim.

The diagnostic shows the difference: Helm refuses without live observer registration; C0 also lets escaped failed child emit ghost a.n99. The first cleanup defect exists on both; the second is fixed by Helm. Preserve both observations.

## Recommended correction boundary

Use an explicit per-member construction allocation record, passed through this builder's recursive construction and scalar leaf allocation. It owns only that attempt's provisional cells, position registrations, publication bindings and responsibility resources. No ambient global “all allocations since checkpoint” authority. A nested public write starts its own record; an already-existing member is not owned by the outer attempt.

Prefer deferring live tree registration of the newly constructed scalar cells until member admission completes, rather than append-then-truncate. Detached cells must remain readable during canonical ordinary-image and responsibility preparation. Their leaf closures therefore need an explicit storage/binding cell which starts detached, switches once to installed tree storage at commit, and remains detached if canceled. This is identity-preserving storage handoff, not a new public owner or publication proof. Existing source selection/responsibility still comes from the producer; allocation ownership supplies no ordinary authority.

At success, run fresh/occurrence validation and all callback-capable preparation first. Then transfer precisely this member's registrations as part of the existing callback-free physical-member/terminal installation boundary, before completion/delivery. Once physical membership installed, later completion/observer throw must not cancel it. Use an actual installed state, not “function returned successfully.” Canceled record clears all live-tree forwarding edges and retained prepared responsibility; it does not touch a nested record that installed.

At refusal, release only the record's unpublished resources. An escaped private preparer child must not acquire a reused slot or attach itself to a later retry. Keeping it as an isolated detached leaf preserves the useful existing no-ghost-write assertion without inventing public stale-handle exceptions. Its externally held value is distinct from a root-retained abandoned allocation. The shared record must clear references to the root/publication context after close; an invalidation boolean alone is insufficient cleanup.

Do not truncate a tree-wide suffix: a reentrant installed child may occupy it. Do not reuse numeric slots while old closures still refer to them. Do not change slotCount to hide occupied storage. Deferring registration also preserves the original no-growth oracle without a counter redefinition. The exact position/capture registration resources must participate in the same record; a scalar-only fix cannot claim full failed-construction cleanup.

This requires a small private leaf-storage handoff shared by neutral/native leaf runtimes; source review must check both before claiming framework coverage. If that scope exceeds the intended slice, report it rather than silently implementing array-tail reclamation. No public signatures, semantic markers, owner policy, or global authority index is needed.

## Required unchanged and additional discriminators

- Preserve/replay the unchanged failed three-refusal zero-slot test and original four immediate-child expectations as historical/contract evidence.
- Keep current nested getter writer survival, partial-installed equality throw, successful retry, ordinary inspection exclusion, and no observer delivery after disposal.
- Add refusal callback which independently installs another row, retains its exact handle, then throws: nested slot/position/value/support and future writes survive; only outer allocation is released.
- Add same-key reentry so outer stale plan cannot overwrite the independently installed identity.
- Retain failed child through retry and subsequent writes: no alias, no publication, no root mutation; clear root-owned bindings independently of caller-held child.
- Throw during responsibility preparation, membership preparation, and validation; distinguish each from postinstall completion throw, which preserves installed member/resources.
- Exercise neutral and actual native leaf runtimes; count real registered values/equalities/position maps/publication references outside measured work. No universal heap claim.

No runtime correction is included. Main can commission narrow review of this explicit allocation ownership/handoff before the new successor. The demonstrated defect is genuine; its inherited status does not waive cleanup.
