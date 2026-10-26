# Minimal sequences for the design decision

These sequences are written before any successor execution. They are source-derived controls, not new reproduced runtime counterexamples. Existing executable failures remain unchanged at their preserved checkpoints.

## Equal retained value, newly present path

Start with a held ordinary leaf `profile.age` whose stored value is 1. Omit `age` through a whole profile write. Write 1 through the held leaf.

The stored value did not change; public membership did. The leaf becomes present with 1 and existing semantic-slot publication counts remain unchanged. Preparation must still retain the membership fact before first publication. A fault in new admission preparation must not install presence or a different value; it must not erase an earlier successful sibling. A present ordinary 1→1 write remains a no-op.

Current source returns from `commitRecorded` before calling terminal preparation for the equal value, then calls `absence.reAdd`. This rules out merely attaching the new membership record to the current value-change-only prepare callback. It does not rule out an internal membership-aware plan.

## Outer independence does not authorize nested payload

Retain a handle to omitted `profile.age`. Another ordinary root field x is 7 under a pending transaction. Link the held age source. Inside an independent declaration, write a whole profile supplying age=1 and a later sibling updater. In that updater, perform a separate dependent declaration whose write copies pending x into the same held age leaf.

The outer supplied 1 and nested copied 7 have different publication evidence. The final membership after-image can contain 7. The pending copy must not become publishable under the outer independent declaration. It must progress usefully after its dependencies allow it. An unrelated pending owner must not permanently block a later complete independent overwrite of age.

This sequence challenges identity-only repair and indiscriminate blocker union. It does not assert an unobserved send count. Exact outer reconciliation and callback chronology must be retained from the native controls rather than simulated with invented events.

## Fresh member, connection created during reentry, net-zero outer summary

A whole-value operation prepares a fresh member and a later sibling updater. The fresh child is installed first. The later updater creates a Link to that now-existing child, then performs a nested whole-value omission of it. The initial outer capture had absence; the final outer capture may also have absence and therefore emit no member frame. In this fresh-add path the outer dormant-members set is absent; the later reconciliation must be traced rather than assumed to reactivate the removed key.

The Link's creation baseline includes the child at creation. It must receive the subsequent removal and settle. It must not acquire the earlier add's publication grant retroactively. No extra public outer event is required; no retained uncompleted entry may wait forever for that absent event.

This is a source-derived reachability argument. Execute the precise supported sequence before labeling it a runtime failure; updater error/return choices must not accidentally author a final re-add.

## Boundary alternatives

| Alternative | What it supplies | What it still lacks |
| --- | --- | --- |
| Move annotation / attach identity to final membership event | Stops unrelated-event ticket reuse | Earlier native publication, omitted net-zero event, and mixed after-image authorship remain |
| Enrich existing projection queue with installed immutable deltas | Keeps source chronology and per-operation evidence without a second public protocol | Requires membership-aware preparation and a defined rule for combined payload evidence and supersession |
| Retain conservative publication for unrepresented composition | Avoids silently granting a mixed payload | Does not fulfill approved conditional progress for all supported cases; cannot be accepted by relabeling a hold as useful success |

Recommendation pending independent review: complete only the two missing internal contracts if they fit the approved shared-transition scope. If they require a new authority representation, report that expansion explicitly. Do not implement the event-only shortcut or treat the existing public API approval as approval of every internal means.
