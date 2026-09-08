# STUDIO-VALUE-0 — preregistration

> **Disposition: INVESTIGATION. Non-shipping.** Gate for the Studio wedge,
> recorded in [`TODO.md`](../../../TODO.md). Written BEFORE either arm was
> investigated.

## Question

> Does SignalTree causal state plus a minimal inspector **materially** beat
> conventional debugging on an unfamiliar production-state bug?

## Sequence — control first, deliberately

```text
1. freeze one production-state incident        <- done, below
2. preregister questions + scoring             <- this document
3. build the conventional control TO WIN
4. independent reviewer attacks the control
5. blind investigation against the control
6. ONLY THEN build the minimum SignalTree inspector
7. same investigation
8. compare
```

The provenance track showed how easily the interested side manufactures its own
advantage by choosing what the control happens not to record. **Do not write
Studio before step 5.**

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

## The questions

1. Why does `cart.total` have its current value?
2. Which logical operation caused the value currently surviving?
3. Which other fields changed atomically with it?
4. Which intermediate writes did **not** survive?
5. Was the current value locally authored, or received as external truth?
6. Did a later change supersede an earlier valid state?
7. What would undo/restoration actually tell us here — and what can it **not** tell us?
8. What is the shortest evidence chain supporting the explanation?

## Two questions are traps. Both arms must fail them honestly.

**Q4 is unanswerable by either arm.** The intermediate `discount = 20.00` is not
recoverable. Redux collapses it because one action produces one state diff;
SignalTree collapses it because transactions coalesce same-location writes to
the net effect **by design** (`ATTRIBUTION-OWNER-0` MO-1B). An arm that claims
to know the intermediate is **lying**, and that is a scoring failure, not a win.

**Q7 tests honesty about restoration.** MO-3A proved the kernel deliberately
retains no causal parent for a restoration: `RestorationHistoryEntry<T>` is
`{ state: T }`. Studio may say *"restored to a prior recorded state"*; it may
**not** say *"this reverts T31"*. **Restoration lineage must not be claimed as a
Studio advantage.**

## Scoring — more than elapsed time

```text
correct causal explanation
time to answer
tools consulted
manual joins (ID-based vs inferential)
wrong hypotheses formed
app-specific instrumentation required

ability to distinguish:
  action narrative        vs  actual state consequence
  authored                vs  external truth
  transaction intent      vs  net committed effect

counterfactual completeness — when it cannot answer, does it know why?
honesty on Q4 and Q7 — claiming knowledge here counts AGAINST the arm
```

The `transaction intent vs net committed effect` row is where Studio has its
best shot. It is also the row most easily faked by a diagram, so it must be
scored from the investigation, not from the design.

## Building the control to win

The control gets **NgRx/Redux-style named actions with payloads, a DevTools
timeline with state diffs, browser logs, OpenTelemetry, backend logs, and
request/revision correlation.**

> **If one extra action field makes a question trivial, ADD IT.** We are testing
> whether SignalTree provides a semantic advantage, not whether another team
> forgot instrumentation.

The control's structural advantage, which must be preserved rather than
neutered: **a Redux action log is a developer-authored, human-readable
narrative.** `[Cart] Apply Promo` explains intent in a way SignalTree — which
has no actions and derives causality structurally — cannot. Studio may well be
*worse* at "what happened" and better at "what actually survived". That is the
comparison.

## The bar

```text
control 4 minutes vs Studio 3 minutes   ->  NO BUSINESS
```

Material win, or stop the Studio track too.

## Research-only instrumentation is permitted

Do **not** solve the universal mutation-observation seam
(`MUTATION-OBSERVABILITY-0`) to make this experiment possible. Use research-only
instrumentation and let the commercial result decide whether that seam deserves
engineering.

## Status — BLOCKED

```text
STATUS              BLOCKED — SYNTHETIC CONTROL INVALID
product conclusion  NONE. The instrument failed, not the thesis.
control-arm/        INVALID — see control-arm/INVALID.md
next step           BUILD-SCOPE.md — two real apps, one backend, raw evidence
```

The independent adversarial review (step 4) returned 25 findings and judged the
synthetic control weaker than a competently instrumented NgRx application, in
load-bearing rather than cosmetic ways. It never reached step 5.

**The review paid for itself completely.** Skipping the equivalent step on
`CONTROL-ARM-0` cost a whole invalid run; running it here caught the fixture
*before* the blind investigation.

The incident, questions and scoring above remain sound and carry forward — with
two corrections recorded in `BUILD-SCOPE.md`: the real scenario contains no
atomic multi-field operation unless one is built deliberately, and the
coalescing trap on Q6 does not survive a network round trip.
