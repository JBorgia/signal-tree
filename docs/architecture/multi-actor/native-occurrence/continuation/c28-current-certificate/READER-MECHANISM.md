# Read-only reader mechanism checkpoint

Not implemented or qualified. C28 is stopped on the reproduced fresh-input safety failure; this is the narrow source distinction a successor must establish before further work.

## Separate acquisition provenance from object identity

The existing seam is `beginBranchPublicationInput(node, supplied)` before invoking a library-generated updater. Its callers have both the source node and the actual value supplied to the callback. They know this is fresh source acquisition. By contrast an opaque terminal containing an earlier snapshot is supplied data, with its own historical certificate. `suppliedViews` currently treats both as lookup-by-object, so that distinction is lost before `captureNativeInput`.

A bounded candidate mechanism is an internal fresh-source traversal at this seam, separate from snapshot registration/supplied-evidence traversal:

- For a fresh ordinary branch, derive its structure/membership/source certificate from the actual source nodes selected for this acquisition, without accepting a cached ordinary branch object's certificate as a replacement for current source support. Recurse ordinary node descriptors, preserving negative membership and absent-path rules.
- For a primitive/native leaf, capture current leaf support and current membership as the existing direct capture does.
- At an opaque terminal whose delivered value is an issued snapshot, preserve the existing supplied-evidence rule. Do not recurse into arbitrary data as if it were live source structure. Its historical snapshot certificate must not become current source evidence merely because a new holder updater reads it.
- Preserve existing entity `captureInput`/`captureViews` dispatch and scope. This proposal is not entity normalization or authorization to redesign aggregate evidence.
- Leave `snapshotViews` registrations, old NativeViews/NativeInputs, cached object identity and ordinary value notifications untouched. Do not make a new snapshot mapping overwrite an old alias to compensate for fresh acquisition.

This is explicit acquisition provenance at an existing internal hook, not a second owner authority or a new public API. The key distinction is WHERE the input was acquired, not whether a JavaScript object happens to be newly allocated.

## Necessary qualification before claiming this is sufficient

A current-source traversal must certify the value actually delivered, including current effective absence and inspection divergence. Merely ignoring snapshotViews everywhere can certify old inspection99 as current7 and is unacceptable. The source/value pair must already be current at capture; if the current builder can deliver an older value during reentry/grouped invalidation, that is a separate concrete source/value mismatch and a blocker for this proposed traversal. Do not silently switch builders, invalidate equal-value caches, or change callback reference identity to make it pass.

The existing `unwrapBranchForWriteCapture` helper is not proof of this property: relevant call sites still use `unwrap`. Wiring it broadly is not this proposal and would need explicit reference/value/opaque-marker review. No blind builder change is recommended from the present evidence.

The read-only inventory therefore identifies the precise seam and distinction, but does NOT declare a ready-to-implement solution for all current call sites. Retain original old-inspection99/current7 controls; prove exact current payload and certificate alignment at each of the three updater entry points, including nested cached branch and opaque saved snapshot. Any need for broader snapshot API semantics must return for review.

## Finite falsifiers and disposition

Already executed elsewhere on exact paired inputs: new pending-q equal refresh followed by fresh updateAndReport independent target write. C27 holds/contradicts; C28 prematurely sends. Replay the same unchanged fixture for a future candidate first, with no source write after the target write that could hide missing input validation.

Not executed here after stop:

- Same setup through direct branch callable and recursive branch updater, distinguishing nested ordinary branch from opaque saved snapshot.
- Keep saved aliases before refresh; verify immutable captured certificates and current-source capture together, including old inspection99/fresh7 boundary.
- Supported same-horizon reentry and late/nonmatching recipient with pending-then-confirmed input: preserve readiness, first sentinel and useful terminal send.
- Separate currentRelevance cutoff question: no explicit retained `nativeRequirementReady` gate exists. Current input/frame protection covers the executed three validation cases, not all unfinished retained predecessors. Either prove the scoped open-horizon cases or narrow relevance to closed retained predecessors in a separately reviewed successor. No narrowing was made here.

Do not infer safety from source-role counts or the earlier 22-case pass. The no-write policy remains approved; pending-q acquisition is outside obsolete-history cleanup and must remain protected.
