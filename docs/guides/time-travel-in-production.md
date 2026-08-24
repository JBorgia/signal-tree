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

Since 13.5.0, `tree()` is memoised and structurally shared — materialisation
rebuilds only the nodes beneath a signal that actually changed, and clean
subtrees come back **by reference**. A history entry is therefore a pointer graph
over shared structure, not a copy.

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
signalTree({ rows: entityMap({ selectId: (r: Row) => r.id }) },
           { enhancers: [restoration()] });

undoable(() => tree.$.draft.title.set('edited'));   // THIS is reversible
tree.$.rows.setAll(serverRows);                     // this is not
```

The original text is kept below because the memory arithmetic it reports is still
the reason the lever existed.

<details><summary>as it read before 15.0</summary>

A collection can persist and serialise while staying **out of the undo stack**:

```ts
signalTree({
  // 50,000 server-owned rows: saved and restored, never undone
  rows: entityMap({ selectId: (r) => r.id, recordHistory: false }),
  // the small editable state the user actually undoes
  draft: { title: '', tags: [] as string[] },
}, { enhancers: [restoration({ maxHistorySize: 50 })] });
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

### 2b. `form()` now records under `restoration()`, but scoped form history is still the better UI default

The old guidance here is stale. Form field writes now announce back onto the form path,
so a tree with `restoration()` attached records and undoes direct `form()` edits again.

That does **not** make scoped form history obsolete. `form({ history: history() })`
is still the cleaner choice when undo authority should stay inside the panel or draft
being edited rather than join the app-wide stack.

Today the practical rule is:

- Use global `restoration()` when form edits should participate in the same global undo
  stream as neighbouring tree writes.
- Use `form({ history: history() })` when the form wants its own local undo model,
  independent of unrelated app activity.

The old defect harness was correct when it reported missing form participation. The
current source has moved past that specific defect; what still deserves product-level
judgement is global-vs-scoped undo semantics, not raw form invisibility.
Use the form's **own** scoped stack when the form should undo locally rather than as
part of the app-wide history stream:

```ts
signalTree({
  rows: entityMap({ selectId: (r) => r.id }), // server-owned; nothing designates it
  profile: form({ initial: { name: '' }, history: history() }), // undoable, scoped
}, { enhancers: [restoration({ maxHistorySize: 50 })] }); // covers plain branches only

tree.$.profile.history?.undo(); // reverts the field — this is the working path
```

Global `restoration()` now records direct form writes too, so this is a UX boundary
choice rather than a correctness escape hatch.

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
the window's duration. Verified: an unrelated `tree.$.rev.set(999)` inside a paused window
was suppressed too. A synchronous `for` loop has sole ownership by construction; a
multi-second `mergeMap` over N HTTP requests does not.

**What to do instead, today:** nothing. Writes that share a microtask are already one
entry — a 25-row import in a synchronous loop records one step and `undo()`/`redo()`
round-trips it. Verified after removal: 25 `addOne` calls → 1 entry, undo → 3 rows,
redo → 28.

**What is coming:** that microtask boundary is decided by whether a caller happens to
`await`, which is an accident rather than a design. Intent-scoped grouping is a
transaction handle — see
[history-the-greenfield-target.md](../architecture/history-the-greenfield-target.md).

### 4. ~~Drop uninteresting transitions — `shouldSkip`~~ — REMOVED in 15.0

**Gone, and for the same reason as lever 2.** `shouldSkip` filtered transitions
AFTER they were recorded by default. Under opt-in designation a cursor move is
never an undo step in the first place, because nobody designated it:

```ts
// 15.0 — no predicate, and no per-write comparator cost
tree.$.ui.cursor.set(next);              // not designated -> not an undo step
undoable(() => tree.$.doc.body.set(v));  // designated -> one undo step
```

That also removes the cost warning this section used to carry: there is no
comparator running on every recorded write, because there is no
record-then-filter step.

## Composition patterns, and whether they hold up

<!-- measured: the 100 ms sampling interval is a source constant — `setInterval(handleChange, 100)` at packages/core/src/lib/audit/audit.ts:156 (and :160). Cited rather than benchmarked on purpose: a constant breaks greppably when someone changes it, where a timing run only breaks when re-run. -->
<!-- measured: node tools/verify-history-defects.mjs — reproduces the CONSEQUENCES by outcome (every check calls undo() and inspects state): the fixed form-coverage behaviour, that write-then-revert pairs are dropped, and the maxHistorySize fallback. It does NOT measure the 100 ms figure — its sleeps are chosen from the constant above. -->

| What you are building                                 | Pattern                                                                              | Supported                                                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Editor undo over a small document                     | `maxHistorySize`; designate document edits with `undoable()` and leave caret/selection undesignated | Yes                                                                                              |
| Bulk-edit grid with cancel                            | `transaction()` — `confirm()` or `rollback()`                                        | Yes, and independent of `restoration`                                                                                                |
| Undo one panel, not the whole app                     | designate only the panel's operations with `undoable()`                              | Yes                                                                                                                                 |
| Large server collection + small editable **branch**   | apply the collection with `external()`; designate the branch's edits with `undoable()` | Yes — the headline pattern                                                                                                        |
| Large server collection + small editable **`form()`** | `external()` for the collection beside `form({ history: history() })`                | Yes. Prefer scoped form history when the form should undo independently; global `restoration()` also records direct form writes now. |
| Optimistic write, roll back on error                  | `undo()` in the error path, or `jumpTo(getCurrentIndex() - 1)`                       | Yes — only if nothing else recorded in between                                                                                      |
| Import/generate, then one undo                        | —                                                                                    | **No.** `pauseRecording()` was removed in 14.1.1 (see lever 3) and has no replacement                                               |
| Audit trail rather than undo                          | `createAuditCallback()` or `getRestorationHistory()`                                            | Yes. **Not `createAuditTracker()`** — it samples on a 100 ms timer and drops write-then-revert pairs                                |
| Show the user how far they can go                     | `getCurrentIndex()` back, `getRestorationHistory().length - 1 - getCurrentIndex()` fwd          | Yes — reactive since 14.0.0                                                                                                         |
| Undo per entity, independently                        | —                                                                                    | **No.** elf has this; we do not                                                                                                     |
| Collaborative editing                                 | A CRDT (Yjs, Automerge) underneath — undo is per-user, not per-document              | **Not a store feature.** Don't                                                                                                      |

## Reactive readers, and why that mattered

`canUndo()`, `canRedo()`, `getRestorationHistory()` and `isRecordingPaused()` are **signals
since 14.0.0**. Before that they read plain values, so
`computed(() => tree.canUndo())` evaluated once and cached `false` forever — an
undo button in a zoneless app never enabled. If you are on 13.x and your undo
button looks dead, that is the bug.

## A starting configuration

```ts
export const appTree = signalTree({
  rows: entityMap({ selectId: (r: Row) => r.id }),
  draft: { title: '', body: '' },
  ui: { cursor: 0, hovered: null as string | null },
}, { enhancers: [restoration({ maxHistorySize: 50 })] });

// Only designated operations are reversible.
undoable(() => appTree.$.draft.title.set(title));

// Neither of these enters the undo stack — no option required.
appTree.$.ui.cursor.set(next);
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
