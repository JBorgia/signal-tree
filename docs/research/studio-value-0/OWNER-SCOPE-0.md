# OWNER-SCOPE-0 — SUPERSEDED

> # ⚠️ THIS RESULT IS INVALID. DO NOT RESURRECT IT.
>
> ```text
> OWNER-SCOPE-0   initial conclusion: B ("filtering on ownerId is safe")
>                 status: SUPERSEDED 2026-09-10
>
> OWNER-EVIDENCE-0  final conclusion: C
>                   unowned frames exist
>                   no positive discriminator proves them ignorable
>                   -> scopeIntegrity REQUIRED
> ```
>
> The conclusion below was derived from an unsafe predicate —
> `carriesValue = next !== undefined || prev !== undefined` — and `undefined` is
> a legitimate SignalTree state value, so the shape of a payload proves nothing
> about whether a frame is evidence.
>
> **The measurement table is still valid** (seven of eight paths carry `ownerId`;
> one does not). **The conclusion drawn from it is not.**
>
> Binding result: [`OWNER-EVIDENCE-0.md`](OWNER-EVIDENCE-0.md).


> Run before repairing JOURNAL-LIVE-0 falsifier 1, because the repair rule
> depends on the answer. 2026-09-09.
>
> Suite: `packages/kernel/src/lib/internals/diagnostics/owner-scope-0.spec.ts`

## Why this had to come first

`restoration.ts:2624` warns that a write can arrive with `ownerId: undefined`
and *"an owner-filtered observer is blind to every"* such write. So a naive
filter could trade a cross-tree bug for a **missing-evidence** bug — strictly
worse for a tool whose discipline is *absence is not evidence*.

## Measurement (still valid) — but see the supersession above

```text
scalar authored             1/ 1 owned
external scalar             1/ 1 owned
transaction authored        1/ 1 owned
transaction rollback        2/ 2 owned
entity add                  2/ 2 owned
entity field authored       2/ 2 owned
entity field external       1/ 2 owned  UNSCOPED: rows (external) [no value]
entity remove               2/ 2 owned

OUTCOME B: unscoped frames exist (1) but carry NO value
        -> filtering on ownerId is SAFE for S2

        ^^^ THIS LINE IS THE INVALID CONCLUSION. The suite still prints it
            because it is the raw output; OWNER-EVIDENCE-0 overturns it.
```

Seven of eight paths carry `ownerId` on every frame. Exactly one leaks, and it
is in S2's own territory — but the leak turns out to be harmless:

```json
{ "path": "rows.A", "origin": "external", "participation": "realized",
  "ownerId": 7, "carriesValue": true,
  "before": { "id": "A", "name": "Alpha" },
  "after":  { "id": "A", "name": "Server" } }

{ "path": "rows", "origin": "external", "participation": "realized",
  "hasOwner": false, "carriesValue": false }
```

The unowned frame is a **bare collection invalidation** — no `before`, no
`after`. The frame carrying the actual `Alpha → Server` transition **is** owned.

## The repair rule (superseded)

```ts
typeof meta.ownerId === 'number' && meta.ownerId !== targetOwnerId
  -> reject
```

Filter where the owner is present. Unowned frames carry no value evidence, so
dropping them loses nothing S2 needs, and **`scopeIntegrity` is not required**.

## ⚠️ The invariant this rests on, and it is pinned

> **Every frame carrying value evidence carries an owner.**

`INVARIANT: every value-carrying frame is owned` asserts it. If it ever fails, a
filter begins discarding real evidence and the journal needs a
`scopeIntegrity: 'complete' | 'incomplete-unscoped-writes'` coverage signal
instead of a filter.

The test is deliberately non-vacuous: an earlier draft compared against a suffix
the report never emitted, so it could not have failed. That was fixed before the
result was recorded — the second vacuous-test near-miss in this research line,
after JOURNAL-LIVE-0's bare-tree harness.

## Not yet decided

This authorises the **scoping** repair only. Whether `createDiagnosticJournal`
is adopted at all still depends on FLUSH-0 and the remaining falsifiers.
