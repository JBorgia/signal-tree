> Superseded recommendation: read PHASE-ADJUDICATION.md first. The later chronology establishes a post-install failure and does not justify a six-read invariant or getter-count repair. This earlier analysis/proposal is retained for history, not implementation authorization.

# Bounded successor proposal — retain existing field evaluations

For independent mechanism review only. Start from exact C16, not by layering fixes over the failed successor. Owner-approved equal-whole authorship stands. Do not alter the pending-value-work arm, terminal-owner policy, native proposal precedence or final-subject lookup.

## Preparation facts

1. Keep C16's original physical, flat ordinary and per-step ordinary comparison passes **in their existing order**. Do not eliminate/reorder those existing user-code evaluations in this correction. Their throws and reentry are observable even where their results overlap.
2. Extend the private comparison result at those existing read sites to retain an immutable per-field fact for a field actually evaluated: own before/after presence, the observed after value, and the computed equality result. Store the values already read into locals, preserving evaluation order and short-circuiting; never evaluate a getter just to fill a record. No deep/shallow eager copy of caller values and no descriptor walk are necessary.
3. Scope facts to the exact source-issued edit/step/subject/packet. Keep physical facts distinct from ordinary facts. The final step ordinary comparison supplies the ordinary equal-field offer's value; the paired physical comparison supplies physical-view equality. A presence difference short-circuits today's value comparison, so it is NOT a cached evaluated value. Actual changed/deleted/new fields continue through the existing path.
4. A new equal-whole offer can reuse a fact only where that step explicitly supplies an own field, the existing comparison established equal presence/value, and source/lifetime validation still holds. Present undefined is a real value; use `has`/presence flags, not an undefined sentinel. No historical negative-field enumeration. Synthetic/unmigrated packets without these private facts retain their existing path; no fake evidence is inferred from a fields array alone.

This is retaining values already evaluated by ordinary preparation, not introducing an eager accessor-to-data staging contract for physical state. The original input/physical row references and existing native notification evaluations remain unchanged.

## Native and recipient consumers

- **Native proposal:** for newly offered equal fields, use the relevant retained ordinary value/presence when constructing the source-issued proposal endpoint. Existing changed-field proposals keep their old path. `lastOrdinaryBySubject` still chooses the final ordinary edit; retrieve facts from THAT edit, not an earlier same-subject occurrence. Per-edit restored endpoint wins over selected endpoint, which wins over proposal, as before.
- **Native physical-view retention:** for that new equal offer use the retained equality result of its correctly paired physical edit instead of executing fieldValue twice again. Do not extrapolate from an arbitrary explicit field list; only the source-issued comparison fact proves equality. Existing changed/unsupported paths retain their comparisons.
- **Recipient payload projection:** transport the selected endpoint's value/presence (or the corresponding immutable source-issued field facts paired with that selection) along with its requirement for newly offered equal fields. All recipients consume that prepared value, rather than each re-evaluating edit.after[key]. Whole egress, row and scalar entity projections must use the same source read abstraction. This is mechanical consumption of source facts, not a Link admission override or caller-specific safety guard.

One concrete private shape is an optional read-facts record attached to EntityPublicationEdit plus a shared prepared-field reader. Native preparation resolves its selected endpoint once; its per-edit evidence exposes the selected field data to egress/row/scalar consumers. Absence of facts falls back to the existing path. Do not attach a process-global row cache or another ownership graph, and do not change raw packet.after/physicalAfter into staged rows to evade existing getter behavior. Shared field reading must preserve the deliberate final-subject proposal and per-edit restored exceptions.

The field value and the requirement must travel from the SAME selected endpoint. If native admission selects a prior owned or inverse endpoint, a new offer must not pair its captured proposal value with that prior requirement. Transaction effects, responsibility capture and native input capture retain their current original-row evaluations; this proposal does not suppress those existing callbacks or create equal-value effects.

## Failure and reentry boundaries

- If an existing comparison getter throws, propagate that same error at that same phase; no newly captured record becomes installed authority.
- If that getter performs an inner write, preserve current physical/source revision validation, outer refusal and surviving inner work. Keeping read order prevents the failed successor's reentry-site shift.
- Captured facts are local until the existing combined source installation. No extra getter invocation is permitted during metadata freezing, selection, recipient projection, completion, or delivery solely because the equal field was newly offered.
- Retain existing post-install computeField/PathNotifier/notification-capture evaluations. Do not use the new publication facts to silence those independent native observations.
- Getters may return different values at different existing reads. Keep separate records per read domain; do not equate the first physical sample with the last ordinary or responsibility sample. Test stateful-accessor disagreement explicitly, including active native ownership, before claiming coherence. If correct selected data cannot be transported without changing that contract, stop with that concrete counterexample; do not broaden staging semantics.

## Falsifiers required before acceptance

Run the preserved baseline/successor stack workload and require C16's six read sites/order on all three routes, not merely six total calls. Seventh-read sentinel must remain uninvoked; first/read2/read3 throws and reentry must retain error identity, refusal and inner effects. Repeat with multiple entity recipients: no per-recipient extra getter calls. Include getter values differing across existing physical/ordinary/native-responsibility reads, own undefined/deletion, and final duplicate-subject/per-edit restored tests.

Then run Main six unchanged, retained-root reexposure, mixed owned/unowned fields, q-owned equal/r-inverse/net-zero rollback, no-value notices, no-recipient authored evidence, and current revision/disposal controls. This proposal has NOT been implemented or run; only the exact-site traces in REPORT.md are executed evidence. Independent review must assess the private source-fact transport and stateful-accessor boundary before another runtime patch.
