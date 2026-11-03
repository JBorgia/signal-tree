# Declared-Link finite qualification: focused gate failed

October 20, 2026. Exact source checkpoint:
`568bdf697d07aca53266c1bb80b510efe7fbfbd5`. Production runtime remains
`87f6831fa60cafe87508f0ace84b7638698ca3b0`. No production edits, API activation,
repair, budget change or reopening of B occurred during this qualification.
The [scalar adoption checkpoint](../link-equal-adoption/README.md) remains valid
within its tested scope.

## Disposition

**Reject the current candidate for integration.** Focused qualification fails
before the full-suite/artifact/cost gate. The failure is not a rejection of the
proposed API direction or evidence that conditional publication is impossible.
This phase freezes and evaluates the implementation; it does not silently repair
each failure or redefine success. Production conservative hold remains default.

## Proven blockers

| Finding | Exact observation | Classification |
| --- | --- | --- |
| Entity scalar publication | Physical row field9; declaration receipt started; endpoint receives actual undefined | Incorrect payload on an existing supported scalar Link carrier |
| Entity inspection adoption | Inspection displays99 over ordinary7; equal transaction records0; rollback leaves99 | Missing native entity path for the authorized adoption behavior |
| Aggregate compatibility | Inspection alone sends unchanged eligible rows; baseline sends nothing | Extra publication caused by private refresh; inspected99 did not leak in this aggregate control |
| Receipt terminality | started becomes validating inside an unrelated declaration, then started again | Receipt-state contract failure; no request reversal or leakage observed |
| Declaration source validation | Branch/collection expose declare and execute callback; physical x becomes9 | Missing scalar-source runtime admission guard; not approval of aggregate declarations |
| Callback/error composition | Frozen callback error identity survives, but secondary link:declare report count0 | Required reporting absent; reporter reentry remains unexercised |
| Post-drain metadata | Eight settled/disposed/destroyed cross-tree cycles add16 sources and16 payload receipts | Obligation-free correctness-record retention, not a heap-byte measurement |

Wrong payload is **undefined**, not null. Original JSON arrays encode undefined
as null; root and reviewer checked the value type before serialization. Independent
field writes, dependent-owner rejection and held-reference rekey all expose it.
The original field matrix has11 assertions:5 pass/6 fail. They do not establish
six independent defects. A check that inspected99 itself did not escape is not
proof of correct publication when undefined escaped instead.

Native Link ordinarily projects entity events using collection owner, entity
lifetime and field footprint and ignores value-less pings. The helper keys facts
by tree plus first position, discards those distinctions, and replaces a scalar
eligible payload with a raw receipt. Collection row events and pings share that
position. It bypasses the native projection boundary. Native baseline sends9
for ordinary9 and nothing for inspection99; candidate accepts the field source
without unsupported-source refusal.

Receipt status checks global validation-stack length before its terminal started
flag. The reporter catch preserves the callback value but never calls the required
secondary error reporter. These are separate from payload corruption. No claim
is made that either diagnostic failure leaked speculative data.

## Coverage and controls

| Area / instrument | Result |
| --- | --- |
| Membership/add/remove, rekey, ordering rollback, replacement and held references; aggregate16 assertions | Baseline16/16; native adoption only16/16; full helper with policy disabled15/16 |
| Actual restoration enhancer undo/redo of removal | Passes in baseline, native-adoption-only and helper arms; coherent order/outbound and held lifetime checked |
| Composition26 assertions |24 pass/2 fail; both failures derive from missing secondary reporting |
| Source-boundary controls |2/2 fail: branch and collection callback execute |
| Lifecycle first4 scenario rows | Queued disposal and foreign-confirmation pass; receipt/inflight composite fails on receipt status; retention fails |
| Tree-destruction3 controls |3/3 match existing behavior; does not imply destroy equals explicit connection disposal |

Composition passes useful two-owner confirmation while later unrelated work remains
pending, connection-local permissions, explicit nested connection declarations,
unknown-outer conservative fallback, rejection excluding inspection, and serialized
corrective delivery after in-flight completion. Native value state and ordinary
publication remain correct in these passing controls.

Explicit disposal stops queued sends; in-flight requests already started can finish,
and disposal releases settlement waiters. Tree destruction preserves its established
distinction: pre-destroy queued work may deliver; started I/O waits for acknowledgment;
a held dependent waiter stays unresolved until explicit connection disposal. That
last documented limitation is not relabeled a new test failure or a stronger guarantee.

Aggregate declarations remain outside the approved scalar-only surface. Existing
aggregate Link behavior was tested for compatibility. `mode(false)` disables only
private eligibility, NOT private refresh; that arm is never called native-only.
A separate NATIVE_ONLY loader applies the scalar adoption patch with no experimental
Link, notifier or transaction transformations. Its16/16 isolates the extra aggregate
publication to the helper. Actual undo/redo is tested, but this small control does
not qualify every restoration composition.

## Reclamation evidence and limits

Before/after eight fully drained cycles:

| Store | Before | After |
| --- | ---: | ---: |
| Registered sources |4|20|
| Outcome-tree maps |3|11|
| Latest facts |6|22|
| Payload receipts |8|24|
| Completed receipts |6|22|
| Listeners |0|0|

Each cycle confirms its only pending owner, awaits delivery settlement, disposes the
connection, destroys both trees and drops the returned receipt. No live publication
or recovery obligation in this workload explains the growth. These counts exclude
the helper's separate diagnostic log. Source inspection confirms missing cleanup;
helper dispose is empty. This establishes retained-record growth, not exact retained
heap bytes or proof that every tree object itself remains alive. Retention while the
application deliberately holds a terminal receipt has NOT received a GC qualification.

## Historical expectations and misuse

The earlier unchanged delivery32/34 remains in the prior archive. Its two failures
expect permanent holding after relevant owners confirm: `unknown never cleansed`
expected[] but observed[42]; `actual held after confirm` expected unsettled but
observed settled. Approved surviving-write/post-confirmation semantics permit
progress, so those old expectations are not current blockers. No original test or
result is erased. Current owner/unknown-outer controls assert useful post-confirmation
progress separately. These results do not reconcile any of the new failures above.

Hidden-input omission remains application misuse. The prior omission-leak example
is preserved in the scalar checkpoint, excluded from safety counts, and not repeated
as a safety demonstration in this phase. Explicit declarations are not proof that
all application inputs were disclosed.

## Review and gated work

[Independent final review](REVIEW.md) reproduces wrong entity payload, source-guard,
aggregate compatibility, lifecycle and reporting findings. Root independently
replayed entity, lifecycle/destruction, all aggregate arms and actual restoration
arms. Entity reviewer independently replayed lifecycle; lifecycle reviewer replayed
root composition. No review verdict is substituted for execution evidence.

Full kernel/framework suites, semantic matrix, installed-artifact gates, complete
public types and fresh bundle/CPU/heap measurements were NOT run: focused blockers
failed the user-required entry gate. No costs are inferred from sparse counters or
older artifacts. This is a completed negative focused qualification, not a full
production qualification or acceptance. Remaining untested scope stays unqualified.

## Frozen identities and replay

Canonical native patch:
`fa397f9f9fbc29db3d10b332627e89b5c21c9321d793102af4d167f87577e107`.
Required frame fragment:
`86006a66926bfc71b20123f6960edf1972a9f924e6def005eb36f9795fda39a7`.
Private responsibility helper:
`87231fb2030d25f3770075809e38fb2497c429bb142f0c0cc0bd65077bcc0dc3`.
Local patch copies only relocate the frame-file path; loaders record all original
and transformed module hashes. No mutation to the frozen mechanism was made.
Node24.15.0 direct native source-loader tests, not Nx/full package verification.

Extract evidence.tar.gz in a disposable directory, then run each saved bundle in
a fresh process. All listed bundles export run():

```sh
node --input-type=module -e 'const {run}=await import("./entities/first-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
node --input-type=module -e 'const {run}=await import("./lifecycle/first-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
node --input-type=module -e 'const {run}=await import("./composition/composition-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
node --input-type=module -e 'const {run}=await import("./composition/source-guard-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
```

Further preserved bundles: entities/aggregate-{baseline,native-only,full}-final-bundle.mjs,
entities/restoration-{baseline,native-only,full}-bundle.mjs and lifecycle/bundle.mjs
(destruction controls). Typed-payload evidence is entities/payload-bundle.mjs.
Rebuild loaders require updating their saved absolute private/worktree paths and
frame fragment paths; frozen bundles need no rebuild. Root replay outputs and
preregistered focused plans accompany original assertions and first logs.
