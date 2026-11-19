# Producer dispositions (exact R3 successor)

All locations below are packages/kernel/src; six direct scalar-frame producers explicitly supply `admissionParticipation:'realized'`:

1. lib/internals/causal-runtime/tree-realization-adapter.ts prepareSelectedOperation: selected endpoint restoration remains in withScalarSelections; flag independently classifies actual scalar attempts.
2. Same file preparePointRealization: its scalar frame is flagged when member preparation does not own scalars.
3. Same file planHeterogeneousFrame: actual staged scalar frame flagged; entity packets/ordinary structural metadata unchanged.
4. Same file planScalarFrame: flag independent of whether fieldEndpoints exists; existing scoped endpoint restoration unchanged.
5. enhancers/transactions/transactions.ts scalarTransitionTargetBinding.prepareTarget: rollback's existing origin/id/ownerId (intentionally no transactionOwner) is preserved. Flag supplies operation classification without reconstructing owner identity.
6. enhancers/restoration/restoration.ts scalarTransitionTargetBinding.prepareTarget: existing restoration origin remains; flag explicitly classifies compensation, not user reentry.

Member scalar frames: plain-branch-membership.preparePlainBranchMembers gains an optional fifth private argument, forwarded to its internal prepareCommit. All three adapter callsites and transaction/restoration member bindings explicitly supply realized. Generic/default calls remain unflagged. No change to member responsibility producer, installation order or entity authority.

Transport: both neutral and native orchestrators forward through prepareCommit AND commit; substrate commitValues/prepareValues/commitSlots carry the option. prepareSlots captures the value before equality then places it on the actual IntrinsicMutation. The terminal invocation and publication spread carry that same classification. Direct ordinary commitSlotValue retains its old options/no realized default.

Consumers: intercept-leaf-signals terminalRecord ingress calls pure scalarAdmissionMetadata; transactions scalar selection uses the same helper only when flagged. Terminal producer guards remain unchanged. Native authorship, inspection, proof requirements, source selection endpoints, public WriteMetadata, existing per-effect context scopes and publication metadata are untouched. The separate installed-operation dedup correction exempts realized external evidence while retaining authored replay suppression.

## Mandatory composition handoff — not applied here

The independently developed dynamic candidate introduces scalar-responsibility-attachment.ts. Its terminal delegate currently derives metadata directly from getActiveWriteContext and mutation.intent. Composition must replace THAT derivation with `scalarAdmissionMetadata(getActiveWriteContext(), mutation)` too. Both the exact mutation and its flag must reach the producer; using only ambient metadata would reintroduce an authored journal entry or missing scalar admission mismatch.

The pure helper is internal, does not read/write ambient state, and preserves caller origin/transaction/owner fields while setting mutationIntent and, only for flagged attempts, participation. No dynamic runtime is composed in this candidate. Dynamic initializer cleanup remains separately reviewed. Combined tests/full qualification belong to Main; this isolated freeze does not accept that composition.
