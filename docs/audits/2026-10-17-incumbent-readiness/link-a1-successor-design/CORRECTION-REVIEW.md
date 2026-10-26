# Correction review — P2 and native source revision

Read-only review of the concrete corrections in MECHANISM.md:48–63,181–186 and ACCEPTANCE.md P2/P4. No runtime/model/test execution, source changes, or new policy selection. Earlier PREMISE-REVIEW.md remains the review of the first draft, not silently rewritten.

## P2 derivation

The now-written **narrow retained-child case** follows the approved premises together:

1. The owner selected “Restore ordinary topology within authored footprint,” preserved verbatim in A0:17. The relevant footprint here is the retained y edge, not unrelated siblings or missing ancestors.
2. Inspection does not change O. Starting from P/O present, inspection omission makes only P absent; O y remains present with value7.
3. The ordinary held write supplies y7 and physically reactivates that same retained child. Existing physical reactivation remains meaningful and observable (`whole-value-membership.spec.ts` same-value reactivation controls); the correction does **not** erase that P change or require suppressing its established publication.
4. Nonetheless, the write changes neither O membership nor O value. Inventing an O false→true effect would treat the inspection-only physical absence as ordinary before-state, contrary to the approved source distinction. A0's ordinary no-op rule therefore prohibits a fabricated ordinary value contribution; exact O facts prohibit a fabricated ordinary membership contribution.
5. With no other intervening operation in this specified sequence, rejection has no such O contribution to reverse. P is already present after the write, agreeing with the ordinary topology required in the authored footprint. Rejection leaves P/O present and y7. Restoring the earlier inspection-only absence would select the physical before-image as the topology inverse instead.

Thus P2's explicit endpoint is supported **within the approved A0 ordinary-topology/adoption contract**. It is not justified merely by current runtime behavior, and I do not claim frozen A1 already implements it. My first-review concern was the absence of an explicit P2 oracle/application; the correction supplies it and ties it to the governing decision. No additional owner choice is needed for this exact retained-child, existing-parent, equal-y7 sequence.

Two limits remain: “ordinary no-op” does not mean the physical reactivation emits no event, and this conclusion does not select behavior for fresh child identity, missing ordinary ancestors, or a later foreign write. Those remain separately gated. In particular, no claim follows that arbitrary P-before display must always be discarded; the ordinary-topology rule applies within this authored local footprint.

## O-only revision and ABA

The correction resolves the concrete gap identified in the first review:

- Revision is native source metadata for the canonical retained parent, covering relevant P and O changes.
- O-only adoption advances it even without a signal/value event.
- Removing an O/P exception on convergence does not remove/reset the revision, so equal booleans cannot validate a stale plan after ABA.
- Revision is bounded per source identity, not a per-write retained history or new global O clock.
- The later membership interval is prepared from then-current source state after scalar capture/reentry. It cannot reuse an unvalidated pre-callback O-before image.

These rules are consistent with A0's distinct installed units and reprepare-after-reentry requirement (:29–30,93–94). They do not move physical membership before scalar capture or fold callback-authored units into the outer operation. The exact implementation and fixed-work/retention checks remain unproved; the corrected premise itself does not require an architectural expansion beyond the source owner now specified.

## Review disposition

The concrete corrections answer both first-review issues for the stated local scope. The retained-child mechanism remains a hypothesis awaiting its unchanged falsifiers and qualification, not native correctness evidence or runtime authorization. No general fresh-identity/ancestor/lifetime policy, destruction policy, public API, or release acceptance is inferred.
