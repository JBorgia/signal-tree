# Prepared physical order fact handoff — proposed bounded correction

Base: exact C8a, runtime identical to C8. Two supported-input membership-stream failures reproduced unchanged (4 pass / 2 fail). No runtime patch yet.

Prepared EntityMutationFrame.orderEndpoints already records physical before/after subject sequences. stageFinalFront materializes these only when existing-prefix movement requires it; fresh prepend retains its sparse no-endpoint route. Forward those immutable endpoints as an optional private third argument to EntityMembershipTap at MEMBERSHIP_FACTS. Extend frameChanges to append a reorder only when survivingOrderChanged(before,after). No ordinary authority, inspection baseline reconstruction or live collection snapshot is introduced.

OPEN_ORDER bulk windows continue to suppress frame facts (instructions AND endpoints); their existing final diff remains the sole producer. Non-diffing OPEN groups retain existing grouping. R4 holds delivery after fact capture until detached completion; no callback phase is moved.

Required proof: existing-only and mixed overwrite prepend replicas reach physical snapshot with lifetime identity preserved; fresh add uses complete neighbours without artificial reorder; already-front overwrite sends no membership event; rejected/no-op changes unchanged; diffed bulk operations do not duplicate; listener reentry/throws and compound rollback remain ordered. Add measured no-new-snapshot control. Source types and affected tests required. Fresh legacy exact add+reorder expectation needs separate reviewed oracle alignment, not blanket deletion of reorder checks.

Reviewer helper caveat: its post-add replica equals reorder.before assertion appears incompatible with existing bulk diff convention (before describes the pre-unit sequence, not the replay's intermediate list after additions). Validate that helper against unchanged mixed setAll before any correction; empty-event existing-only defect remains independent of this premise.
