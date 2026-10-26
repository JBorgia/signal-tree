# Leaf membership admission must precede native publication

Root source trace, October 26, 2026, frozen f01ed39a. This mapping was completed after the bounded selection-review addendum; it is not covered by that review's positive disposition. No new reproduction or runtime execution. It refines the existing admission-before-reentry obligation, not the original timeout count.

## Existing producer order

| Producer | Existing source order | Required private handoff |
| --- | --- | --- |
| Ordinary whole/partial branch write | signal-tree.ts1009 captures a final publication callback; new child installation at1036 is followed by membership invalidation at1039; remaining keys can run updaters/equality. Presence reconciliation at1284–1302 precedes republishMembers1309. The captured membership notification is produced in finally1319. | Prepare attempt-local evidence before installation; seal/admit each actually installed membership unit before its first native invalidation/republication. The final tagged event must reference exactly the completed units it describes, not infer their dependencies from the later callback context. |
| Re-add through a held descendant | member-membership.ts390 captures announce; presence changes install at393–404; republishMembers can run before announce at410. | Freeze installed presence/literal-key footprint and its revision/dependency association before republishMembers. Retain existing innermost-first announcement and ordinary path-lifetime semantics. |
| Tagged member notification | plain-branch-membership.ts145–194 computes after presence/value and calls PathNotifier with unused value slots. | A prepared membership-event identity must distinguish a real absence from a ping, and correlate the exact affected source/relationship baseline. Do not synthesize a branch PositionId. |
| Enqueue / immediate delivery | PathNotifier calls enqueue evidence observers before experimental annotate; immediate _runNotify bypasses current flush-only researchComplete. | Consume pre-reentry evidence; complete the same event/source association before immediate delivery. For queued delivery, retain the existing membership barrier and event ordering. |

`setMemberPresence` itself changes presence on the branch and peer without publishing (member-membership.ts785–795). `republishMembers` calls membership/native slot publication; `publishMembershipChange` updates a reactive cell. Moving only PathNotifier.annotate ahead of its enqueue observers therefore does not establish the stronger producer ordering.

## Completion cannot mean outer callback return

A branch write can install a new member and then run a later sibling's updater; an error still announces actual installed membership in finally. Existing readdedDuringStructuralWrite protects callback-authored membership from outer omission. A successor must preserve those behaviors. It cannot label the entire outer callback one atomic success, delete reentrant members on failure, or discard partial installed truth because the final callback threw.

The private proposal needs a defined correlation between completed installed member units and the later existing tagged notification. Retaining immutable unit evidence does not authorize a second notification bus or an unbounded per-tree journal. A connection created after a unit installed starts from its then-current baseline; one created during preparation but before installation must not be mistaken for a post-install connection. Actual event associations must be finalized against the supported binding lifetime, not a stale early list of connections.

This is the remaining concrete source-mapping obligation for leaf Link. It is not supplied by entity P/O order records and is not discharged by a notifier-only change. A future native experiment must state how these private membership producer points carry completed evidence, including partial application, reentry, connection creation/disposal and error precedence. If that entails changing public write/observer semantics or replacing the established notification protocol, the current bounded proposal is insufficient and needs an explicit scope decision before implementation.

No claim is made that a new architecture is necessarily required. Existing private capture ports may carry the association, but that has not been implemented or behaviorally verified. The unchanged leaf omission reproduction remains the acceptance test; source inspection is not a substitute for its eventual successful delivery and settled completion.
