# Active-old restoration: independent payload and placement adjudication

Read-only; no source changes or executions. The proposed result was treated as a hypothesis.

## Determined facts

For ordinary A(n7), inspection moving the same lifetime to B, transaction creating fresh A, then rejection: the old lifetime must return to ordinary key A and the new lifetime must detach. The ordinary occupancy footprint includes the displaced old occupant. A physically active old lifetime is not a new lifetime and must not be duplicated. This is the already-reviewed minimal active-old case with unchanged payload.

Placement is a separate obligation. `semantic-transition-plan/README.md:118` S5 preserves existing successor/predecessor/frontier policy; W10 at139 preserves exact lifetime and placement. The later prerequisites review at19 explicitly excludes changes to successor placement. Therefore relocation must obey the existing admitted inverse placement facts and approved successor rule; physical presence elsewhere is not authority to preserve its current index unconditionally. No new bracket/replay semantics follows. Concrete multi-row cases still need unchanged placement tests; this review does not claim those tests pass.

## The added n99 variant is not conclusively specified by the cited cases

Sequence under review:

1. Ordinary old lifetime L at A has n7.
2. Inspection moves L to B and writes n99.
3. Transaction creates fresh lifetime F at A.
4. Reject transaction.

Both interpretations restore L at A, detach F and preserve ordinary n7, but differ in displayed L.n:

- **Field-minimal relocation:** display99 survives; ordinary7 remains. Existence/key compensation does not itself author an old-lifetime field write.
- **Whole-existence restoration:** display7 is restored with the displaced ordinary lifetime. Its ordinary removal/add inverse includes the prior ordinary row image, even though that lifetime happens to remain physically active elsewhere.

I could not establish that the frozen approval selects one of these for this exact combination. The approval in `semantic-transition-execution/README.md:102–108` says restore ordinary topology within the authored footprint and leave unrelated inspection. It does not explicitly classify an inspected field on the *same structurally displaced lifetime* as inside or outside that footprint.

The proposed argument from W5's 'key authorship only; no implicit field/order adoption' is insufficient alone: the transaction here performs W4 fresh creation and displaces old ordinary existence; the old lifetime's rekey was inspection, not the authored transaction. W4's row/existence responsibility at plan133 and W10's exact restoration remain relevant. A relocation implementation cannot decide that question by choosing a rekey instruction instead of an add instruction.

Existing discriminators do not resolve the difference:

- `entity-semantic-topology.spec.ts:24–35` C2 restores the ordinary old value, but the old lifetime is physically absent and has no differing inspected displayed field to preserve.
- `entity-semantic-structural-inverses.spec.ts:9–18` preserves inspected n99 on unrelated C while restoring old A. It does not assert inspected payload preservation on A itself.
- The point/field realization tests preserve inspected sibling fields within a partial value footprint. They do not establish that an existence displacement has the same footprint as a partial field write.
- Inspection egress minimality governs ordinary publication/adoption, not this physical compensation distinction; the plan explicitly warned against using egress alone to select structural compensation.

## Narrow disposition

Do not change the established expectations of the two minimal failures: neither needs this new payload choice. Continue their independent occupancy account.

Before implementing or freezing an assertion for the n99 extension, obtain either a previously approved exact governing example or this single owner clarification: **when rejecting a new occupant restores an old ordinary lifetime that inspection kept physically active elsewhere, does structural compensation retain its un-authored inspected field display (99, ordinary7), or restore its full ordinary payload (7)?** Keep existing successor placement independent of that answer.

If a recommendation is required, field-minimal relocation is consistent with retaining unrelated inspection and avoiding incidental value authorship, but that is a recommendation, not proof of existing authorization. The alternative cannot be excluded merely because it is less convenient for a proposed transition representation.
