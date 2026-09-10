# S2 — authored → realized/external truth

> Decisions frozen 2026-09-09, before implementation, because each would
> otherwise be baked in by whatever the first build happened to do.
>
> Status: **decisions locked. `JOURNAL-LIVE-0` not yet run. Nothing built.**

## The question S2 answers

S1 answered *"what did this transaction commit?"*. S2 moves to:

> **What did the application author, and what did authoritative truth later
> replace?**

That is where "why is this value here?" stops being transaction inspection.

---

## S2-1 — `createDiagnosticJournal` is the capture engine, subject to falsification

**Reuse its capture machinery. Do NOT reimplement it.**

Writing a second observer over the same `origin`, `participation`, address,
before/after and flush boundaries would give the repository two implementations
of one semantic observation problem, which eventually diverge:

```text
PathNotifier
   |- diagnostic journal
   `- Studio realization capture      <- do not build this
```

Instead:

```text
PathNotifier -> createDiagnosticJournal -> kernel capture interface
             -> studio-adapter normalization -> Studio S2 schema
```

**But `DiagnosticTurn` must never become Studio's protocol.** A wrapper owns the
boundary, so replacing the journal later costs Studio nothing:

```ts
interface RealizationCapture {
  snapshot(): RealizationCaptureSnapshot;
  dispose(): void;
}
```

### ⚠️ JOURNAL-LIVE-0 — do not trust it because it has tests

It is unwired, well-tested code — the exact pattern that misled the S1
inventory. It gets a live importer only after these falsifiers pass:

```text
1. two trees writing identical paths   -> NO cross-tree capture
2. serialization external realization  -> origin=external, participation=realized,
                                          exact path/ownerPath/before/after
3. restoration realization             -> participation=realized,
                                          origin stays 'restoration', NOT 'external'
4. transaction + realization compose   -> no duplicate or missing effects
5. entity field realization            -> address identifies the FIELD, not the row
6. dispose()                           -> subsequent writes captured nowhere
7. retention overflow                  -> oldest data really gone, truncation reported
```

**#1 is the one to weight.** `NOTIFIER-SCOPE-0` was exactly this class of bug in
this repository, and accepting `createDiagnosticJournal(tree, …)` as tree-scoped
because it *takes a tree* is precisely the assumption that failed before.

Outcome rule: if a falsifier fires because the journal's **model** is wrong,
stop and replace or extract. If it needs a **narrow correctness repair**, repair
it independently — as its own kernel fix, like `CausalEffect.path` was — and
then adopt it.

### JOURNAL-LIVE-0 RESULT — 2026-09-09

Suite: `packages/kernel/src/lib/internals/diagnostics/journal-live-0.spec.ts`

**Falsifier 1 FIRES. The journal captures other trees' writes.**

Verdict per the rule above: **narrow correctness repair, then adopt.** Not a
model problem, because the kernel already has the mechanism and the journal is
simply the one authority consumer not using it.

`WriteMetadata.ownerId` exists for exactly this, and says so:

> `NOTIFIER-SCOPE-0`. The path notifier is process-global and every AUTHORITY
> consumer subscribes with `'**'`, so restoration and transactions receive
> writes belonging to OTHER trees. **Delivered here so they can decline them**:
> `positionId` alone cannot say which tree it indexes.

It is stamped broadly — `signal-tree.ts:207` on the core write path,
`entity-map.ts:262`, plus restoration and transactions — and both
`restoration.ts:3380` and `transactions.ts:1489` decline on it. The journal
never checks it.

⚠️ **The repair is not a one-line filter.** `restoration.ts:2624` records a
hazard directly on this path: a write can arrive with `ownerId: undefined`, and
*"an owner-filtered observer is blind to every"* such write. So the repair must
decide deliberately what an absent owner means — dropping them silently would
trade a cross-tree bug for a missing-evidence bug, which is worse for a tool
whose entire discipline is *absence is not evidence*.

Tracked as its own kernel fix. Not bundled into S2.

### ⚠️ PRECONDITION — capture needs a flush driver

Found while building the harness, and it nearly invalidated the whole suite.

The journal materializes a turn on a **notifier flush**, and nothing drives one
on a bare tree — `path-notifier` names restoration as the flush source. A first
harness on a bare `signalTree` captured **nothing**, which made falsifier 1 pass
**vacuously**. A falsifier that cannot fail is worse than no falsifier.

So S2 capture carries a composition dependency: it observes only trees whose
composition drives notifier flushes. That must be **declared as a capability
precondition**, not assumed — a tree without it would show an empty realization
history that looks exactly like "no realizations happened."

The suite now pins the precondition as test 0, so the falsifiers can never go
vacuous again.

## S2-2 — `attachStudio` stays discovery/inspection only

```text
attachStudio(tree)   !=   start recording the application's writes
```

`attachStudio` means *this tree may be inspected*. Capture means *start paying
runtime and memory to retain evidence the kernel does not otherwise keep*.
Different operations, and merging them would destroy a property S1 earned:

```text
attached tree + no S2 capture requested
  -> no realization journal, no S2 retention, no S2 per-write allocation
```

## S2-3 — capture is a separate, explicit, disposable lease

```ts
const attachment = attachStudio(tree, { label: 'AppTree' });

const capture = startStudioCapture(attachment, {
  capabilities: ['realizations'],
  maxTurns: 50,
});

capture.dispose();
```

**Ref-counted**, so one consumer cannot tear observation out from under another:

```text
A starts capture, B starts capture
A disposes   -> journal stays alive
B disposes   -> journal disposed
```

`attachStudio(tree, { capture: ['realizations'] })` is **not** in S2. It may
arrive later as convenience sugar that compiles down to this primitive — it must
never become the primitive.

## S2-4 — capture OFF preserves zero-cost-unused

Same standard S1 met, pinned the same way. No subscription, no allocation, no
retained journal, no idle branch on the write path.

## S2-5 — capture ON has its own instrumentation budget

⚠️ **The deferred ≤1% disabled-overhead threshold does NOT automatically apply
to intentionally enabled recording.** That budget asked whether *unused* Studio
taxes ordinary execution. A recorder the developer switched on is supposed to
cost something.

Measure and publish capture-on overhead and memory before shipping S2 —
developers deserve the number — but do not require a DevTools recorder to
observe every write for ≤1% unless that is independently decided to be a product
requirement.

The ≤1% trigger still fires if S2 adds idle hot-path work while capture is off
(S2-4).

## S2-6 — retention must distinguish two different absences

`truncated` alone is **necessary but not sufficient**. Capture starting late is
not the same fact as evidence being evicted:

```text
tree created        capture begins              now
    |-------------------|-------------------------|
      NOT OBSERVED           OBSERVED
```

A fresh journal reports `truncated: false` while still holding **no history from
tree start**.

```ts
interface CaptureCoverage {
  readonly truncated: boolean;             // captured data was later evicted
  readonly completeFromTreeStart: boolean; // capture began at tree creation
}
```

```text
lazy capture, nothing evicted   { truncated: false, completeFromTreeStart: false }
  -> "Capture began after application startup. No captured realization
      events have been evicted."

ring rolled over                { truncated: true,  completeFromTreeStart: false }
  -> "Earlier captured realization events have been evicted.
      Showing the most recent 50 turns."
```

Same discipline as everywhere else: **absence is not evidence**, and the UI must
never imply history exists.

## S2-7 — support and capture-active are independent

S1 needed only available/unavailable. S2 has three states, and collapsing the
middle one into "unsupported" would be a lie:

```text
realizations: unsupported
realizations: supported, capture inactive
realizations: supported, capture active
```

```text
Realization history

Supported by this tree
Capture not active

No historical realization evidence is available before capture begins.
```

---

## S2-8 — what S2 may claim about supersession (frozen by SUPERSESSION-0)

Outcome: **WEAK**. `SUPERSESSION-0.md` has the evidence.

**Licensed:**

> "10200 replaced the previously visible value 9800 at `cart.total`. It arrived
> as external truth, not authored work."

**Not licensed:**

> ~~"The server corrected Transaction 31."~~

External realizations carry no `transactionId`; nothing in the evidence names a
transaction. The value-level predecessor is the **last** value, never the most
interesting one.

⚠️ **Consequence for the visualization.** The external-truth arrow may point at a
**value**, never at a **transaction**. Drawing "T31 was corrected" would be a lie
the UI invented, and the picture being more compelling that way is exactly why
the arrows were not formalized before this ran.

**Entity fields (case 3).** An authored entity-field write addresses
`rows.A.name`; an external `updateOne` addresses `rows.A` with whole-object
before/after. Field-level supersession is **derivable by diffing** but was not
addressed by the kernel — so it is DERIVED BY INSPECTOR (§8.3) and must be
labelled, never presented as a shipped semantic fact.

## S2-1 SUPERSEDED by FLUSH-0 — the journal is NOT adopted

FLUSH-0 returned **outcome D**. `createDiagnosticJournal` is prior art, not the
primitive:

- **case 3** — three synchronous realized writes share no identifier at all, so
  no shipped fact groups them. S2 must not manufacture a "realization turn".
- **case 7** — writes are delivered individually with no flush. The journal's
  `onFlush` buffering was a dormant module's packaging choice, not a semantic
  boundary.
- **case 2** — one raw frame already carries S2's entire required fact.

Therefore the `ownerId` repair is **no longer necessary**. OWNER-SCOPE-0
authorized it; FLUSH-0 removed the reason. It stays a real kernel defect,
tracked on its own merits — **do not repair dead machinery for Studio's sake.**

## S2-10 — scope integrity (frozen by OWNER-EVIDENCE-0)

An unowned frame **cannot** be classified as non-evidence. No positive
discriminator exists: `subjectIds`, `positionIds`, `ownerPath` and meta-key
presence are identical on owned and unowned frames, and `path === ownerPath` is
true for scalar leaves too.

```text
ownerId present, matches    -> attributable
ownerId present, differs    -> reject
ownerId absent              -> CANNOT ATTRIBUTE; never guess
```

So capture reports:

```ts
scopeIntegrity: 'complete' | 'incomplete-unscoped-writes'
```

> "Some observed writes could not be assigned safely to this tree. This capture
> is incomplete."

Better than cross-tree pollution, and better than silently dropping evidence and
presenting the remainder as complete.

⚠️ This **reverses** OWNER-SCOPE-0's conclusion, which used
`before/after === undefined` as proof of non-evidence. `undefined` is a
legitimate state value; the shape of a payload proves nothing.

## S2-11 — supported compositions are deliberately narrow

FLUSH-0 measured that `entityMap` writes are observable with **no** enhancers,
while scalar leaves are not. **S2 does not expose that partial coverage.**

```text
transactions() present   -> supported
restoration() present    -> supported
neither                  -> UNSUPPORTED
```

Even though some entity effects would be observable, supporting them while
silently missing scalar leaves is exactly the partial-history trap. Support less
and refuse loudly. A later composition-widening slice can turn `unsupported`
into truthful partial or full structural coverage once the whole matrix is
proven.

Three states, and an empty history exists in only one of them:

```text
UNSUPPORTED         this composition cannot provide complete observation
SUPPORTED/INACTIVE  available, capture has not started
SUPPORTED/ACTIVE    recording  -> [] truthfully means
                                  "no realized writes since capture began"
```

## S2-9 — the real capability precondition (frozen by FLUSH-0)

Not flush. **Leaf interception.**

```text
bare / batching()                 scalar writes UNOBSERVABLE
restoration() or transactions()   scalar writes observable
entityMap                         observable with no enhancers
```

> **Scalar realization coverage requires a tree composed with `restoration()`
> or `transactions()`. Entity/structural realization does not.**

⚠️ A tree with neither must report realizations as **unsupported**, never as an
empty history — an empty list there is indistinguishable from "no realizations
happened", which is the absence-is-not-evidence failure this project keeps
refusing.

## S2-12 — schema frozen and implemented (2026-09-10)

`packages/studio-adapter/src/realization/`. **Three independent axes**, because
collapsing them is how a tool starts implying history it does not have:

```ts
support:   'unsupported' | 'supported/inactive' | 'supported/active'
coverage:  { completeFromTreeStart: false; scopeIntegrity; startedAtSequence }
retention: { capacity; retained; truncated; first/lastRetainedSequence }
```

- `completeFromTreeStart` is typed **`false`**, not `boolean`. Studio has no
  mechanism that can *prove* capture preceded all activity, and "we installed it
  early" is not proof. Widening the type later must be a deliberate act with a
  mechanism behind it.
- `scopeIntegrity: 'complete'` means **only**: among frames observed during this
  capture, none that could be semantic lacked trustworthy ownership. It does not
  mean capture began at tree creation, that nothing was evicted, or that the
  composition is fully observable — those are the other two axes.
- An unowned frame is **neither attributed nor silently dropped**: it degrades
  integrity, and degradation is sticky.

Which produces the honesty boundary:

```text
complete   + effects: []   -> "no realizations since capture began"
incomplete + effects: []   -> "no ATTRIBUTABLE realizations were retained;
                               some observed activity could not be assigned"
```

13 tests, each invariant paired with an **R1 positive control** proving it can
fail.

## S2-13 — capture economics: PARTIALLY CLOSED

**Frozen on evidence:**

```text
✓ capture is explicit, never automatic
✓ capture OFF has no observer or retention work
✓ maxEffects bounds retained effect count
✓ eviction demonstrably bounds retained memory  (200@cap50 = 8.9MB vs 35.2MB)
✓ before/after are immutable snapshots           (CAPTURE-VALUE-0)
✓ dispose releases retained evidence             (CAPTURE-DISPOSE-0)
✓ capture cost is GRAPH-SHAPE sensitive, ~12x at equal logical size
```

**Explicitly open, and deliberately NOT built:**

```text
○ no bound on the complexity of a single captured value
○ no total retained graph-complexity budget
○ bounded-snapshotter design
```

⚠️ `maxValueBytes` is **rejected** — bytes are not the cost driver, and sizing a
value requires the traversal being guarded against (`CAPTURE-SHAPE-0`).

A node-budget snapshotter is a genuine subsystem — what counts as a node,
whether repeated references count once, Map/Set/typed-array semantics, cycles,
depth exposure, aliasing under truncation, preview retention — and building it
now would become another research branch before Studio answers its first useful
question. **Let real session use establish whether it is needed.**

The query model operates on `CapturedValue` as it stands and must respect the
discriminator rather than reaching for `effect.after.value`. If bounded
snapshots later prove necessary, adding a third variant —
`{ kind: 'truncated', reason: 'complexity-limit', … }` — is natural schema
evolution and is **not** added speculatively.

## Next

1. Capture **lease** wiring (`startRealizationCapture`), refusing immediately
   with `STUDIO_CAPABILITY_UNAVAILABLE` on an unsupported composition — never a
   partial start.
2. Live-tree proof: supported, unsupported, empty-active, external, restoration,
   unowned degradation, disposal, eviction.
3. Capture-**off** structural proof; capture-**on** characterization.
4. `UNSCOPED-IMPACT-0` before multi-tree is claimed trustworthy — when an
   unowned frame occurs while several captures are active, which can be *proven*
   affected? Likely answer: none can, so all active captures degrade. Ugly but
   truthful, and an independent argument for fixing the kernel ownership defect.
5. Query model, then UI.

⚠️ **No hub yet.** `scopeIntegrity` sharpens the multiplexer argument, but an
unowned global frame gives no way to know *which* tree's integrity to degrade —
a hub has the same epistemic problem as per-tree observers and is harder to
study. Measure the simple version first.
