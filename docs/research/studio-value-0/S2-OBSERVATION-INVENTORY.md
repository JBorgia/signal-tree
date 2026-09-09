# S2 — authored → realized/external truth: inventory

> Inventory-first rule (`MUTATION-OBSERVABILITY-0`), same as S1. Conducted
> 2026-09-09 against `packages/kernel` at `3937f8d1`.
>
> Status: **inventory only. Nothing designed or built.**

## Verdict

**S2 is not S1 with a wider filter. It is a different shape of slice.**

S1 read a history the kernel was *already retaining*, so it cost nothing when
unused and needed no capture. **Realized writes are retained nowhere.** S2 must
therefore *capture*.

⚠️ **CORRECTED 2026-09-09.** An earlier revision of this document said capture
"revives the ≤1% budget". That was wrong, and the error mattered enough to keep
visible. See §D.

## A. The semantic facts already exist and are first-class

`lib/mutation-types.ts`, shipping today:

```ts
type WriteParticipation = 'authored' | 'realized' | 'inspection';

interface WriteMetadata {
  origin?: 'restoration' | 'devtools' | 'external' | 'transaction-rollback';
  // ...
}
```

`participation` and `origin` are **deliberately independent axes** — the kernel's
own doc: *"Two writes with the same origin can participate differently, and two
writes with different origins can share a participation — `restoration` and
external truth both realize."*

That is exactly S2's question, already modelled. It is not something Studio has
to invent or infer.

Live producers stamping it:

| Producer | Stamps |
|---|---|
| `enhancers/restoration/restoration.ts:1854` | `participation: 'realized'` |
| `enhancers/serialization/serialization.ts:920, 1283` | `{ origin: 'external', participation: 'realized' }` |

Both facts already ride `PathNotifier`'s handler signature
(`origin` positionally, `participation` inside `meta`).

## B. ⚠️ Realized writes are retained NOWHERE

This is the finding that reshapes the slice.

`causal-runtime/transaction-capture-bridge.ts` and the live capture in
`transactions.ts:1489` both **exclude** them:

```ts
if (getWriteParticipation(meta) === 'realized') return;
```

Correctly so — a realization is not part of a transaction's authored
contribution. But the consequence is that `confirmedTurns`, the entire basis of
S1, **contains authored effects only**.

```text
S1   read a history that already existed        capture cost: none
S2   the history does not exist                 capture required
```

## C. `createDiagnosticJournal` already captures exactly this — and is unwired

`lib/internals/diagnostics/diagnostic-journal.ts`:

```ts
interface DiagnosticEffect {
  path; ownerPath;
  origin?: WriteMetadata['origin'];
  participation?: WriteMetadata['participation'];
  transactionId?; subjectIds; positionIds; before; after;
}
```

Per-effect `origin` **and** `participation`, turn-grouped at the engine's own
flush boundary (*"the engine's own boundary (DIAG-JOURNAL-0 case 8), not a finer
one invented here"*), and **bounded by construction** — `maxTurns` 50,
`maxTransactionEvents` 200, oldest evicted.

Status: **no non-spec importer, and not exported from `index.ts`,
`/internals` or `/adapter`.** Opt-in machinery nobody wires — the same trap that
misled the S1 inventory, so it is flagged rather than assumed usable.

Notably it is *bounded*, where `confirmedTurns` is not. If S2 adopts it, Studio
inherits a truthful retention story for free — and `retention.truncated` stops
being permanently `false`.

## D. Capture is write-path work — but that is NOT the deferred budget

The journal does:

```ts
notifier.subscribe('**', (next, prev, path, ownerPath, origin, ...) => {
  (open ??= []).push({ path, ownerPath, origin, participation, ... });
});
```

**A `DiagnosticEffect` allocated per write while subscribed.**

⚠️ **This is not the deferred ≤1% trigger, and conflating them would be a
category error.** That budget asks: *does unused/disabled Studio impose work on
ordinary SignalTree execution?* An allocation that happens **only because a
developer explicitly enabled capture** is not disabled overhead — it is
instrumented DevTools mode, which is supposed to cost something.

The trigger fires only if S2 adds a branch or allocation to every write **while
capture is off**.

Three states, three different standards:

| State | Requirement |
|---|---|
| S2 present, capture **off** | The zero-cost-unused contract, unchanged. The ≤1% trigger applies here and only here — if idle hot-path work appears. |
| S2 capture **on** | Measure overhead and memory honestly, against a **separate instrumentation budget**. Developers deserve to know the cost; a recorder is not required to observe every write for ≤1%. |
| Studio absent from production | Still zero adapter/bridge code, as S1 proved. |

## E. Consequences for S2's design

1. **Capture is opt-in and disposable**, not implied by attachment. A tree
   attached to Studio must not start paying for realization capture until
   something asks for it.
2. **The unused path must stay structurally free** — same standard as S1: no
   subscription, no allocation, no retained journal.
3. **The attached path needs a measured number** before S2 ships. This is the
   first slice where the deferred ≤1% budget genuinely applies, and where a
   laboratory-grade benchmark is worth building — because unlike S1, there is
   real work to measure.
4. **Do not reuse `ConfirmedTurnReader`.** Realizations are not committed turns,
   and forcing them through that shape would misrepresent them. S2 wants its own
   reader over its own bounded journal, with the existing `StudioCapability`
   union widened by one member.
5. **Decide the journal's fate deliberately** — wire it, or replace it. It is
   well-built, bounded and unwired; adopting dead-but-good code needs the same
   scrutiny as writing new code, and the S1 inventory was misled once by exactly
   this pattern.

## Open questions for the S2 design pass

- Does `participation` survive into a form Studio can attribute per *value*, or
  only per write event?
- Is the flush-boundary turn grouping the right unit for "what replaced what",
  or does supersession need its own linkage?
- Should realization capture be per-tree opt-in (`attachStudio(tree, { capture:
  ['realizations'] })`) or a separate call?
- Does the journal's 50-turn default bound hold for a real investigation, and
  what does the panel say when it truncates?
