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
