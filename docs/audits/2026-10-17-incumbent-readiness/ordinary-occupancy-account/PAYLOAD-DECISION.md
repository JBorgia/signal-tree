# Active-old payload: authorized acceptance mapping

Owner decision, October 22, 2026: “Preserve inspected display 99; ordinary truth 7”.
This resolves the question raised by interpretation-review.md; it is not runtime
successor authorization, an executed test, or a change to successor placement.

## Required state transition

1. Ordinary lifetime L occupies A with n7. Retain its handle.
2. Inspection moves L to B and displays n99. Ordinary occupancy/value remain A/n7.
3. A transaction creates fresh lifetime F at A. Retain its distinct handle.
4. Reject the transaction successfully under the unchanged minimal witness's
   admission conditions.
5. L occupies A physically and ordinarily, with physical n99 and ordinary n7.
   F is detached. B no longer aliases L. Neither handle retargets another lifetime.

A row's payload ID remains independent of its storage key. Assertions must not
invent equality between them. Placement follows the separately approved
lifetime-sensitive successor/predecessor rule, not a new replay rule.

## Consumer and lifecycle assertions

- Physical reads/observers describe L at A with n99 after complete installation.
- Ordinary inspection/capture/publication facts describe the restored n7, not
  incidental inspected n99. Use the established ordinary-state projection harness;
  public physical reads alone do not establish this assertion.
- No observer receives a partially installed topology. Publication eligibility
  remains separate: the decision does not grant declared-Link activation.
- A subsequent explicit transactional n99 write adopts ordinary99 under the
  existing adoption rule; its rejection restores physical and ordinary7. This
  subsequent write has an explicit value reversal, unlike the first key/existence
  restoration. It must not be treated as a genuine ordinary99-to99 no-op.
- Preparation failure changes neither view nor authority. Refusal preserves
  responsibility and supported retry; successful settlement remains terminal.
- Retain ordinary7 while the physical99 divergence is live, even after the first
  transaction is terminal. Reclaim divergence only when agreement and remaining
  live obligations permit it; no GC result is implied by these assertions.

## Remaining preparation gates

The original two failures and C1–C3 stay unchanged. Before a successor is selected,
show that the same private preparation account handles absent and active old
lifetimes, staged key reuse, normalized inverse folding, value footprints and
complete-unit placement. It must precede both adapter validation and target
construction and carry one prepared revision through installation. The reviewed
Bind/Unbind inventory is not executable evidence for those joins.

No later slices, second settlement authority, public API change, budget change,
or production activation follows from this semantic clarification.
