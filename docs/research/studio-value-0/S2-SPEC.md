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

## Next, before the S2 query model

1. **Run `JOURNAL-LIVE-0`.** Adopt, repair, or replace on the evidence.
2. **Flush-boundary grouping versus actual supersession.** This determines
   whether S2 yields a realization *log* or can truthfully say *"this
   authoritative value replaced that authored value."* Investigate before
   designing the query model — it is the difference between S2 being useful and
   S2 being a second timeline.
3. Settle the coverage/retention schema against whatever (2) concludes.
