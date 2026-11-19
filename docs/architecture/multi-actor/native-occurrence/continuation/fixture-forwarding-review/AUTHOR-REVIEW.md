# C21 heterogeneous injection-forwarding correction

Bounded review candidate: two spec files only. Runtime/config/oracles unchanged; no composition performed.

Before: exact C21, both original cases fail with Entity publication source changed before installation. After: both cases pass with every original assertion retained. Spec-types gate passes; baseline unchanged. Existing public heterogeneous-live-subject control also passes its undo/redo/undo/rollback, physical/outbound values and held-row identity assertions. Its name-filtered invocation ran one test; the file's other three tests were not selected (reported skipped), and no source skip was added.

The patch supplies the complete private point-plan signature, derives a typed Parameters tuple, and forwards it with original.apply(this,args). Only injection forwarding/type declarations change. It retains selected steps, shared PublicationPreparation identity, complete() in the plan type, exact receiver, and the same invalidate replacement. No owner/source validation bypass or runtime edit.

Exact causal discriminator: original wrappers called original with values only, losing the third shared-phase argument. This created standalone per-row validation: first row installs the collection publication record, then sibling rejects its changed revision before invalidation. Restoring transparent forwarding reaches and passes the original first-error, sibling-attempt, physical-state, scalar delivery and update delivery assertions. The before/after result demonstrates this fixture defect on C21; it does not claim universal heterogeneous safety or an earlier version's execution result.

Artifacts: injection-forwarding.patch; BASE-MANIFEST.json; SNAPSHOT-CANDIDATE.json; originals/; before/first.log and RESULT.json; after/first.log and RESULT.json; public-control/COMMAND.json and first.log; spec-types/COMMAND.json, first.log and RESULT.json. Each Nx runner uses own output/cache/data/tmp and an owned-group 180-second watchdog. No trigger or residual process. Every run's declared manifest verified before/after. Source identity changed only at the two spec paths. No broad suite, build or performance claim.

Independent review requested before composition. The separate unchanged GC experiment and routing proposal live at /private/tmp/st-c21-held-gc; no GC routing patch is bundled here.
