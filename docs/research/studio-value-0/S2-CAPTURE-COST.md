# S2 capture cost — measured on the live notifier path

> 2026-09-10. Measured after live wiring, so this is product cost rather than a
> component cost.

## Capture OFF

Unchanged from S1's structural position: no subscription, no allocation, no
retained journal. The lease installs nothing until `startRealizationCapture`,
and refuses structurally before installing on an unsupported tree. The only
standing kernel cost remains the capability accessor
(`+19 B` bare / `+31 B` with `transactions()`, gzip).

## Capture ON

Interleaved arms with warmup, `N=100` writes/rep, 11 reps, medians. Timed
region **includes delivery** — writes are flushed asynchronously.

| payload | off median (ms/write) | ON median | overhead | ON p95 | ON writes/sec |
|---|---|---|---|---|---|
| scalar | 0.0017 | 0.0030 | **+78%** | 0.0126 | 330,534 |
| 1 KB object | 0.0010 | 0.0016 | **+56%** | 0.0060 | 631,413 |
| 10 KB object | 0.0052 | 0.0055 | +6% | 0.0214 | 181,434 |
| 100 KB object | 0.0205 | 0.0201 | −2% | 0.0442 | 49,862 |
| 1 MB object | 0.2233 | 0.2120 | −5% | 0.2665 | 4,718 |

**Read:** capture roughly **doubles the cost of a cheap realized write** — a
fixed per-write cost (ownership filter, realized filter, snapshot, bounded
push) that dominates when the write itself is trivial. At 10 KB and above the
overhead falls into noise; the negative figures are noise, not speedups, and
bound the residual measurement error at roughly ±6%.

For an explicitly enabled DevTools recorder this is acceptable, and it does not
degrade with payload size across the range tested.

## ⚠️ Caveat — the payloads were string-heavy

The large payloads are `{ id, blob: 'a'.repeat(n) }`. A big **string** clones
close to a memcpy. A deeply nested graph of many small objects stresses
`structuredClone`'s traversal far harder, and is **not** characterized here. If
S2 is used on entity collections, that shape should be measured before any
claim about large realized values.

`maxEffects` bounds **count, not size** — 500 retained 1 MB values is 500 MB.
A `maxValueBytes` budget or a truthful oversized-value truncation is the likely
product control, and per S2's rules it must not be "fixed" by reverting to
retaining mutable references.

## Method — two failed attempts first, both recorded

**Attempt 1 was vacuous.** Capture ON measured *faster* than OFF at every
payload. Investigation: `retained: 0` — delivery is asynchronous, the timed
loop never awaited a flush, so the benchmark measured writes whose frames were
never processed. The suite now has a **sanity gate** that aborts when capture
retains nothing.

**Attempt 2 was an ordering artifact.** With the gate passing (20/20 retained),
ON was *still* faster everywhere. Cause: OFF ran first for each payload and
warmed the JIT for ON. Fixed by warming both paths and interleaving the arms so
drift affects them equally.

Both attempts produced confident, plausible, wrong tables. The tell each time
was a result that could not be true — capture cannot make writes faster. That is
the same signature as the four earlier unsound-test findings, and the reason
`RESEARCH-RULES` R1 exists.
