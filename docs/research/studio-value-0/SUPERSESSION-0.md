# SUPERSESSION-0 — preregistration

> **Written before running.** Frozen 2026-09-09.
>
> Decides whether S2 is *"authored → superseded → current truth"* or merely
> *"realization history"*. Those are different product claims and the difference
> is not cosmetic.

## Property under test

> Given an authored write to location `L` followed by a realized write to `L`,
> does **existing live kernel evidence** contain a truthful referent linking the
> realization to the authored consequence it superseded?

"Existing" is load-bearing. Evidence Studio would have to *add* does not count;
that would be designing the answer instead of measuring it.

## Cases

```text
1. plain scalar                    authored L, then realized L
2. transaction-authored scalar     T authored L, then realized L
3. entity field                    row field authored, then realized
4. intervening authored write      the adversarial case, below
5. same-value realization          realized value equals the authored one
6. realization after an unrelated transaction
7. two-tree collision              same path, two trees
```

### Case 4 is the one that decides it

```text
T31 authored  L = 9600
T32 authored  L = 9800
R44 realized  L = 10200
```

The truthful value-level predecessor is **9800**.

⚠️ If Studio links `R44` to `T31` because T31 is the *interesting* transaction,
the model is wrong. Whether R44 was **caused by** T31 is a separate question
requiring correlation evidence that path adjacency cannot supply.

## Outcomes — frozen

**STRONG.** Existing metadata identifies the exact prior authored consequence
being superseded — a referent, not an inference from path plus temporal
adjacency.

> Studio may say: *"the server corrected Transaction 31."*

**WEAK.** The kernel proves only local state succession:

```text
L: A → B   authored
L: B → C   realized
```

> Studio may say: *"C replaced the previously visible value B at L."*
> Studio may **NOT** say: *"the server corrected Transaction 31."*

**FAILURE.** Even same-location succession cannot be reconstructed reliably —
flush grouping, missing identity, structural addressing or intervening writes
destroy the relationship.

> S2 is a realization/event timeline, not a supersession model.

## Stop condition

⚠️ **If the strong causal referent is absent, do not invent one.** Record the
weaker contract and build on it.

The temptation here is specific and worth naming in advance: the visualization
direction (a realization arriving from outside and *correcting* a transaction)
is more compelling under STRONG. That is precisely why the visual arrows must
not be formalized as product truth until this experiment says what they mean.
Designing the evidence to fit the picture is the failure mode this whole
research line exists to prevent.

## What gets recorded either way

- the outcome, with the evidence that produced it
- the exact sentence S2 is licensed to say about supersession
- whether case 4 can be answered truthfully at the value level
- whether `transactionId` survives onto realized writes, and if so from which
  producers (rollback compensation is known to carry it; external realization is
  the open question)


---

# RESULT — 2026-09-09

Suite: `packages/kernel/src/lib/internals/diagnostics/supersession-0.spec.ts`

## Outcome: **WEAK**

Local state succession is provable and truthful. **No referent links a
realization to the authored consequence it superseded.**

External realizations declare `{ origin: 'external', participation: 'realized' }`
and **carry no `transactionId`** — measured, and consistent with `external()`'s
own design: it *merges* onto ambient context, so a `transactionId` appears only
when an ingress happens to land inside a transaction callback. Standalone
external truth has none, because external truth does not know about transactions.

## The sentence S2 is licensed to say

> **"10200 replaced the previously visible value 9800 at `cart.total`.
> It arrived as external truth, not authored work."**

## The sentence S2 is NOT licensed to say

> ~~"The server corrected Transaction 31."~~

Nothing in the evidence names either transaction. Saying it would be inventing
causation from interestingness — the exact failure case 4 was written to catch.

## Case 4 answered truthfully

```text
T31 authored  L = 9600
T32 authored  L = 9800
R44 realized  L = 10200
```

Measured on the realization: `before: 9800`, `after: 10200`,
`transactionId: undefined`.

The value-level predecessor is **9800** — the last value, not the interesting
one. Studio can state that correctly, and can name **neither** transaction.

## Per-case results

| # | Case | Result |
|---|---|---|
| 1 | plain scalar | classified `external`/`realized`; no referent; `before` truthful |
| 2 | transaction-authored then realized | realization carries **no** back-reference to the turn |
| 3 | entity field | ⚠️ addresses the **ROW** (`rows.A`), whole-object before/after |
| 4 | intervening authored write | predecessor is the last value; no transaction named |
| 5 | same-value realization | still classified realized, not authored |
| 7 | two-tree collision | `ownerId` present; trees distinguishable from evidence |

### Case 3 is its own constraint

An **authored** entity-field write addresses `rows.A.name` (per
`pending-rollback`'s own doc). An **external** `updateOne` addresses `rows.A`
with whole-object before/after.

Field-level supersession is therefore **derivable by diffing the row**, but it is
not what the kernel addressed. ⚠️ **S2 must not present a derived field diff as
though the kernel addressed the field** — that is a DERIVED BY INSPECTOR fact
(§8.3), not a SHIPPED SEMANTIC FACT, and must be labelled as such.

## Stop condition honoured

No causal referent was invented. The visualization direction is more compelling
under STRONG — a realization arriving to *correct* a transaction — and that is
precisely why the arrows were not formalized first.

**What this means for Pulse:** the external-truth arrow may point at a *value*,
never at a *transaction*. `9600 → superseded` is truthful only as
"previously visible value"; drawing it as "T31 was corrected" would be a lie the
UI invented.

## What would make STRONG reachable later

Not proposed, only recorded so the option is not lost: a correlation identifier
carried from the authored operation through the external round trip — the
fixture backend already emits `requestId` / `cartRevision` for exactly this. That
is **application-supplied correlation**, not kernel semantics, and S2 must not
imply the kernel provides it.
