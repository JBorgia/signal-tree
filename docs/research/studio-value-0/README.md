# Studio validation fixture — the frozen incident

> **Disposition: INVESTIGATION. Non-shipping.** The fixture Studio is validated
> against, and the scoring that decides whether the wedge is earned. Gate
> recorded in [`TODO.md`](../../../TODO.md); bar defined in
> [`SignalTree_Studio_Spec_v0.2.md`](SignalTree_Studio_Spec_v0.2.md) §20.

## Question

> Can SignalTree causal state plus a minimal inspector explain an unfamiliar
> production-state bug **correctly, cheaply, and honestly** — including
> admitting what it cannot know?

Studio is measured against the questions below on the frozen incident, and
scored against **the best alternative buildable on SignalTree without Studio**
— the shipped-API path (`devTools()`, `exportDebugSession()`, `audit`
`metadata.description`) a competent developer already has for free.

It is *not* measured against another framework's tooling. Benchmarking against
an action-log paradigm would anchor Studio's design to a model it deliberately
does not share. The substrate-native baseline is the harder test anyway: it is
what Studio must actually beat to be worth existing.

## The frozen incident

Chosen to exercise semantics SignalTree actually claims to own — not generic
logging failures.

```text
initial state
    -> user action
    -> multi-field transaction
    -> derived state
    -> server/external realization
    -> later unrelated write
    -> current field is surprising
```

**Cart 88213.** `cart.total` is currently **102.00** while `cart.discount` is
**0.00** and `cart.promoCode` is **null**. A total that reflects a discount the
cart no longer has.

```text
initial          subtotal 120.00, discount 0.00, total 120.00, promoCode null

T31              user applies promo SAVE20
                 ATOMIC: promoCode null -> "SAVE20"
                         discount 0.00 -> 24.00
                         total    120.00 -> 96.00
                 (inside the same operation the discount was first computed as
                  20.00, then corrected to 24.00 before commit)

derived          savings recomputes from discount

realization      server confirms the promo but caps it at the customer's tier:
                 discount 24.00 -> 18.00, total 96.00 -> 102.00

T47              expire-stale-promos sweep clears promoCode -> null and
                 discount -> 0.00, and does NOT recompute total

current          total 102.00, discount 0.00, promoCode null   <- surprising
```

This is the distributed-responsibility flow that defines the wedge: a
multi-write atomic parcel, an authored→realized handoff, and a later
*non-atomic* overwrite that partially replaced those consequences.

## The questions

1. Why does `cart.total` have its current value?
2. Which logical operation caused the value currently surviving?
3. Which other fields changed atomically with it?
4. Which intermediate writes did **not** survive?
5. Was the current value locally authored, or received as external truth?
6. Did a later change supersede an earlier valid state?
7. What would restoration actually tell us here — and what can it **not** tell us?
8. What is the shortest evidence chain supporting the explanation?

## Two questions are traps. Studio must fail them honestly.

**Q4 is unanswerable.** The intermediate `discount = 20.00` is not recoverable:
SignalTree transactions coalesce same-location writes to the net effect **by
design** (`ATTRIBUTION-OWNER-0` MO-1B). Claiming to know the intermediate is
**lying**, and that is a scoring failure, not a win.

**Q7 tests honesty about restoration.** MO-3A proved the kernel deliberately
retains no causal parent for a restoration: `RestorationHistoryEntry<T>` is
`{ state: T }`. Studio may say *"restored to a prior recorded state"*; it may
**not** say *"this reverts T31"*. **Restoration lineage must not be claimed as a
Studio advantage.**

## Scoring

```text
correct causal explanation
time to answer
tools consulted
manual joins (ID-based vs inferential)
wrong hypotheses formed
app-specific instrumentation required

ability to distinguish:
  authored                vs  external truth
  transaction intent      vs  net committed effect
  superseded              vs  surviving responsibility

counterfactual completeness — when it cannot answer, does it know why?
honesty on Q4 and Q7 — claiming knowledge here counts AGAINST the result
```

The `transaction intent vs net committed effect` row is where Studio has its
best shot. It is also the row most easily faked by a diagram, so it must be
scored from an investigation against real captured evidence, not from the
design.

## Evidence discipline

Every fact the inspector uses is labelled **SHIPPED SEMANTIC FACT /
RESEARCH-ONLY OBSERVATION / DERIVED BY INSPECTOR / EXTERNAL EVIDENCE**
(spec §8.3). A conclusion resting on a research-only hook is not a Studio
capability claim.

Research-only instrumentation is permitted for this fixture. Do **not** solve
the universal mutation-observation seam (`MUTATION-OBSERVABILITY-0`) to make
the experiment possible — that is Phase 0 (spec §8.5), and the result of this
fixture is part of what decides whether the seam deserves the engineering.

## Backend

The shared fixture backend that produces the incident lives in
[`apps/`](apps/README.md). It emits facts, never conclusions.

## Outcomes

```text
PASS   correct explanation, honest UNKNOWN on Q4/Q7, within budget, every fact
       labelled, AND a material margin over the shipped-API baseline resting
       on facts that baseline cannot reach     -> wedge earned; sequence proceeds
PARK   the shipped-API baseline gets there at similar cost, or the margin is
       only presentation, or load-bearing claims lean on research-only hooks
                                               -> free developer tool, no
                                                  commercial track
STOP   wrong explanation, or a knowledge claim on Q4/Q7 -> thesis not supported
```

**The moat rule (spec §22.5).** Every load-bearing capability must rest on a
fact unreachable without the Phase 0 seam. Anything the shipped API already
gives away is a convenience feature: it may ship, but it cannot count toward
differentiation or justify pricing. Presentation is a head start with a fixed
expiry, not a moat.

Budget and full outcome definitions: spec §20.
