# Time travel in production

Every other Angular store tells you to keep undo/redo out of production. That
advice is correct **for them** and was correct for us until 13.5.0. It is now
wrong for the reason people repeat it, and right for a different reason that is
much easier to manage.

This guide separates the three costs that got collapsed into one warning, and
gives you the four levers that make production undo/redo a normal feature.

Every figure and behaviour below was verified against the built package. Timing
comes from `node tools/bench-leaf-equality.mjs`; retention arithmetic is the
ST2029 model in [errors/README.md](../errors/README.md).

## The one distinction that matters

**User-facing undo/redo is not devtools time travel.** They have been argued
about as one thing.

- _"Undo the last thing I did"_ is a product feature. Editors, bulk-edit grids,
  wizards, drag boards. Your users expect it and it ships.
- _"Let me scrub the whole app back through 200 states"_ is a debugging tool. It
  wants unbounded history and full fidelity, and it belongs in dev.

`restoration()` serves both. The rest of this guide is about the first.

## Cost 1 — snapshot time. This no longer exists.

The reason every other library says dev-only: a snapshot is a deep clone, so
recording costs O(state) **per write**. At 10,000 rows that is unusable, so it
gets gated to dev and nobody revisits it.

Since 13.5.0, the whole-tree read (now `tree.$()`) is memoised and structurally shared — materialisation
rebuilds only the nodes beneath a signal that actually changed, and clean
subtrees come back **by reference**. A history entry is therefore a pointer graph
over shared structure, not a copy.

**This requires immutable values.** Undo, redo and `jumpTo()` restore the
object and array values a history record holds by reference too: a row field
dropped by `replaceOne` comes back as the same object it was. If you mutate an
object or array after handing it to the tree (your own copy or the one read
back from it), history holds the mutation and restoring brings that back. Write
a new object instead of mutating one in place. Cloning on every restore would
make undo O(value) for no benefit to code that already follows this rule.

<!-- measured: the "before" column is a point-in-time record from the 13.5.0 CHANGELOG entry — pre-13.5.0 materialisation no longer exists to re-run. The "now" column reproduces with `node tools/bench-leaf-equality.mjs`. -->

| 50 recorded writes over | before 13.5.0 | now         |
| ----------------------- | ------------- | ----------- |
| 10,000 rows             | 340.60 ms     | **0.04 ms** |

The qualitative change is not the percentage: recording is now **flat in state
size**. If you rejected time travel on write cost, re-measure.

## Cost 2 — memory. This is the real constraint, and it is arithmetic.

A history entry holds the tree's snapshot, and a collection's snapshot is **one
pointer per entity**. So `entries x width x ~8 bytes` is the **floor** for
touching that collection at all:

<!-- measured: node --expose-gc tools/bench-retention-arms.mjs <shape> <width> 50 — heap baselined after seeding, so the figure is history retention alone. Constant is ~8.1-8.3 B/pointer at 10k-50k (a 64-bit pointer); the 1,000-row row reads ~10.5 because fixed per-entry overhead is a large fraction of a 0.5 MB total. Catalogue entry: docs/errors/README.md ST2029; threshold constant: packages/core/src/enhancers/restoration/restoration.ts (HISTORY_RETAINED_POINTER_BUDGET). NOT arithmetic — an earlier version of this table asserted a linear model instead of measuring it, and shipped a constant ~28% high. -->

| collection | 50 entries, collection touched | 50 entries, every row changed |
| ---------- | ------------------------------ | ----------------------------- |
| 1,000 rows | 0.51 MB                        | 2.45 MB                       |
| 10,000     | 3.95 MB                        | 23.06 MB                      |
| 50,000     | 19.38 MB                       | 114.77 MB                     |

**The left column is a floor, not a worst case.** Changing one row costs the same
as changing fifty different ones, because the pointer array is rebuilt either way.
What separates the columns is the _changed_ rows: each one adds ~40 bytes on top
of the array, which at 50k is a 5.9x span between the two.

That matters for sizing, because the intuition it kills is a common one: a 400-row
bulk operation is not inherently the expensive case. One 400-row entry retains
**0.43 MB**. The expensive case is _many entries_ against a _wide_ collection.

Core warns past ~500k retained pointers (**ST2029**, ~4 MB), judged on retention
rather than row count — a wide collection with short history and a narrow one with
long history are held to the same standard, because a row-count threshold gets
both wrong.

This is the number to design against. It is bounded by three things you control:
how many entries you keep, how wide the recorded state is, and how much of it each
write changes. In 15.0 the width term is removed by DESIGNATION rather than by a
per-marker option: state nobody designates with `undoable()` is never recorded, so
it contributes nothing to the width. (The removed `recordHistory: false` lever
measured flat at ~0.15 MB across 1k, 10k and 50k — the arithmetic below still
describes what opt-in achieves.)

## Cost 3 — bundle. Real, and a separate question.

<!-- measured: node tools/size-report.mjs — the per-enhancer delta over a bare tree. -->

`restoration()` is a couple of KB you do not want in a build that never undoes
anything; `node tools/size-report.mjs` prints the current delta.

⚠️ **Do not gate it on a runtime boolean.** This ships it anyway:

```ts
// BROKEN — the static import defeats tree-shaking, so restoration is in the bundle
const tree = signalTree(state, {
  enhancers: isProduction ? [] : [restoration()],
});
```

Put the import behind the build so the bundler can drop it — see
[composition-recipes.md](./composition-recipes.md). If you _want_ undo in
production, this cost is simply the price of the feature, and it is small.

## The four levers

### 1. Bound the history — `maxHistorySize`

```ts
signalTree(state, { enhancers: [restoration({ maxHistorySize: 50 })] });
```

Verified: 20 writes against `maxHistorySize: 5` leaves 5 reversible turns and 5
spendable undo steps. This is your direct control over the retained-turn half of
history memory.

### 2. ~~Scope what is recorded — `recordHistory: false`~~ — REMOVED in 15.0

**This lever is gone, and opt-in designation replaced it.** `entityMap({
recordHistory: false })` scoped recording by declaring which collections to leave
OUT. 15.0 inverts that: nothing enters restoration history unless an operation is
designated with `undoable()`, so a collection stays out of the undo stack by
default and no per-marker option is needed.

```ts
// 15.0 — the collection is outside the undo stack because nothing designated it
signalTree({ rows: entityMap({ selectId: (r: Row) => r.id }) }, { enhancers: [restoration()] });

undoable(() => tree.$.draft.title.set('edited')); // THIS is reversible
tree.$.rows.setAll(serverRows); // this is not
```

The original text is kept below because the memory arithmetic it reports is still
the reason the lever existed.

<details><summary>as it read before 15.0</summary>

A collection can persist and serialise while staying **out of the undo stack**:

```ts
signalTree(
  {
    // 50,000 server-owned rows: saved and restored, never undone
    rows: entityMap({ selectId: (r) => r.id, recordHistory: false }),
    // the small editable state the user actually undoes
    draft: { title: '', tags: [] as string[] },
  },
  { enhancers: [restoration({ maxHistorySize: 50 })] }
);
```

Verified: with `recordHistory: false`, two undos reverted the scalar state to its
initial value and left the collection's contents untouched.

⚠️ **That is the tradeoff, stated plainly: `undo()` will not revert an excluded
collection.** If the user can edit those rows and expects undo, do not exclude
them — shorten the history instead.

`transient: true` is the stronger form: out of history **and** out of
serialisation. Use it for genuinely derived or secret state.

Arbitrary branches cannot be scoped yet — only markers. That is
[RFC 0012](../rfcs/0012-history-scoped-marker-capture.md), accepted and deferred.

</details>

### 2b. Form drafts are application-owned

SignalTree 15 has no form marker or scoped form-history API. Keep form control
state in the framework, or model a bounded draft as ordinary tree state.
Designate accepted draft edits with `undoable()` only when they should join the
tree's retained undo stream. A panel that needs independent local undo owns that
history outside SignalTree restoration.

### 3. ~~Make bulk work one step — `pauseRecording()`~~ — REMOVED in 14.1.1

**This lever is gone, and it should never have been one.** `pauseRecording()`,
`resumeRecording()` and `isRecordingPaused()` were deleted rather than deprecated.

It could not express "one undo step" — only "record nothing". `addEntry` bailed on a
single boolean, so pausing alone was **destructive**: nothing recorded, the newest entry
still described the state BEFORE the bulk, `undo()` stepped back past it, and the result
became unreachable with `canRedo()` false. Verified: n went 1 → (bulk to 5) → undo → **0**,
redo → 1, and 5 was unreachable. An earlier revision of this very guide shipped that
recipe.

The documented fix was a synthetic "sealing" write — meaning an undo API that required
you to add a field to your domain model so history had somewhere to land, after which
the entry was identified by a timestamp rather than by what the user did.

And it was a **global** mode. `pausedSignal` was one flag on one manager and `addEntry`
returned early for every writer, so correctness required sole ownership of the tree for
the window's duration. Verified: an unrelated `tree.$.rev(999)` inside a paused window
was suppressed too. A synchronous `for` loop has sole ownership by construction; a
multi-second `mergeMap` over N HTTP requests does not.

**What to do instead, today:** install `restoration()` and designate the
synchronous import with `undoable(() => { /* add the rows here */ })` when it
should be undoable. Sharing a microtask does not make undesignated writes into
history. Invoke undo from a later user action, after the designated turn settles;
see [the 15.3.1 failure inventory](transaction-failures-v15.md) before combining it
with pending transactions or Link.

**Historical evidence after the removal:** the then-current automatic recording
model grouped 25 `addOne` calls into one entry, undo → 3 rows, redo → 28. That
measurement predates v15 opt-in designation. The
[greenfield history design](../architecture/history-the-greenfield-target.md)
records the design discussion, not an additional current API.

### 4. ~~Drop uninteresting transitions — `shouldSkip`~~ — REMOVED in 15.0

**Gone, and for the same reason as lever 2.** `shouldSkip` filtered transitions
AFTER they were recorded by default. Under opt-in designation a cursor move is
never an undo step in the first place, because nobody designated it:

```ts
// 15.0 — no predicate, and no per-write comparator cost
tree.$.ui.cursor(next); // not designated -> not an undo step
undoable(() => tree.$.doc.body(v)); // designated -> one undo step
```

That also removes the cost warning this section used to carry: there is no
comparator running on every recorded write, because there is no
record-then-filter step.

## Composition patterns, and whether they hold up

<!-- measured: the 100 ms sampling interval is a source constant — `setInterval(handleChange, 100)` in packages/kernel/src/lib/audit/audit.ts. Cited rather than benchmarked on purpose: a constant breaks greppably when someone changes it, where a timing run only breaks when re-run. -->
<!-- measured: node tools/verify-history-defects.mjs — reproduces the CONSEQUENCES by outcome (every check calls undo() and inspects state): the fixed form-coverage behaviour, that write-then-revert pairs are dropped, and the maxHistorySize fallback. It does NOT measure the 100 ms figure — its sleeps are chosen from the constant above. -->

| What you are building                               | Pattern                                                                                                      | Supported                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Editor undo over a small document                   | `maxHistorySize`; designate document edits with `undoable()` and leave caret/selection undesignated          | Yes                                                                                   |
| Bulk-edit grid with cancel                          | `transaction()` — `confirm()` or `rollback()`                                                                | Independent of `restoration`; rollback can refuse — see [v15 limits](transaction-failures-v15.md)                                                 |
| Undo one panel, not the whole app                   | designate only the panel's operations with `undoable()`                                                      | Yes                                                                                   |
| Large server collection + small editable **branch** | apply the collection with `external()`; designate the branch's edits with `undoable()`                       | Yes — the headline pattern                                                            |
| Large server collection + small editable draft      | `external()` for the collection; ordinary draft state; designate accepted edits with `undoable()`            | Yes. Independent panel-local undo remains application-owned.                          |
| Optimistic request reconciliation | Use a returned transaction handle and application conflict policy; never `undo()` or `jumpTo()` | Rollback can refuse; see [the 15.3.1 failure inventory](transaction-failures-v15.md) |
| Import/generate, then one undo                      | —                                                                                                            | **No.** `pauseRecording()` was removed in 14.1.1 (see lever 3) and has no replacement |
| Audit trail rather than undo                        | `getRestorationHistory()` for retained undo entries; use an application event log for a complete audit trail | Restoration history is not a complete audit log                                       |
| Show the user how far they can go                   | `getCurrentIndex() + 1` back, `getRestorationHistory().length - 1 - getCurrentIndex()` fwd                   | Yes — reactive since 14.0.0; follows `undo()`/`redo()` since 15.4.4 (see below)       |
| Undo per entity, independently                      | —                                                                                                            | **No.** Keep independent edit scopes in application-owned state                       |
| Collaborative editing                               | A CRDT (Yjs, Automerge) underneath — undo is per-user, not per-document                                      | **Not a store feature.** Don't                                                        |

`getCurrentIndex()` is the history entry the visible state corresponds to:
after `undo()`, `redo()` or a new undoable write, the latest applied entry
(`-1` when every entry is undone); after `jumpTo(i)`, the viewed entry `i`.
`jumpTo()` is a view, separate from the undo position: the next `undo()` or
`redo()` first returns to the undo position and steps from there, and the
index follows it. The step counts in the table hold outside a `jumpTo()` view.
Through 15.4.3 `undo()` and `redo()` did not move the index at all, and the
"back" count read `getCurrentIndex()` rather than `getCurrentIndex() + 1`.

### Undo over ordinary writes

An ordinary write (authored, not designated with `undoable()`) made after an
undoable one does not take away its undo: `undo()` restores the undoable
write's own pre-image over it, and `redo()` its own after-image. For a scalar,
`undoable(() => x(1)); x(2); undo()` gives the value before 1, and `redo()`
gives 1. For entity rows (since 15.4.4):

- A row the undoable turn added, which an ordinary write then removed, stays
  absent on undo (that is its pre-image); the rest of the turn reverses, and
  redo adds it back as the turn recorded it.
- A row the turn edited, which an ordinary write then removed, comes back on
  undo as it stood when removed, with the turn's fields set back and other
  fields' ordinary edits kept, next to the neighbours it was removed from (or
  the nearest ones still there). Redo applies the edit again.
- If putting the turn's row back would displace a newer row an ordinary write
  put at the same key, `undo()` or `redo()` refuses with a typed ST1034
  restoration refusal naming the collection and the key, and nothing changes.
  Once the newer row is removed, the undo proceeds.

Writes applied with `external()` are not ordinary writes: an undo that would
overwrite external truth refuses instead.

## Reactive readers, and why that mattered

`canUndo()`, `canRedo()` and `getRestorationHistory()` are signals. Before that they read plain values, so
`computed(() => tree.canUndo())` evaluated once and cached `false` forever — an
undo button in a zoneless app never enabled. If you are on 13.x and your undo
button looks dead, that is the bug.

## A starting configuration

```ts
export const appTree = signalTree(
  {
    rows: entityMap({ selectId: (r: Row) => r.id }),
    draft: { title: '', body: '' },
    ui: { cursor: 0, hovered: null as string | null },
  },
  { enhancers: [restoration({ maxHistorySize: 50 })] }
);

// Only designated operations are reversible.
undoable(() => appTree.$.draft.title(title));

// Neither of these enters the undo stack — no option required.
appTree.$.ui.cursor(next);
external(() => appTree.$.rows.setAll(serverRows));
```

Fifty steps over designated draft edits. The large collection and the cursor churn
are outside the undo stack because nothing designated them — which is what
replaced the two removed levers above. Retention is 50 entries over a narrow
branch: kilobytes, not megabytes.

## See also

- [entity-collection-cookbook.md](./entity-collection-cookbook.md) — collection
  modelling, including why an array leaf is the expensive mistake
- [errors/README.md](../errors/README.md) — ST2029 (retention) and ST2028
  (structural cloning)
- [RFC 0012](../rfcs/0012-history-scoped-marker-capture.md) — scoping history for
  arbitrary branches, not just markers
