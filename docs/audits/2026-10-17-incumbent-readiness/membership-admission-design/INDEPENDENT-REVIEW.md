# Independent membership admission design review

Reviewed 2026-10-26. Design SHA-256: `ab44d268839310eabaca7dca0f0a80cc1424fb0412f7c4bf5fbf517ecc85edc4`. Source: clean `/private/tmp/v16-transition-qualification`, HEAD `f01ed39a7df8a5de185ebec0773e09e36537dacb`; compared relevant scalar writer diffs with `87f6831fa60cafe87508f0ace84b7638698ca3b0`. Contract: `docs/review-contract.md`, contributor contracts, and the semantic-transition plan, including its writer inventory and stop boundaries at `f80645c8`. Paths below are relative to `packages/kernel/src/` unless specified.

I did not implement this mechanism. I independently checked the parent's scalar equality/preparation source lead. I did not read PRODUCER-CONTRACTS.md, WRITER-SEAM.md, or other new reviewer findings. No runtime, model, test, build, gate or benchmark execution occurred. All sequences below are source deductions; the earlier archived leaf timeout remains an earlier executed result, not evidence that these new sequences were executed.

## Disposition

**The admission/completion split is a plausible private representation, but this document does not yet establish an implementable repair within the approved scope.** No static impossibility of that split is demonstrated. The document correctly leaves two material questions open. They have different status:

1. Moving preparation/admission to the actual installation seam is potentially an implementation correction within an existing writer obligation. The current scalar terminal hook does not cover every membership installation, particularly equal retained-value re-add. Mapping all held descendants would extend beyond the plan's explicitly named hidden-collection seam unless separately justified against the inventory.
2. Retaining and replacing publication evidence for several contributions to one payload is an additional projection-authority composition mechanism. The approved plan constrains its answer but does not specify the answer. Reusing a queue does not make its eligibility rules an already-approved record-format choice.

Keep the runtime stop. The next decision is bounded: specify and adjudicate that composition rule and the precise additional writer footprint, or explicitly choose the conservative product alternative. This is not a request for another general inventory or permission to start implementation.

## 1. Event-only exact identity cannot solve the demonstrated information loss

`internals/plain-branch-membership.ts:148–168` retains the outer metadata, examines final descriptors, omits members whose presence returned to the before state, and unwraps the then-current value for a present member. Therefore:

- An outer absent-to-present installation and nested removal can leave no outer event.
- An outer addition followed by a nested value write can produce an outer after-image containing the nested write.

An exact ID on that final event solves event association only. It cannot recover an omitted installation or distinguish the authors of the final after-image. This is a static insufficiency of the event-only alternative, not a newly reproduced runtime failure.

The required earlier admission points are real. `lib/signal-tree.ts:1035–1040` installs a fresh child and invalidates membership before later siblings; `1281–1309` changes presence and republishes before the final tagged event; `1314–1328` publishes installed partial results even after an earlier application error. `internals/member-membership.ts:390–411` captures, changes presence, and may republish before announcing. Notifier annotation at `lib/path-notifier.ts:359` is later still, including after enqueue observers at `333–345`. A notifier-only move cannot establish pre-native-publication evidence.

**Supported alternative:** an existing private queue can receive immutable installed deltas before those publication points and use the existing tagged notifications as completion associations. A producer completion distinct from individual installations is necessary for partial success and no-event cases. Nothing in that separation inherently grants rollback ownership or requires a second canonical tree. It must not turn the public net summary into a new sequence of public per-unit events.

Cheapest falsifier, **not run**: fresh add, nested removal, and a later throwing sibling; assert the actual installed/nested state, original error, existing notification grouping, and eventual retirement of all private entries despite the absent outer net event.

## 2. Held-path preparation must include membership-only writes

The draft explicitly recognizes the after-install problem, and its qualification is warranted. `internals/tree-scalar-slot-runtime.ts:260–270` checks physical and ordinary equality and returns at `268` without calling `prepare` when both are unchanged. Nevertheless, `internals/tree-scalar-leaf-runtime.ts:140–144` calls `absence.reAdd` after that return. The native implementation similarly calls `commitRecorded`, then capture, then re-add through publication (`internals/native-tree-scalar-leaf-runtime.ts:177–201`, helpers `139–162`). A value-change-only preparation hook therefore misses a real membership transition.

This is directly constrained by existing assertions:

- `lib/absent-path-write.spec.ts:260–267`: equal retained value must re-add the authored path.
- `lib/whole-value-membership.spec.ts:296–324`: membership-only, value-only and combined changes each publish once.
- `lib/absent-path-write.spec.ts:464–481`: exact notification sequence is `a.b`, `a`, root, then `a.b.keep`.
- `lib/absent-path-write.spec.ts:249–256`: unrelated retained siblings stay absent.

`reactivatePathOnWrite` deliberately requires the authored value to be installed first (`internals/member-membership.ts:340–360`). Moving the whole function earlier would use retained storage and disturb this contract. Merely adding fallible projection preparation at its present call site leaves changed-value writes already installed if preparation throws. Conversely, hooking only existing `prepareTerminal` fails the equality case above. These are concrete contradictions of those two shortcuts, not a contradiction of the draft's explicitly unresolved proposal.

The missing mapping must identify a membership-aware preparation trigger independent of scalar equality; preserve the updater/equality boundary; retain authoritative supplied value and path/off-path presence facts; and install those prepared facts before the first relevant capture/publication callback. It must account for the native capture call that currently lies between scalar commit and re-add, rather than assuming both implementations have the same observer chronology. Membership evidence must not fabricate an intrinsic scalar change or new settlement responsibility.

A private hook relocation with those properties could remain within existing obligations. However, W9 in the approved inventory names hidden **collection** reintroduction and its branch-member seam. It is not blanket authorization to redesign all leaf/branch writers. The draft must identify the smallest additional scalar/native writer footprint if its full held-descendant claim requires it; the plan's outside-inventory stop applies to that expansion.

Cheapest falsifiers, **not run**: the existing equal-value and count/order controls, paired with an injected preparation throw for both changed-value and equal-value dormant writes. Outer state, membership and evidence must remain uninstalled on preparation failure; legitimate nested work must survive. No new runtime defect is claimed from unrun fault injection.

## 3. Immutable deltas do not by themselves determine mixed-payload eligibility

The source confirms the stated mismatch. `experimental-publication/private.ts:33–35` admits a fact then supersedes the previous fact. `projection.ts:25–30` retains a latest fact and later attaches a payload. `lifecycle.ts:74–78` moves a declaration frame's view to its last revision; `91–95` deletes superseded operations. This is not an implementation of retained evidence for all contributions still represented in a payload.

For an outer independent add followed by a nested dependent field write, the late membership after-image includes that field. Authorizing the whole image using only the outer declaration grants publication to input that declaration did not cover. Authorizing every payload from only its last independent sibling write has the same defect. Permanently unioning every historical blocker prevents useful progress after a complete independent overwrite. The draft correctly rejects all three shortcuts.

The precise unresolved expansion is a **connection-relative, source-shaped evidence retention/replacement rule**: which installed contributions still justify each retained value and presence fact; which exact authored footprint removes previous contributions; how ancestor presence and child values compose; how a complete overwrite, omission, re-add and inspection alter that support; and how terminal declaration receipts remain terminal while any separately necessary publication proof survives. Literal path overlap or equal payloads alone cannot decide these questions. A declaration outcome also cannot be frozen as eligible before its existing validation finishes (`lifecycle.ts:81–84`, `101–110`).

The plan requires ordinary participating evidence and forbids inferring permission from observed membership. `internals/source-mutation.ts:4–21` expressly separates interpretation from authority and preserves native source shapes. Those are constraints, not an existing specification for this support/replacement algebra. A bounded private implementation might satisfy them without new rollback authority, but selecting the rule is consequential architecture work. It must be adjudicated explicitly; calling the storage an enriched existing queue does not resolve authority or retention semantics.

Cheapest discriminating pair, **not run**: (a) independent outer addition plus nested pending field copy and an unrelated independent sibling write must remain held for the copied contribution; (b) a subsequent complete independent overwrite of that contribution must make useful progress without clearing unrelated pending obligations. Assert receipt outcomes as well as payloads. Repeat with absence/re-add so presence authority cannot be silently discarded with a value overwrite.

## Completion, alternatives and limits

Exact installed-unit association is preferable to the current revision-wide completion loop (`projection.ts:27–29`), which can associate an event with an earlier completed fact. The design's synchronous completion requirement is also grounded: current synchronous notification at `path-notifier.ts:366–379` bypasses the flush completion at `515–517`.

The no-event completion path needs a concrete scheduling mapping, not merely an assertion that an existing wake is enough. In `lib/link.ts:991–1002`, the eligibility callback refreshes projection but returns when `held.size === 0`. Thus invoking that callback does not universally schedule a newly completed projection. This is a missing native mapping, not proof that a new event bus is necessary. The candidate must preserve the existing consequence timing and must not directly send intermediate payloads merely because their delta became complete. Installed/completed publication evidence is not a new history turn or permission to publish during declaration validation.

A conservative hold for composition that cannot yet be represented is a safe failure mode only if it never grants early permission, leaves status/settlement truthful, and retains required evidence until safe existing admission or disposal. It cannot count as success for declared progress or silently replace the task: the approved plan explicitly does not authorize the product alternative of deferring declared progress. It also does not cure stale payload attribution by itself.

The draft makes no runtime cost claim, correctly. The affected-source index and retained contribution support are new storage/lifecycle work even if housed in the existing registry and queue. No source evidence here establishes bounded payload retention or cleanup. These are native implementation proofs after mechanism/scope adjudication, not grounds to invent a new policy now.

No runtime changes or authorization follow from this review. The two central unresolved matters are now concrete: a membership-aware writer seam including equality-skipped re-adds, and an explicit publication-support replacement rule for mixed authored projections. The proposal is suitable for that bounded decision, not for implementation acceptance.
