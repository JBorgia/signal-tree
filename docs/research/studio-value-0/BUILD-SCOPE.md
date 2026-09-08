# STUDIO-VALUE-0 — two-app build scope

> **Disposition: INVESTIGATION. Non-shipping.** The admissible discriminator
> after the synthetic control was ruled invalid. **Last artificial debate on this
> question — build it, capture untouched evidence, let the comparison decide.**

## Shape

One tiny application, built twice, against one shared backend.

```text
                 SAME BACKEND
                       |
        +--------------+--------------+
        |                             |
    NgRx arm                   SignalTree arm
  @ngrx/store                  signalTree()
  @ngrx/effects                + minimal Studio inspector
  @ngrx/store-devtools
```

Domain is one cart. Nothing more.

```text
cart 88213: subtotal, promoCode, discount, total, status, serverRevision
```

**No AI. No provenance. No compliance.** Those distractions are already paid for.

## The scenario

```text
1. user applies SAVE20
2. client performs an OPTIMISTIC update
3. server validates and applies a DIFFERENT authoritative discount (tier cap)
4. client reconciles
5. later, a backend maintenance push expires the promo
6. the push clears promoCode + discount and FAILS to recompute total
7. UI ends internally inconsistent: total reflects a discount no longer present
```

Naturally exercises local authored state, optimistic state, server truth,
reconciliation, derived values, async effects, a remote push, a later overwrite,
and a current-state inconsistency.

## Four design issues to settle BEFORE writing code

Raised now because each one can silently decide the result.

### RESOLVED 1 — the optimistic update IS one atomic operation, in both arms

**Decision: build it atomically in both arms.**

```text
NgRx           ONE action, ONE reducer, three fields
SignalTree     ONE transaction, three locations
```

Not rigging. A competent implementation does this anyway — you do not want a UI
frame showing `promoCode: SAVE20` with `total` still 120.00. Choosing three
independent writes would be the *unrealistic* option, and it would delete Q5 by
accident rather than by decision.

Q5 ("what changed atomically?") therefore stays a live discriminator, and both
arms have an honest answer available.

### RESOLVED 2 — drop the coalescing trap; score Q6 as an ordinary question

**Decision: do NOT contrive a within-transaction repeated write.**

The realistic scenario has none: `discount: 0 → 24 → 18` spans a network round
trip, so both arms observe all three values. Forcing an artificial
within-transaction repeat purely to hit a known SignalTree behaviour is the same
rigging error in a new costume — designing the incident around the candidate's
characteristics.

Q6 becomes an ordinary question both arms should answer correctly. The honesty
dimension is preserved by **Q10** ("what information is genuinely missing"),
which tests counterfactual completeness without a planted trap. An arm that
claims to see an intermediate value that does not exist still scores as a
failure.

### 1. (superseded — see RESOLVED 1 above)

Step 2 sets `promoCode`, `discount` and `total` together — but only if it is
*implemented* as one operation. If it is three independent writes, **SignalTree
has no atomicity story to tell** and question 5 ("what changed atomically?")
evaporates as a discriminator.

**Decide deliberately:** either the optimistic update is a genuine SignalTree
transaction and an NgRx single-action reducer, or drop the atomicity question.
Do not let it be settled by implementation accident.

### 2. (superseded — see RESOLVED 2 above)

`discount: 0 → 24 → 18` spans a network round trip, so both arms observe all
three values. That is **not** the within-transaction repeated write that MO-1B
proved is destroyed by design.

So question 6 ("which intermediate values did not survive?") is **answerable by
both arms here** — it is no longer the honesty trap it was in the synthetic
design. Either add a deliberate within-transaction repeated write to restore the
trap, or drop the trap framing and score Q6 as an ordinary question.

### 3. The SignalTree arm's observation path is a choice that changes the result

`MUTATION-OBSERVABILITY-0` is unresolved: `PathNotifier` misses direct leaf
writes, `interceptLeafSignals` misses transacting trees. **If step 2 uses
`transactions()`, the observable channel changes.** The inspector's reach is
therefore a consequence of an implementation decision, not of SignalTree's
inherent capability.

Label every fact the inspector uses:

```text
SHIPPED SEMANTIC FACT        exists in 15.0.0 today
RESEARCH-ONLY OBSERVATION    hook added for the experiment
DERIVED BY INSPECTOR         computed from the two above
```

**A conclusion resting on a RESEARCH-ONLY hook is not a Studio capability claim.**
This is what stops the experiment quietly crediting Studio for hypothetical
kernel features.

### 4. The NgRx arm is still authored by an interested party

Building it for real fixes the *evidence* problem — a genuine DevTools export
has store-init, router actions, whole-tree diffs, hundreds of entries. It does
**not** fix the *design* problem: action granularity, where computation lives,
selector design and payload completeness are all still our choices, and the
review showed our choices land where they favour SignalTree.

**Mitigation: have an NgRx practitioner who is not invested in SignalTree either
build or review the NgRx arm before any run.** Without that, expect a third
finding of the same shape.

## Instrumentation rules

**Backend** provides realistic observability only: `requestId`, `traceId` /
`spanId`, per-aggregate cart revision, structured logs, OTel, push message id.

> **No conclusions in log messages.** No `"promo expired without
> recomputation"`, no `knownIssue: PRICE-441`. That gave the last incident away
> at the exact millisecond it happened.

**NgRx arm** gets every cheap, normal improvement a competent team would have —
request/success/failure triads, fully specified payloads, source-oriented action
names, effects for side effects, selectors for derivation, runtime checks,
correlation metadata on every action. **Do not make NgRx stupid.** If good
instrumentation makes the bug trivial, that is the answer.

The line:

```text
normal competent instrumentation        YES
purpose-built SignalTree clone          NO
```

If the control starts needing generic mutation interception, authored/external
classification, transaction net-effect modelling, or state-consequence lineage —
**document that separately**, because it means the control is rebuilding the
candidate abstraction. Do not assume it will.

**SignalTree arm** uses SignalTree naturally, hits the same backend, carries the
same defect. The inspector answers exactly one question — *why is `total` 102
while `discount` is 0?* — and **must derive its explanation from real machinery**.
No hand-authored explanation strings.

## Evidence capture

Raw and untouched from both runs:

```text
NgRx            raw Redux DevTools export
                raw browser structured log
                raw OTel trace
                raw backend log

SignalTree      raw SignalTree diagnostic data
                raw browser structured log
                raw OTel trace
                raw backend log
                minimal Studio output
```

**Hash and freeze before investigation** — `sha256sum` every artifact, commit the
manifest, and record the commit in this file. Then hand the evidence to someone
who built neither arm.

## Questions, both arms

```text
 1. Why is total currently 102?
 2. Which operation produced the state currently surviving?
 3. Which client values were optimistic?
 4. Which values became authoritative server truth?
 5. What changed atomically?
 6. Which intermediate values did not survive?
 7. What later operation broke the invariant?
 8. Which tool/evidence source establishes each conclusion?
 9. How confident are you?
10. What information is genuinely missing?
```

## Scoring

```text
correctness
time
tools consulted
manual joins (ID-based vs inferential)
wrong hypotheses
application-specific instrumentation needed
confidence
```

The most important metric may be the last-but-one:

> **How much bespoke instrumentation had to exist before the investigator could
> answer correctly?**

## Preregistered outcomes

```text
A  Studio wins decisively
   faster / more correct, fewer joins, materially less app-specific
   instrumentation                                  -> Studio wedge EARNED

B  roughly equivalent
   Studio cleaner but the control gets there cheaply -> weak case; PARK Studio

C  control wins
   action narrative + ordinary instrumentation easier -> STOP the Studio track

D  candidate requires hypothetical/unshipped kernel machinery
   -> experiment cannot support the Studio claim; narrow Studio or stop
```

Outcome **D** is the one the labelling rule in design issue 3 exists to detect.

## What the review actually established

Not "NgRx is better." Only:

> **We do not know yet, because the first control was not real.**

## Status

```text
scope               THIS DOCUMENT
design issue 1      RESOLVED — atomic in both arms
design issue 2      RESOLVED — trap dropped, Q6 ordinary
design issue 3      STANDING RULE — label shipped / research-only / derived
design issue 4      OPEN — NgRx practitioner NOT SECURED, required before any run
backend             BUILT — apps/backend/ (arm-neutral)
NgRx arm            not started
SignalTree arm      not started
evidence freeze     not started
```
