# Read-only shared construction / joint R2 composition

Inputs verified against full manifests:
- Shared construction f63ade892aa381b827f1db54986fbb2ca787cb1bde497847104bd0a40bd9dffe.
- Joint R2 289e25b0aeb5ab0d936c81b7ba77bf6994929c1a081418f6c0f6996e8c198a99.

COMPOSITION-LEDGER.json records hashes/bases and verifies no mismatches. No merge, source edit or test run was performed. These are composition requirements, not integration qualification.

## Four direct textual overlaps, one essential non-textual seam

The cumulative cleanup delta (relative to Helm dynamic-enrollment source, not merely the last three-file shared delta) overlaps R2 in native-tree-scalar-leaf-runtime.ts, tree-scalar-leaf-runtime.ts, owned-mutation.ts, tree-scalar-slot-port.ts. Whole-branch comparison against R2's C0 base additionally intersects experimental-publication/private.ts and intrinsic-mutation.ts: those are enrollment/predecessor changes already carried by shared construction, not new cleanup edits. Do not replace those files wholesale or attribute their conflict to this last delta.

The critical extra dependency is tree-scalar-slot-runtime.ts, changed by R2 but not cleanup. R2 adds a strong publicationSources array and bindPublicationSource(slot,node) at lines158/271. prepareSlots reads it at220 to prepare source evidence, coverage and terminal records. Cleanup adds a new adoption branch that allocates a live slot only after preparation. Merely retaining R2's call in the regular createLeaf branch omits every dynamically adopted leaf from frame publication.

Minimal safe composition:

1. Preserve R2's slot kernel intact, including prepare/seal/validate, publicationPredecessors, coverage, terminal install and completion receipt independent of changedSlots. Keep cleanup's detached local kernels unbound to live source authority while provisional.
2. In EACH neutral/native allocation.add attachment, after kernel.createSlot returns the actual live slot and before callback-capable delivery, call kernel.bindPublicationSource(slot,prepared.leaf) alongside the existing binding/token and leafByPositionId attachments. Use the NEW LIVE slot, never detached localSlot (usually0) and never a pre-reserved suffix. R2's binding primitive is assert+array assignment, so it fits callback-free handoff. On cancellation no root publicationSources entry ever exists. This new strong registration belongs explicitly to the successful allocation receipt.
3. Preserve regular createLeaf's R2 binding too. Native cleanup changed createNativeScalarLeaf to return `{leaf,token,attach}`; a textual R2 patch must bind the actual leaf, not that wrapper. Preserve the one native cell/token created before installation; do not call createWritableCell or equality at attach.
4. Preserve both publication wrappers from R2: publish invalidates then completes the installed frame in finally, retaining primary errors. Preserve publicationPhase in both frame orchestrators and slot-port options, while retaining the optional ConstructionAllocation argument on createLeaf. These are independent private signatures; neither supersedes the other.
5. Merge owned-mutation additively: retain cleanup's isActive gate and returned release handle AND R2's coveredRecipients argument/withScalarPublicationCoverage. A canceled provisional writer must not emit root ownership; an adopted writer must retain exact recipient coverage. Choosing either whole version loses one of these properties. Native replace/derive must keep R2 coveredRecipients while their kernel/slot/publication/liveness references retain cleanup's mutable handoff.
6. Keep source-owned PreparedMemberConstruction packet and actual install receipt for both recursiveUpdate and materializeMember. Attachment remains inside the callback-free membership/terminal boundary; never call a publishing frame commit to move detached storage. Membership invalidation before completion is an explicit cleanup change; inspect against R2 grouping rather than moving arbitrary observation earlier. R2's internal witness/observer phase distinction and source-finalization sequence must survive.

## Minimal integration discriminators (not run here)

- Create a dynamic ordinary leaf after recipients enroll; exercise a scalar frame inverse/rollback and verify useful payload AND native support/coverage/completion. Repeat through keyed materializeMember. This kills a missing bindPublicationSource adoption call that value-only tests miss.
- Refuse outer construction after an independently installed nested child; then frame-write the nested child. Confirm canceled leaves have no live slot/source registration and nested source coverage remains exact. Include a pre-existing root slot0 to kill detached-index aliasing.
- Actual native .set/.update/computed identity through adoption, then shared mixed scalar/entity rollback with all source/terminal installation before observation; retain R2 postinstall-error and no-value-change completion assertions.
- Repeat pending foreign support, inspected ordinary divergence, same-key reentry and canceled held branch new-key controls. These test isolation while preserving the existing independent-owner/recipient contracts.

No additional persistent authority store is necessary: R2 already owns the slot-to-source mapping; construction must attach to it at the reviewed receipt. Passing the separate branches does not establish these cross-path results. Main should compose from verified bases and obtain the existing independent reviews before qualification; no source was altered here.
