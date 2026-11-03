# Independent causal inventory: declaration lifecycle and admission

Read-only review of frozen helper87231fb2030d25f3770075809e38fb2497c429bb142f0c0cc0bd65077bcc0dc3 and native patchfa397f9, plus preserved qualification evidence. Anchors below refer to /private/tmp/link-qualification-lifecycle/private.ts and loader.mjs unless another path is named. No repair or new API selected.

## Distinct causal groups

### Receipt status terminality

private.ts112–121 implements read() as a live query of global stack, connection disposal, latest fact and frame flags. At114 it returns validating whenever ANY declaration is active, before checking started115. The reproduced started -> validating -> started sequence follows directly. The physical send is not reversed; this is an incorrect receipt projection.

Smallest required boundary: receipt-local lifecycle must determine whether that receipt is still validating, with terminal states monotonic. Enclosing-frame validation from the earlier correction remains necessary before terminal admission. Merely moving a conditional may fix the demonstrated row but does not by itself prove disposed/superseded/no-write terminality, unrelated scopes, or held terminal receipt cleanup. Test those transitions against existing proposal states; do not add another status API.

### Invalid/unsupported/stale source admission

loader54 unconditionally adds declare to every Link handle; it forwards tree id and getOwnedPositionIds(x)?.[0] or -1, with no scalar-kind/lifetime admission fact. private.ts125–132 validates connection disposal and dependency-handle shape/authenticity, not the Link source category. The source-guard replay therefore invokes callbacks for branch and collection sources despite the scalar-only proposal.

Scalar entity fields must NOT be lumped into unsupported aggregates. They are supported scalar Link carriers; their incorrect undefined payload is a separate projection-address defect. Rejecting every entity-related node would change the intended scope rather than fix that scalar failure.

Stale source/lifetime behavior is not established by the aggregate source-guard witness. Current attachment uses only owner/first position (private.ts100), losing subject lifetime and field address. This is insufficient information to prove a held retired entity source still corresponds to the represented fact. A source descriptor/admission plan must use existing native source/lifetime identity and keep old held references detached; it cannot reconstruct identity from display path or business key. Tree destruction is NOT equivalent to connection disposal under existing contracts; do not add a blanket tree-destroy rejection by assumption.

Smallest required boundary: validate supported native source and source lifetime before invoking declaration work; independently ensure every downstream receipt/ticket names that same native subject/location. The latter connects to projection repair; source kind validation alone cannot fix it.

### Secondary declaration errors

private.ts136 catches a callback value;138 can then produce a known contradiction error. Catch141 invalidates active frames and immediately rethrows callbackError, discarding the secondary declaration failure. There is no onTreeError invocation. loader54 supplies no reporting path/tree attribution to this helper. Executed composition has two failed assertions (no event; reporting listener never writes8) with this one cause. Both endpoints stay held and callback identity is preserved.

Smallest required boundary: existing error reporting must receive the secondary declaration diagnostic while the relevant validation horizon still encloses its synchronous listeners. Preserve primary thrown identity, including primitives/frozen objects. Reporting listener throws/reentry must not erase the primary or reopen early admission; avoid recursive duplicate reports. This shares the synchronous validation horizon with admission, but it is not the cause of entity payload aliasing or retired-map accumulation.

## Exact ownership and retention edges

| Store/edge | Construction/use | Live obligation | Current retirement |
|---|---|---|---|
| sources Map(owner -> source closure/token) |9,20; loader65 registers each transaction tree;43 scans all | Read relevant unresolved owner state / validate authentic attribution | No unregister path; dispose73 empty |
| outcomes Map(owner -> transaction outcome) |10,25–27; queried66,95,120,132 | Held/queued evidence still needs outcome; authentic terminal handle admitted later may need compact terminal fact | No deletion or ownership accounting |
| latest Map(location -> Fact) |13,38,49 | Current revision validity for active connections and queued preflight | Old slot overwritten, final location entry never removed |
| records Map(Fact -> payload receipt) |14,49 | Batch completion and active/held/in-flight payload evidence | Never removed, including superseded facts |
| completed Map(location -> receipt) |15,52–53 | Latest completed ordinary projection for active refresh | Last per location remains after disposal/destruction |
| permissions WeakMap(Fact -> Map(channel -> Frame)) |81,106 | Declaration proof plus enclosing validation for relevant revision/connection | Weak key does not help while records/latest/completed strongly retain Fact; inner map retains channel/frame |
| Frame -> enclosing frames/facts/receipt |79,112;89–95 | Unfinished shared validation; unresolved dependency/outcome/receipt state | No compact terminal conversion; entire closure remains |
| Receipt.read -> status closure -> Frame, isDisposed closure |112–121; loader54 | User-readable immutable terminal/admission outcome | No detached terminal representation; whole-tree retention through held receipt is source concern, NOT GC-proven |
| listeners Map(owner -> callbacks) |11,31; loader48/55 | Active Link eligibility notifications | Unsubscribe removes callback; executable listeners0 confirms this part works |
| queued microtask owner set |12,28 | One scheduled outcome wake | Deleted on task execution; not the observed persistent accumulation |
| diagnostic receipts array |18,23,49 | Optional research history only | Never trimmed; separate from correctness-store leak evidence |
| native inspectionBaseline per slot kernel |patchfa397 | Ordinary authority while physical inspection diverges | Cleared by legitimate adoption/realization paths; independent destruction/held-leaf retention remains unmeasured |

After eight fully settled cross-tree cycles, sources4->20, records8->24, completed6->22, outcomes3->11; listeners0. Both tree owners were destroyed, all pending owners confirmed, all sends acknowledged, all connections disposed, application receipts not retained. Those correctness records have no demonstrated live obligation in that workload. This is measured metadata retention, not a byte estimate or proof of every captured tree staying alive.

A counter-based cleanup cannot merely delete every confirmed owner: authentic terminal handles may still be supplied later, a started send can outlive disposal, another connection may depend on the same owner, and unfinished outer validation can still invalidate a child. Compact terminal identity must remain independently available for live handle references while subscriptions/payloads/old frames drain. The existing authentic WeakMap80 can support identity without strong global retention, but the current helper stores only Blocker there, not a complete independently readable terminal state. This is a concrete missing lifecycle connection, not proof that another public token API is needed.

## Which issues can share a repair boundary?

Receipt projection and retention can share a clearly defined per-operation lifecycle (validating, admitted/held, started/superseded/disposed, compact terminal observation), but they are not one identical bug. Terminal-state precedence fixes reporting; it does not release strong maps. Reclamation needs exact ownership of each record and transition after the last relevant obligation drains.

Source admission and entity payload corruption share a need for a native destination descriptor, but source-kind rejection does not fix collection-position aliasing on supported fields. The projection must continue using native subject/lifetime/field semantics. Native equal-adoption entity coverage is another installation path, not caused by private receipt status or logging.

Secondary reporting belongs to validation completion and error precedence, and its reentry must participate in that same horizon. It is otherwise independent of source representation and reclamation.

Therefore “all six failures have one cause” is unsupported. A credible bounded plan should have separately falsifiable components: native source/projection binding, missing native adoption path, receipt/error lifecycle completion, and obligation-index retirement. They may use shared descriptors/lifecycle records, but each must keep its original failed replay.

## Pre-code requirements and stop boundaries

1. Write a record/transition table that identifies creator, all strong owners, and terminal compact facts for each retained object. No new public API implied. Specify disposal during validation, disposal while another connection depends on the same foreign owner, and terminal handle reuse.
2. Establish source descriptor coverage for scalar tree leaves and scalar entity fields; reject unsupported aggregate declaration before callback while leaving ordinary Link behavior intact. Name the native projection boundary used for payloads; do not use raw notification payload as a universal value.
3. Bind admission/receipt/error reporting to the specific operation's validation completion. Preserve the separate meanings of known contradiction and app-hidden omission.
4. Pre-register unchanged failed replays plus positive controls: useful independent send, declared hold, cross-tree confirmation, no-op/ABA, old reference detached, rejected-owner fresh projection, terminal receipt queried during unrelated scope, reporter reentry, all-obligations-drained cleanup and live-held dependency retention.

No unresolved product choice is currently demonstrated for fixing the existing receipt/reporting/unsupported-source defects; the accepted proposal already states the required outcomes. Retention implementation choice remains engineering evidence work, provided it preserves held terminal handle identity and documented destruction distinction. If correct field projection or complete adoption coverage requires replacing native settlement authority, new broad canonical state, or changing destruction/ownership semantics, that crosses the authorized bounded correction and needs an explicit architectural disposition. Do not hide such a change behind metadata cleanup.

This inventory recommends no runtime edits by itself. The current candidate remains rejected; prior scalar results remain valid.
