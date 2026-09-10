# S1 disabled/unused cost — measured

Spec §8.5 points 6 and 7 required **measured numbers, not assertions**.
Thresholds were frozen before running.

Baseline `fa8d4d09` (immediately before `confirmedTurnReader` entered the
kernel) vs `c246eb1c`+. Reproduce with `measure-bundle.mjs` / `measure-runtime.mjs` in this directory.

## 1. Production bundle delta — PASS

No import of `@signal-tree/studio-adapter`, `/bridge`, `studio-query`, or
`studio-devtools`.

| build | metric | baseline | S1 | delta |
|---|---|---|---|---|
| bare `signalTree` | min | 36432 | 36432 | **+0 B** |
| bare `signalTree` | gzip | 12561 | 12561 | **+0 B** |
| bare `signalTree` | brotli | 11235 | 11235 | **+0 B** |
| `signalTree` + `transactions()` | min | 101760 | 101869 | +109 B |
| `signalTree` + `transactions()` | gzip | 30958 | 30975 | **+17 B** |
| `signalTree` + `transactions()` | brotli | 27458 | 27463 | +5 B |

Threshold: 0 B attributable to Studio packages, ≤100 B gzip kernel seam.
**Both met.** Studio symbol grep over both production bundles: **none**.

### ⚠️ UPDATED 2026-09-10 — the bare-tree zero is gone

S2 needed a construction-time capability fact (`defineTreeCapabilities`, so a
tool can ask what a tree was built with instead of probing behaviour). It runs
**unconditionally**, so:

| build | gzip vs pre-S1 baseline | was |
|---|---|---|
| bare `signalTree` | **+19 B** | +0 B |
| `signalTree` + `transactions()` | **+31 B** | +17 B |

Still comfortably inside the ≤100 B budget, but the "+0 B for bare trees"
property no longer holds and should not be quoted. It was traded for a
capability accessor bare trees cannot use — they are unsupported for S2 anyway.

The alternative was skipping attachment when the capability list is empty, which
would make a bare tree indistinguishable from a non-tree (`undefined` both) and
collapse a distinction documented as meaningful. 19 B was judged the better
trade; recorded so the judgement is visible rather than implied.

### ⚠️ The first measurement FAILED, and that is why it was measured

Initially: **+489 B min / +161 B gzip**, with `readConfirmedTurns` present in
the bundle — over the 100 B budget.

Cause: the projection was a method on `TransactionAuthority`. **Class methods
cannot be tree-shaken when the class is instantiated**, and the transactions
enhancer always instantiates it — so every consumer of `transactions()` paid
for a projection they would never call.

Fix: the authority now exposes only `getConfirmedTurnRecords()`, and the
projection moved into `internals.ts`, reachable only from a build that imports
`@signal-tree/kernel/internals`. 161 B → 17 B gzip.

A design that is "obviously zero-cost" was not. The number found it.

## 2. Disabled runtime overhead — PASS structurally; the ≤1% bound is characterization debt

pre-S1 kernel vs current kernel with Studio unused, same workload, medians of
15–25 reps after warmup.

| workload | writes | pre-S1 median | S1-unused median | delta |
|---|---|---|---|---|
| scalar | 1,000 | 0.11 ms (0.1–0.4) | 0.20 ms (0.1–0.4) | +75.34% |
| scalar | 10,000 | 0.90 ms (0.6–1.4) | 0.88 ms (0.7–1.4) | −2.75% |
| scalar | 100,000 | 8.90 ms (6.1–13.1) | 5.99 ms (5.5–12.8) | −32.70% |
| transactional | 1,000 | 24.44 ms (14.0–57.0) | 24.13 ms (12.5–53.1) | −1.25% |
| transactional | 10,000 | 1313.20 ms (490.9–5207.0) | 1190.76 ms (463.8–3383.5) | −9.32% |

**Read this honestly.** S1 cannot make writes faster — it adds no code to the
write path — yet three rows show S1 "faster" by up to 33%, and one shows it
"slower" by 75% on a 0.09 ms absolute difference whose range is 0.1–0.4 ms in
*both* arms. Transactional 10k spans a 10× range. **The noise floor is far
above the frozen ≤1% threshold**, so this harness cannot assert that threshold
either way.

What it does support: **no regression is detectable**, and the direction of the
deltas is inconsistent with a real cost.

Asserting ≤1% would need an interleaved in-process A/B, far more reps, and a
quiet machine.

### Classified as performance characterization debt, NOT S1 acceptance debt

Decided 2026-09-09. The question S1 actually had to answer was *"does unused
Studio support impose work on ordinary SignalTree users?"* — and §1 plus the
structural tests answer it far more strongly than a timing run could.

The ≤1% figure was useful as a **falsifier**, and the frozen-threshold
discipline already earned its keep on the bundle side by exposing the +161 B
class-method problem. But inferring a 1% effect from measurements whose noise
is tens to hundreds of percent is not a resolvable experiment, and

> "the harness cannot measure 1%"

must not be laundered into

> "S1 has not established acceptable runtime behavior."

Those are different statements. S1 is a **read port over state the transaction
runtime was already retaining**; there is almost nothing for an unused-runtime
benchmark to measure.

### ⚠️ When this becomes blocking again

The budget returns the moment a slice puts something on the **actual write
path**. Concretely, if a later slice:

- adds an `if (observer)` branch to every write, or
- allocates an event object before knowing whether anyone is listening, or
- maintains another index or history while Studio is unattached,

then **rerun a precise benchmark before shipping that slice**. S2 is the first
real test of this, since realization/external truth is closer to the write path
than committed-turn reading was.

### The stronger guarantee is structural, not statistical

`packages/kernel/src/enhancers/transactions/studio-unused-cost.spec.ts` pins
what a benchmark cannot:

- importing the kernel registers no observer, and no Studio symbol lands on a tree
- observing a tree with no `transactions()` retains nothing — looking does not install
- no Studio branch scales with writes
- the reader projects already-retained history; reading twice does not duplicate or accumulate
- enabling is explicit and disposable

Plus §1 above: the projection is not in the production bundle at all. Code that
is absent cannot cost runtime.

## 3. `confirmedTurns` is unbounded — pre-existing, not charged to S1

Append-only, no eviction. That predates Studio and S1 did not increase
retention; it reads what was already kept. **Not an S1 regression.**

Open question for the kernel, not a blocker here: *should confirmed transaction
history become bounded/configurable?* Studio has made it observable, which
makes the question easier to ask, not more urgent to answer.
