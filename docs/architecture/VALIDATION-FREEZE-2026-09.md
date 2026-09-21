# Validation freeze — entity realization work

**Written before any measurement in this pass was run.** The matrix, the
repetition counts, the accept/reject rules and the mutants are all fixed here so
that nothing can be adjusted after a result is seen. Anything discovered later
that this document did not anticipate gets recorded as a SECOND, explicitly
labelled protocol — it does not get folded back into this one.

```text
FROZEN    53dde504674a563d7067df64a3987672c53116b0
BASELINE  71182dd5a2a8180f1193cf586efdf92f1028f241   (session start)
```

## Why this exists

The work between those two commits was steered by an ongoing conversation. The
sequence of hypotheses was influenced: the epoch design, adapter-bound memory
attribution, separating durable truth from framework realization, and checking
the React row were all suggested rather than discovered independently.

That influence is not itself the problem. The problem is researcher degrees of
freedom — after each result this session chose what to measure next, changed
benchmark decomposition, discarded malformed arms, added controls, and pursued
mechanisms that fit the emerging model. Good engineering, but it means the
session is not a preregistered experiment and must not be reported as one.

Conversational bias can choose a hypothesis. It cannot manufacture a
1,248 B/entity delta, and it cannot make a deliberately broken mutant fail six
tests — UNLESS the harness is itself defective. This session found four
harnesses that measured something other than their name (`bench-entity-layers`
and `bench-raw-signals` measuring the neutral fallback, `entity-byId-field-read`
conflating three questions, `entity-setAll-10k` conflating create/setAll/destroy)
and twice produced confident numbers that later collapsed: a +4.1% `updateOne`
regression attributed to code that provably never executed, and a -51.8% field
read that read -13.8% on a busier machine. So the harness is exactly what needs
auditing.

## Claims under audit

| # | claim | kind |
| - | ----- | ---- |
| C1 | angular `released` 2,222 -> 1,350 B/entity at FROZEN | memory |
| C2 | react `released` 2,476 -> 1,748 B/entity at FROZEN | memory |
| C3 | neutral `released` 2,476 -> 1,747 B/entity at FROZEN | memory |
| C4 | vue `released` 2,687 -> 2,039 B/entity at FROZEN | memory |
| C5 | angular `released` 3,591 B/entity at BASELINE | memory |
| C6 | `updateOne`, `byId` and held field read are FASTER at FROZEN | CPU direction |
| C7 | no regression on `scalar-set` or `setAll` | CPU direction |
| C8 | a weakly held epoch fails >= 6 of 12 tests in the non-retaining battery | semantics |
| C9 | every framework row improves; none regresses | memory |

C6 is a DIRECTION claim only. No percentage is claimed, because the field-read
magnitude already failed to reproduce once.

## Fixed matrix

Rows: `angular`, `vue`, `react`, `kernel` (neutral), `v14` where equivalent.

Memory cells (`tools/bench-entity-realization-matrix.mjs`): `untouched`,
`field realized`, `nodes held`, `node only`, `released`.

CPU workloads, each in a FRESH PROCESS, one workload per process:
`scalar-read`, `scalar-set`, `updateOne`, `byId-warm`, `held field read`,
`fresh setAll`, `reused setAll`.

## Protocol

Memory:

- 3 process-isolated runs per cell, at **N = 10,000 and N = 20,000**.
- ACCEPT only if per-entity bytes are stable across N (linear scaling) within
  2%. A quantity that is genuinely per-entity must not move with N.
- ACCEPT only if the spread across the 3 runs is <= 2%.

CPU:

- Paired BASELINE vs FROZEN, both built from source into isolated consumer
  roots, `@signal-tree/*` COPIED (a symlink resolves from its realpath and would
  silently measure the workspace build) and framework runtimes SYMLINKED.
- 10 pairs per workload per order, run in BOTH orders (20 pairs total).
- An A/A control per workload: FROZEN against itself through the identical path.
- **REJECT any workload whose A/A spread exceeds 5% of its median.** A rejected
  workload reports "not resolvable on this machine" — it does NOT get a number.
- Report medians. No percentage is quoted for a workload whose two orderings
  disagree in sign.

Semantics:

- The Angular forced-GC batteries at FROZEN, under the real adapter.
- Mutants, each expected to FAIL, each reverted immediately after:
  - M1 epoch held weakly -> expect >= 6 failures in the non-retaining battery
  - M2 `subjectStateSignals` held strongly -> expect >= 1 failure
  - M3 native writable projection unobservable -> expect >= 1 failure
- A mutant that does NOT fail invalidates the corresponding guard, and that is
  reported as a finding rather than explained away.

## Rules

1. No architectural change is permitted during this pass. Tooling and documents
   only.
2. The matrix above is not edited after results are seen.
3. A malformed arm is marked INVALID and is not silently replaced.
4. An independent adversarial reviewer audits the frozen commit WITHOUT being
   given this project's architectural thesis or the expected outcome. Its brief
   is to find reasons the conclusions are false.
