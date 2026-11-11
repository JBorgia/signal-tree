## 16.0.0-dev (unreleased)

### Conditional publication declarations

A supported owned Link can `declare(declaration, work)` around synchronous writes.
Declare all contributing pending owners, independence only when there are no such
inputs, or unknown completeness. A `PublicationReceipt` exposes a current
`PublicationState` through `read()`; admission is distinct from endpoint delivery.
Declarations do not transfer write ownership, infer hidden application inputs or
provide backend authentication/durability.

Invalid declarations throw `SignalTreePublicationError`. Its `stage` distinguishes
rejection before the callback from validation after writes may already remain;
`reason` identifies the rejection. Inspect state before recovery. A no-write
receipt neither creates a new obligation nor clears an existing obligation.

Native custom adapters must supply `createCurrentReadonlyCell(readCurrent)` so
retained framework-native readers observe current values/errors on direct reads,
including during nested writes. Missing capability rejects factory construction;
ordinary cached readonly behavior is unchanged.

### Read-only runtime observation

Tooling can import `stateLocationReader`, `entityMembershipReader`,
`linkStateReader`, `transactionLifecycleReader` and `restorationReader` from
`@signal-tree/kernel/internals`. These observe the constructed tree; they do not
install enhancers or confer mutation/settlement authority. Use the appropriate
framework facade for application state, and reserve this entry point for tooling.

- `stateLocationReader` resolves structured property/entity addresses and current
  entity lifetimes. Do not parse dotted display paths as identity.
- `entityMembershipReader` exposes current collection membership and changes.
- `linkStateReader` observes Link state; local completion is not proof of remote
  durable persistence beyond the endpoint's contract.
- `transactionLifecycleReader` exposes pending transactions and settlement/refusal
  observations, including whether pending authority remains.
- `restorationReader` exposes history entries, recorded transaction lineage and undo/redo/jump outcomes.

Check optional-reader availability before use; readers do not enable missing
capabilities. Release subscriptions when the owning view/session ends, and destroy
owned trees at teardown. Readers are not a retained audit log.
`ConfirmedTurnEffectView.fieldSegments` preserves producer-known entity-field
address segments; `plainBranchMembership` distinguishes member presence before
and after an effect. Neither display paths nor an absent value can replace those
facts. Confirmed-history access remains subject to configured retention.


**TL;DR** — **Breaking, and deliberately so.** `tree.transaction()` is renamed
to `tree.transact()` and the old spelling is **removed, not deprecated**. One
`inspect()` on every transaction handle, plus three new public types. The transaction rollback
correctness defects described here SHIPPED IN 15.3.0 — see that entry; this
section predates it and is kept for the vocabulary change only. The rename is
mechanical; if you read confirmed history through `@signaltree/kernel/internals`,
see the retention note below.

### Breaking changes

```text
15.2.1                    16.0.0
tree.transaction(fn)  ->  tree.transact(fn)
```

No alias ships. A missed call site is a **compile error**, not a silent
deprecation warning — which is the reason for breaking rather than bridging.

Nothing else migrates: `propose()` never reached a release, so there is no
second rename to make.

#### Why this did not go through a deprecation cycle

The support policy promises a deprecated API gets a documented migration path
before removal, except where keeping it would preserve a correctness or
security defect. **A naming cleanup does not qualify for that exception**, so
this release does not satisfy that clause — it is a recorded one-time
exception, taken deliberately.

SignalTree is early enough that carrying a known-wrong public name purely for
compatibility would create permanent surface debt. **This is not a loosening of
the rule.** From 16.0.0 the corrected surface is the compatibility baseline and
the deprecation path applies normally. See
[`docs/support-policy.md`](docs/support-policy.md) and
[`docs/research/api-breaking-reset-0.md`](docs/research/api-breaking-reset-0.md).

### Carried from 15.3.1

The 15.3.1 patch (released from the 15.x line; its full entry lives there) is
carried on this line:

- What observers see under `transact()` and `restoration()`: `link()`
  endpoints and `settled()` while a transaction is pending, a rolled-back
  overlapping transaction, and undo/redo after a settled transaction.
- A throwing write observer no longer strands `transact()`. Batched observer
  errors go to `onTreeError` (at most 50 per tree per second) and to the
  console as [ST2034]: always in development, and in production when no
  listener took the report.
- A disposed link withdraws its held consequences.
- The rollback after a post-callback failure refuses if any location it would
  reverse (a leaf, or an entity row) was written again before `transact()`
  returned, for example by an observer or a transaction an observer opened;
  the error carries the recovery handle. The throwing-callback rollback is
  unchanged.

Differences from 15.x, following this line's recovery-handle contract:

- A failure after the callback returns (the invalidation group closing, or
  the mutation capture failing to release) rolls back through the handle. If
  that rollback is refused, the thrown error carries `recovery` with
  `callbackFailed: false`, and the original failure is reported.
- If the rollback installs but its delivery fails, the original failure is
  thrown and the delivery error is reported.
- `SignalTreeRollbackRecovery` documents the post-callback case. Its shape is
  unchanged.
- Still open on this line, with no known supported trigger: a failure while
  recording the pending turn, and a throw out of the post-callback flush.

Known issues that also reproduce here: an entity row restored by rollback or
undo/redo is not seen by linked endpoints; work an observer does while
`transact()` is still running is ordered before it, so an explicit rollback
afterwards can undo it; same-tick coalescing can lose a write for observers
(for example a newest-first double rollback, a rollback and then an undo of
the same location, and entity writes on two same-shaped trees); a whole-value
branch write that leaves out a key loses it for good (no observer is told, and
rollback and undo never restore it); and realization descriptors are retained
for retired entities.

### For users

- **Undo, redo and `jumpTo()` never write state an omission has hidden.** A
  location under an omitted member is restored by re-adding only the way to
  it when an ordinary write omitted it, or refused with ST1034 when external
  truth did. Before this, they wrote retained storage and reported success.
  A pending `rollback()` under an omitted branch restores retained storage, so
  a rejected value cannot return on a later re-add.
- **A location under an omitted member reads absent, and writing it re-adds
  its path.** After a whole-value write omits `a`, `$.a.b.keep()` reads
  `undefined` (through a held handle too, and in held consumers, which also
  follow the omission and a re-add); an updater there receives `undefined`.
  `$.a.b.keep(9)` makes `a` `{ b: { keep: 9 } }`: every omitted member on the
  path comes back with only that path, and `a`'s other members stay absent.
  Undo, redo, `jumpTo()` and `rollback()` of that write make them absent
  again. Before this, such reads returned retained storage and the write went
  to hidden storage, and undo or rollback of a write that re-added an omitted
  member left its key present with `undefined`. `updateAndReport()` re-adds
  an omitted path it supplies too, and a whole value that supplies an omitted
  key as `undefined` no longer brings it back with its retained value.
- **An entity collection under an omitted member is absent and empty.**
  `all()` is `[]`, `byId()` is `undefined`, `count()` is `0`, and held rows
  read `undefined`. Adding rows re-adds the path with only those rows; the
  retained rows never come back. Updating or removing a row throws "Entity
  with id ... not found", as on an empty collection. Undo, redo, `jumpTo()`
  and `rollback()` of a re-adding write make it absent again. This holds
  for a collection omitted itself, and in a tree whose root holds only
  collections. Before this, its methods read and wrote the retained rows.
- **A row-adding write to an absent collection is checked first.** It is
  validated and intercepted as on an empty collection before the retained
  rows are removed, so a write an interceptor blocks, or one with bad input,
  changes nothing. Before this, the retained rows were already gone.
- **A write made inside a whole value or a reversal no longer vanishes.** A
  tap or sync effect that writes an absent location while a whole value or a
  reversal is applied re-adds that location's path, in any tree. Before this,
  a write to the same tree went to retained storage and stayed invisible.
- **Taps read the collection as it is.** Inside a transaction, an undo, a
  redo, a jump or a rollback, a tap's `all()`, `count()`, `where()` and the
  other projections, read through the collection, include the change the tap
  reports; before, they read the collection as it was before the group. A
  projection cell obtained before the tap still reads its cached value until
  the group ends. Its row reads are absent-aware during a reversal too.
- **A duplicated id in one batch call applies sequentially.** `addMany` and
  `prependMany` in strict mode throw before any interceptor runs or anything
  is written; `skip` keeps the first copy; `overwrite` keeps the last copy in
  the first copy's place; `upsertMany` merges each later copy over the
  earlier result. Interceptors run once per applied copy, and each key is
  written, announced, tapped and returned once. Before this, the call put two
  rows under one key, and `prependMany` corrupted the order so that the next
  read threw `RangeError: Invalid array length` (v15 `778f86ef`,
  `e02238f4`).
- **Reversing a turn that omits a member and writes under it is exact.**
  Undo or rollback of such a turn restored the members it had written under
  as `undefined`; history now records what storage held.
- **Undo, redo, `jumpTo()` and `rollback()` of a write that omitted an entity
  collection bring it back.** A whole value that leaves out a collection key
  omits the collection; reversing that write now restores it with the rows it
  held. Before this, the reversal reported success and left it omitted. If
  something other than the reversal changed its rows while it was hidden,
  itself or inside an omitted branch, the reversal refuses and names it; that
  includes a reversal that re-adds the branch around it.
- **Settle the newest open transaction first, including across omitted
  branches.** Rolling back an older transaction while a newer pending one has
  omitted or re-added a branch enclosing its writes now refuses with the
  retryable `later-confirmed-dependency`, as an overlapping write already
  did. Otherwise the older rollback could succeed and the newer one's
  rollback then bring the rejected value back (as on 15.x). Retry once the
  newer one settles; that includes a branch holding entity collections,
  whose rollback no longer fails with "Plain branch target contains an
  unavailable member".
- **Link and path observers see what the tree exposes.** A Link (`link()`)
  endpoint whose location an omission hides (the location, or a member
  above it) receives `undefined`, or `[]` for a collection. A re-add sends
  what the location then reads. Undo, redo, `jumpTo()` and `rollback()`
  publish nothing for a location they leave absent, although they also write
  its retained storage. **Behaviour change:** an endpoint receives a send
  when an omission hides its location, or a reversal hides it again. Before
  this, it kept the last value it was sent, and later received the retained
  value from a reversal's announcement while the location read absent (v15
  `c6258aab`).
- **`jumpTo()` restores what undo and redo restore.** A jump applies every
  turn it crosses as one installation. Across omissions, re-adds and reused
  row ids it could report success with a partial, wrong state: a re-added
  member's older value overwrote the jump's own target, a member it re-added
  was hidden again, an earlier turn's value won over a later re-add, or rows
  came back in another order.
- **A turn that omits and re-adds within itself undoes, redoes and rolls
  back to its own start and end.** Before this, undo of
  `x(5); omit g; re-add g` gave back `x` 5, and redo of two path re-adds
  under one omitted member lost the second. A transaction's rollback had the
  same defect.
- **A turn holding two `setAll`s redoes exactly.** Redo of
  `setAll([a, c]); setAll([a])` in one turn, or a jump over such a turn,
  threw "no live placement anchor".
- **A collection order an undo, redo or jump cannot reconstruct is a typed
  refusal.** It refuses with ST1034, names the collection and says why, and
  the restoration reader reports `refused`. Nothing changes. **Behaviour
  change:** before, it threw a plain error (with nothing changed too) that
  named no collection. The shapes that still refuse are tracked for the
  15.4.x carry.
- **Reads, writes and partial merges after an omission cost what they did
  before omissions existed.** Once every omitted member is back, reads and
  writes no longer check presence. While one is omitted, each location's
  check is cached. A partial merge (`updateAndReport()`) no longer examines
  every key of its branch unless the branch has an omitted member. Each node
  keeps one copy of its address.
- **`transact()` — the same optimistic turn, named as a verb.** It matches the
  handle operations it opens (`confirm()`, `rollback()`), and it is the verb
  form of the noun the glossary already teaches. `transaction()` was a noun used
  as a method.

- **`inspect()` — reviewing a change before it lands.** Every handle
  `transact()` returns carries it. It reports whether each change the turn made
  still represents current truth (`'current'`) or has been overtaken
  (`'superseded'`), and `confirm()` / `rollback()` snapshot it as they settle,
  which closes a race `inspect()` alone cannot. New types: `InspectedChange`,
  `ChangeStatus`, `TransactionInspection`.

  ONE verb and ONE handle, deliberately. An earlier draft of this release also
  LANDED `propose()` / `Proposal` / `accept()` / `reject()` on main as a
  parallel vocabulary over the identical mechanism. It was REMOVED before any
  16.x release, so no published package ever carried it:
  PROPOSAL-0's own evidence is that the facade added no authority rule, no
  retained semantic fact and no proposal-only behaviour, and AGENTS.md binds
  public naming to the glossary's Everyday vocabulary — which defines
  `transaction` and `rollback` and never defines propose/accept/reject. A second
  name for every operation was a fourth naming level the project had not agreed
  to teach. The capability is unchanged and now reaches more callers, since
  inspection is no longer gated behind a second entry verb.
  Accepting is deliberately **not** undo history: wrap `undoable()` around the
  turn’s writes, not around `confirm()`.

  > `status: 'current'` means the turn's _contribution_ still stands, not
  > that the value it wrote is still present. An added row stays `current`
  > while another writer edits its fields. Render `inspect()` beside ordinary
  > current-state reads; it is a review status, not a value snapshot.

- **Rejecting a transaction no longer strands unrelated changes.** Previously,
  if a turn added an entity and another writer then touched that entity, the
  rejection refused _entirely_ — leaving every value in that turn live,
  including fields nothing else had touched. Rejection now completes for the
  rest of the turn when newer truth has **superseded** the structural change
  (the row was removed), while still refusing when newer truth **depends** on
  it (the row was updated). Refusing there is correct: reversing would destroy
  the newer write, and half-reversing a turn while reporting it rejected is
  worse than an honest refusal.

- **The same fix for a renamed entity.** A turn that rekeys a row, whose row a
  later writer then deletes, now reverses the rest of the turn instead of
  refusing.

### For contributors

- **The public API gate now guards the invocation surface, not just exports.**
  `api-baseline` records exported symbols and was blind to every callable
  member of an exported type — `transaction()` itself shipped in 15.2.1 without
  the gate knowing it existed. A second baseline now records functions,
  methods, callable properties, callable types and constructable classes, with
  normalized signatures, so a changed parameter, return type, overload or
  constructor fails the build. Mutation-proven 13/13.
