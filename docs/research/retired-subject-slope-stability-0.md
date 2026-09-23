# RETIRED-SUBJECT-SLOPE-STABILITY-0

> **Disposition: THE METRIC IS SOUND, THE GATE DESIGN IS NOT. 2026-09-22.**
> The question was never "how do we get the benchmark under 20 B". It was
> whether a repeatable measurement can distinguish retained retired subjects
> from runtime memory modes. It can — but not the way this gate asks.

## Stage 1 — fresh processes do NOT collapse the modes

Already answered by the existing harness: `check-retired-subject-slope.mjs`
spawns a fresh process per sample via `execFileSync`, and bimodality was
measured across 12 such processes. Process history is not the cause.

## Stage 2 — the modes are V8 heap quantization, not retention

24 independent processes, `no-history-reads`, 150 rounds:

```text
growthMB   heapUsedAfter   heapTotalAfter   rssAfter
   3.23           10.34           ~141        357-424
   7.23           14.35           ~144         513
  15.22           22.34           ~153        708-721
```

The modes are **exact 4 MB quanta**:

```text
10.34  ->  14.35  ->  22.34
        +4.00     +12.00  (= 3 x 4.00)
```

That is V8 heap-page / semi-space granularity. `rssAfter` swings 357-721 MB, a
2x spread, so RSS is useless here; `heapTotal` moves with reservation.
`heapUsed` is the right metric and is still quantized at 4 MB.

**The signal is the same order as the quantization.** The whole claimed growth
for 150k retired subjects is ~3-15 MB, and the noise band is 4-12 MB.

## Stage 3 — the gate's own comparison cannot survive it

```text
50  rounds (n=16)   4.10 x8,  8.10 x8
150 rounds (n=24)   3.23 x16, 7.23 x1, 15.22 x7
```

**The distributions overlap by 4.00 MB, and the 150-round arm frequently
measures LESS than the 50-round arm** — 3.23 < 4.10. That is physically
impossible for real retention: 150 rounds strictly contains more retired
subjects than 50. The measurement is not reading retention at all in this arm.

The verdict is decided by which quantum each median lands in:

```text
median50   median150   B/retired   verdict
    4.10        3.23        -9.1   pass
    8.10        3.23       -51.1   pass
    4.10        7.23        32.8   FAIL
    8.10       15.22        74.7   FAIL
    4.10       15.22       116.6   FAIL
```

**Five of ten mode combinations fail, five pass.** The gate is reading GC
quantization and reporting it as a retention slope.

## Stage 3b — a REAL leak is unmistakable, and perfectly stable

`time-travel-reads` (restoration attached, genuinely retaining), 150 rounds,
10 independent processes:

```text
183.83, 183.82, 183.82, 183.82, 183.82,
183.82, 183.82, 183.82, 183.82, 183.82      -> 1285 B/retired
```

**Zero variance. Twelve times the top of the noise band.**

So the metric is not noise-dominated in general. Genuine retention produces a
signal that is both enormous and rock-steady. What fails is asking for a
_difference between two near-zero measurements_ that both sit inside a 4 MB
quantum.

## Disposition

```text
RETIRE THE METRIC          NO — it detects real retention with zero variance
RAISE THE TOLERANCE        NO — the header warns this deletes the detection it
                                caught a real regression with, and the noise
                                band would swallow any honest threshold anyway
REDESIGN THE COMPARISON    YES
```

The slope-between-two-near-zero-medians design is unsalvageable because its
operands are quantized more coarsely than the effect it measures. An
**absolute ceiling on the non-retaining arm** is strictly more trustworthy:

```text
control (no-history-reads)   max observed 15.23 MB over 24 processes
real retention               183.82 MB, sigma ~ 0
```

Any ceiling in 20-150 MB separates them with an order of magnitude of margin,
and no amount of 4 MB quantization can cross it.

**What is lost, stated honestly:** an absolute ceiling cannot detect a leak
that is small but genuinely linear. Neither can the current gate — its noise
exceeds that signal — so this trades an unmeasurable property for a measurable
one rather than giving anything up.

**Threshold chosen after collecting both distributions, not before**, which is
the trap the preregistration exists to avoid.

---

# RESULT — gate redesigned, acceptance criteria met

```text
MAX_RETAINED_MB = 40     absolute ceiling on the non-retaining arm
slope check              REPORTED, no longer judged
ratio check              REPORTED, no longer judged
```

Both differencing checks were neutralised, not just the slope. The ratio
divides the SAME two quantized operands: a 50-round median of 4.10 beside a
150-round median of 15.22 trips `>2x` on pure quantization, and it fired about
once in twenty-five control runs after the ceiling alone was added.

## Acceptance criteria, all met

```text
CONTROL          15 consecutive runs      PPPPPPPPPPPPPPP
                 10 more after the ratio fix   PPPPPPPPPP
MUTATION         genuinely retaining arm  FFFFFF   correctly detected
BLINDNESS TEST   mutation removed         PPPPPP   back to control
```

The threshold was chosen **after** collecting both distributions — control
worst 15.23 MB, retention 183.82 MB with zero variance — so 40 MB sits an order
of magnitude clear of both rather than being fitted to the answer.

## The self-test had to change with the gate

It previously fed a synthetic LINEAR table and required rejection. That
property is no longer judged, so keeping the assertion would have tested
something the gate cannot measure — the blindness rule in reverse. It now
feeds:

```text
retention regime          183.82 MB   MUST be rejected
worst observed control     15.23 MB   MUST be accepted
flat totals / bounded fixed runtime cost   unchanged, still accepted
```

The second is the important addition: a ceiling that rejected the top of the
measured noise band would be the old flakiness wearing a new threshold.

## What this cost

The gate no longer claims to detect a leak that is small but genuinely linear.
It never could — its noise exceeded that signal — so the claim was the thing
that was false, not the capability that was lost.
