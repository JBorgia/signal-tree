# Explicit whole-value authorship in the bounded v16 candidate

This describes the approved rule and the current isolated candidate. It is not
shipped v15 behavior, production activation, or final acceptance of the proposed
Link declaration API.

A whole-row replacement explicitly supplies its fields. For supplied fields
whose selected ordinary evidence is unowned, equal values can establish fresh
publication evidence. This makes explicit whole replacement consistent with
explicit field writes. Existing selection of retained transaction-owned evidence
remains in force, including its historical-owner guards; this is not a universal
rule that discards ownership when a transaction confirms. A value observer need not receive a notification when its
value has not changed; publication evidence and value changes are different facts.

A replacement does not acquire another pending transaction's contribution merely
by supplying the same value. That transaction keeps its settlement responsibility;
rejecting it must still restore its ordinary before-value. The candidate's
mixed-field controls check that distinction directly.

A declaration applies to its operation, not every later mutation of that row.
Rollback creates a separate publication. The current candidate can hold that
publication conservatively while another instrumented owner remains pending,
even when its selected inverse field values are known. This is an attribution
qualification limit, not proof that those fields depend on the foreign owner.
Wrapping settlement in a declaration currently does not remove that limit.

Fresh explicit authorship of intended surviving values has its own declaration
and can make progress independently. Do not mechanically read the displayed row
and write it back to bypass a hold: inspection may display values that are not
ordinary truth, and explicitly writing them can adopt them. Use values the
application actually intends to author, with complete input declarations.
Undeclared settlement must also eventually deliver its current eligible result
without requiring a fresh write; the separate fallback control tests this.

A later getter or observer can throw after installation. Such an error does not
mean the write was refused before application. The candidate preserves the
primary error, invalidates unsafe early permission, and retains required holding
and recovery behavior. A per-operation eligibility receipt is not a remote
acknowledgment; destination failure and delivery settlement remain separate.

See [owner authority](EQUAL-WHOLE-AUTHORITY.md),
[independent bounded implementation review](equal-whole-qualification-independent/REVIEW.md),
[exact post-install phase](equal-whole-phase-trace/PHASE-ADJUDICATION.md), and
[current composition results](combined-c19/RESULTS.md). These sources preserve
first failures and limits; they do not establish release readiness.
