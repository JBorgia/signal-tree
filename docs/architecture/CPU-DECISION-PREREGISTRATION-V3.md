# CPU decision — preregistration v3 (final methodology revision)

**Dated 2026-09-21.** This is the LAST harness revision for this decision. There
is no v4; the stopping rule is at the bottom and it is binding.

## Disclosure: the rejected deltas have been seen

A four-way run was executed on 2026-09-20. **Every decisive workload failed its
preregistered A/A gate, so none of its candidate deltas are admissible.** They
are recorded here in full, because pretending not to have seen them would be
worse than disclosing them:

| workload          | strong |  cell |  token | native |   A/A | verdict |
| ----------------- | -----: | ----: | -----: | -----: | ----: | ------- |
| `updateOne`       |  269.8 | -10.6%| -10.3% | -10.0% | 11.7% | REJECTED |
| `byId-warm`       |  145.4 | +15.6%| +13.1% |  +4.2% | 74.3% | REJECTED |
| `byId-cold`       | 8894.3 |  -4.2%|  -6.6% | -24.7% | 34.4% | REJECTED |
| `field-read-held` |   57.9 | -18.4%| -19.0% | -26.1% |107.2% | REJECTED |
| `setAll-reused`   | 4.94ms |  +0.1%|  -0.0% |  +0.2% |  2.2% | **admissible** |
| `scalar-set`      |    5.5 |  -0.2%|  +0.4% |  -0.2% |  6.0% | REJECTED |

The single admissible result: **`setAll-reused` shows no difference between any
of the four candidates.**

These numbers are EXPLORATORY ONLY. They are directionally consistent with the
mechanism predicted for the native carrier, which makes them more dangerous
rather than less — a re-run that reproduces them will feel like confirmation.
Anyone interpreting the v3 result must treat that feeling as a known bias.

## The harness defect, and what is NOT established

Twenty identical runs of the SAME build on `field-read-held`, ns/op:

```
76.5 41.9 40.1 44.0 41.3 43.4 53.2 42.3 40.4 93.3
94.0 122.2 115.1 41.6 52.6 45.1 72.3 56.3 70.5 52.4
```

A sharp floor near 40 with a 3x tail. The distribution is MULTI-MODAL, not
Gaussian — that much is demonstrated.

**The CAUSE is not demonstrated.** It could be core placement, frequency state,
V8 tiering, GC timing, process startup, or a combination. An earlier analysis in
this program asserted core placement; that was inference presented as fact and
is withdrawn. v3 therefore does not redesign anything around a theory of the
cause.

**Minimum-of-N is explicitly rejected as the metric.** It selects the luckiest
execution, estimates a best-case floor rather than typical cost, and
structurally favours implementations with wider variance. That is not the
product question. The statistic stays a median.

The one thing the data does support is a DURATION effect: `setAll-reused`, at
~124 ms of measured time per sample, resolved at 2.2% A/A, while every workload
measuring under ~50 ms failed. v3 changes measurement duration and nothing else
about winner selection.

## v3 measurement design

Per child process:

```
construct workload
warm up, untimed
calibrate iteration count so one batch lasts >= the target duration
run several timed batches IN THE SAME PROCESS
process result = median batch ns/op
```

- Target duration: **250 ms** per batch, **500 ms** for the very cheap
  operations (`scalar-set`, `field-read-held`).
- Iteration count is CALIBRATED at runtime, never hard-coded, so a faster
  candidate does not get a shorter measurement window.
- Batches per process: **5**, median taken.

Cross-process protocol is unchanged from v1/v2: multiple fresh processes,
candidate order interleaved and reversed, median across process results, and the
same **5% A/A rejection rule**.

## Calibration gate — before any candidate is unblinded

Harness development uses **`v2-token` against itself only**. The other three
candidates are not built or run during v3 development.

Before the four-way may run, **three independent token-vs-token A/A preflights**
must each put all four entity workloads at or under 5%:

```
byId-warm        <= 5%  in all three
updateOne        <= 5%  in all three
byId-cold        <= 5%  in all three
field-read-held  <= 5%  in all three
```

`setAll-reused` and `scalar-set` are expected to pass as well but are not the
gate — the four above are the entity decision arms.

One passing preflight is not enough. A single clean A/A is exactly what a noisy
harness produces occasionally.

## Then, once and only once

Freeze the harness. Run the four candidates a single time. Apply the v1
thresholds, unchanged:

```
byId-warm / updateOne   <=2% flat | 2-5% tradeoff | >5% materially worse
other workloads         >5% materially worse
A/A > 5%                NOT RESOLVABLE
```

And the v2.1 conditional interpretation still stands: a failing epoch candidate
fails AS CONSTRUCTED, because carrier and shared publisher changed together;
attributing a regression to the carrier requires the bounded publisher-vs-carrier
follow-up.

## STOPPING RULE — binding

> If the preregistered long-duration A/A calibration cannot resolve the four
> entity workloads on this host, CPU remains **UNKNOWN**, and no further CPU
> methodology changes will be made for this decision.

At that point the architecture decision is made from semantics and memory alone,
where the native carrier leads by 513 B/entity with every suite green. One
principled attempt to extract the answer — not an open-ended search for a
statistic that produces one.
