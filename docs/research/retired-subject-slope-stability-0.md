# RETIRED-SUBJECT-SLOPE-STABILITY-0

> **Disposition: CLOSED — 2026-09-23. Outcome A: the 40 MB ceiling is
> validated on the release environment.**
> The question was never "how do we get the benchmark under 20 B". It was
> whether a repeatable measurement can distinguish retained retired subjects
> from runtime memory modes. It can — but not the way this gate asks.

## Stage 1 — fresh processes do NOT collapse the modes

Already answered by the existing harness: `check-retired-subject-slope.mjs`
spawns a fresh process per sample via `execFileSync`, and bimodality was
measured across 12 such processes. Process history is not the cause.

## AMENDMENT 2026-09-23 — three corrections to my own conclusions

### 1. The mechanism was asserted, then actually measured

I wrote that the modes were "V8 heap-page / semi-space granularity". **That was
an unmeasured mechanism claim.** Measured afterwards with
`v8.getHeapSpaceStatistics()`, across 6 processes:

```text
growthMB   old_space   new_space   large_object_space
    3.23        5.42        0.07                 4.25
   15.22        5.41        0.07                16.25
```

`old_space` and `new_space` are FLAT. The entire step is
**`large_object_space` occupancy**, varying by 12 MB (= 3 x 4 MB). Not heap
pages, not semi-spaces. The honest statement is: **repeatable ~4 MB-quantized
modes in large-object space**; whether that is allocation granularity,
collection timing or backing-store cohorting is still not established, and does
not need to be to repair the gate.

### 2. "Physically impossible" was too strong

I wrote that a 150-round arm measuring less than a 50-round arm is physically
impossible for real retention. It is not: these are **net `after - before`
measurements from different processes**, and GC, compaction and heap-layout
history differ. A larger workload can legitimately end lower.

The correct, narrower, and still sufficient claim:

> **The cross-process delta is not a reliable monotonic estimator of retained
> retired-subject memory.**

That kills the slope calculation without needing an impossibility argument.

### 3. The mutation tested the wrong thing

Stage 3 swapped ARM `no-history-reads` -> `time-travel-reads` and reported
183.82 MB. That proves a subsystem _designed_ to retain does retain. It does
**not** prove the gate catches an accidental leak in a plain tree, which is the
regression it exists to detect. Different claim, weaker evidence.

## Stage 3 (real) — same arm, deliberate retention

`--retain N` holds N retired-node HANDLES — the results of `byId()` —
strongly reachable. Stated as handles, not subjects: a one-handle-to-one-
retired-SubjectId relationship has not been separately proven for this
benchmark, and the mutation's value is that it exercises the same
lifetime/reachability failure mode, not that it counts subjects. Same arm, same
churn, same protocol; the only difference is that retired subjects stop being
forgettable. Five samples per level, 150 rounds:

```text
retained   observed growthMB          vs 40 MB ceiling
       0   3.23  15.23  3.23  3.23  3.23      pass
   1,000   9.86   9.87 21.86  9.86  9.86      pass — INVISIBLE
   2,500  32.78  23.89 23.89 23.89 23.89      pass — below ceiling
   5,000  40.56  40.56 40.56 40.56 41.44      fails, but MARGINAL
  10,000  82.75  82.74 82.75 82.75 98.75      fails reliably
  25,000 182.34 182.34 182.34 182.34 182.34   fails reliably
```

**The sensitivity specification the gate can honestly claim:**

> Reliably detects gross retention at or above **~10,000 deliberately
> retained retired-node handles** (the mutation holds `byId()` results
> strongly reachable across rounds). 5,000 is
> MARGINAL — its 40.56 MB floor sits barely above the ceiling, and a 12 MB
> low-mode draw would put it under. At or below 2,500 it is invisible.

5,000 is deliberately NOT claimed, and the threshold was NOT lowered to claim
it: a 12 MB quantum is comparable to 5,000 subjects' entire signal above
control, so no ceiling makes that level reliable. Tuning the number to turn a
marginal case green is the failure this track exists to end.

## Stage 2 — the modes are ~4 MB-quantized runtime modes

24 independent processes, `no-history-reads`, 150 rounds:

```text
growthMB   heapUsedAfter   heapTotalAfter   rssAfter
   3.23           10.34           ~141        357-424
   7.23           14.35           ~144         513
  15.22           22.34           ~153        708-721
```

The modes are repeatable **4 MB quanta** (mechanism measured in the amendment
above — large-object space):

```text
10.34  ->  14.35  ->  22.34
        +4.00     +12.00  (= 3 x 4.00)
```

`rssAfter` swings 357-721 MB, a 2x spread, so RSS is useless here; `heapTotal`
moves with reservation. `heapUsed` is the right metric and is still quantized
at 4 MB.

**The signal is the same order as the quantization.** The whole claimed growth
for 150k retired subjects is ~3-15 MB, and the noise band is 4-12 MB.

## Stage 3 — the gate's own comparison cannot survive it

```text
50  rounds (n=16)   4.10 x8,  8.10 x8
150 rounds (n=24)   3.23 x16, 7.23 x1, 15.22 x7
```

**The distributions overlap by 4.00 MB, and the 150-round arm frequently
measures LESS than the 50-round arm** — 3.23 < 4.10. See amendment 2: this does
not prove impossibility, since these are net measurements from different
processes. What it does establish is that the cross-process delta is **not a
reliable monotonic estimator** of retained memory, which is all the slope
calculation needed to be unusable.

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

## PENDING ON CLOSURE — rename the gate

The gate is still called `retired-subject-slope` /
`check-retired-subject-slope.mjs`, and it **no longer judges a slope**. The
name is now actively misleading, and probably part of why a 40 MB figure reads
oddly: 40 MB is not expected memory usage and not a slope — it is the line
between "runtime noise plus retention we cannot resolve" and "something has
gone badly wrong".

What it now asserts is:

> This workload, which should forget retired node handles, has not entered a
> GROSS-RETENTION regime.

Rename to something like `retired-lifetime-gross-retention` or
`retired-subject-retention-ceiling` once the Linux characterization closes the
track — after, so the rename does not churn the thing being measured.

## STILL OPEN — release-environment validation

The 40 MB ceiling was derived entirely on **darwin/arm64, Node v24.15.0, V8
13.6.233.17**. Release gates run on **ubuntu-latest (linux/x64)**.

An absolute ceiling is environment-dependent in a way the normalized slope was
not, and large-object-space behaviour is exactly the kind of thing that differs
across platform and V8 build. **This threshold must be validated on the release
platform before it blocks a release**: control distribution, and the
`--retain 10000` mutation, both measured on Linux x64.

Until then the gate is better than what it replaced but not yet cleared. The
checker now prints Node version, V8 version, platform and arch on failure, so a
future runtime upgrade turning this red is diagnosable rather than mysterious.

### The characterization job

`.github/workflows/retention-characterization.yml`, **manual dispatch only** —
it is a one-off measurement, not a gate, and must not turn anything red while
the threshold is unvalidated.

```text
CONTROL    no-history-reads, rounds 150, retain 0       30 fresh processes
MUTATION   no-history-reads, rounds 150, retain 10000   10 fresh processes
```

`.nvmrc` pins 24.15.0, so **Node version is held constant**. Everything else
about the runner differs — OS, kernel, allocator and runtime libraries,
executable build, host environment — and that is intentional: the goal is the
REAL release environment, not a laboratory isolation of CPU architecture. An
earlier draft of this note said "only platform and arch differ", which
overstated the control. The full JSON — growthMB,
heapUsed, heapTotal, RSS, per-space large-object figures, Node, V8, platform,
arch, heap limit — uploads as an artifact.

**It reports a separation summary and deliberately does not pass or fail.**
The threshold is not the acceptance condition; the distributions are collected
first, then the threshold is decided. Three outcomes:

```text
A  control well under 40, mutation well over   -> 40 MB validated, close
B  clean separation at different values        -> derive a Linux ceiling, then
                                                  VALIDATE IT ON FRESH SAMPLES
C  material overlap                            -> an absolute ceiling is not a
                                                  reliable gate here; do NOT
                                                  tune it to green
```

### Outcome B needs a second batch — outcome A does not

If a new Linux threshold has to be derived, **it may not be declared validated
by the samples that chose it.** That is fitting the line to the answer wearing
a different hat.

```text
characterization batch   30 control + 10 retain=10k
        -> derive and FREEZE the Linux threshold
independent batch        fresh control + fresh retain=10k samples
        -> both must behave correctly under the frozen threshold
        -> only then close
```

**Outcome A is exempt, and for a real reason rather than convenience:** 40 MB
was derived on darwin/arm64, so a Linux run that leaves it untouched IS the
independent validation. The samples that chose it and the samples testing it
come from different environments.

**The job builds the kernel first, and that is required rather than
precautionary.** `bench-entity-churn-retention.mjs` imports
`dist/packages/kernel/dist/index.js` at runtime and exits 1 with "build first"
when it is absent. Verified by moving `dist` aside and running the exact
sequence: the bench fails without it and succeeds after `npx nx build kernel`.
The first draft of the workflow omitted this and would have failed on a fresh
runner before measuring anything — the same absent/stale-dist class that once
let a stale API baseline record functions the source no longer contained.

**Sample counts must not be reduced.** A three-sample green median hiding
multimodal behaviour is the exact failure that kept an untrustworthy gate in
place; spending the CI minutes to see the distribution is the entire point.

---

# LINUX RESULT — outcome A, with an unexpected finding

Run `35886271808`, `ubuntu-latest`, Node v24.15.0, V8 13.6.233.17-node.48,
linux/x64.

```text
CONTROL   n=30, retain=0        3.23 x28,  3.24 x2
MUTATION  n=10, retain=10000   82.75 x9,  82.76 x1

control  3.23 .. 3.24
mutation 82.75 .. 82.76
GAP      79.51 MB          overlap: none
```

**40 MB is validated.** No control sample comes within 36 MB of it; every
mutation sample clears it by more than 42 MB. The threshold was derived on
darwin/arm64 and left untouched by Linux, so this IS the independent
validation — the samples that chose it and the samples testing it come from
different environments, which is exactly the condition outcome A was defined
to satisfy.

## The unexpected part: the bimodality is macOS-specific

Linux control is **unimodal and essentially exact** — 28 of 30 samples
identical to the centibyte. The 3.23 / 7.23 / 15.22 mode structure that
motivated this entire investigation **does not appear on Linux at all**.

Stated carefully, because it would be easy to overclaim in either direction:

```text
ESTABLISHED   macOS/arm64 150-round control is multimodal across 4 MB steps,
              localized to large_object_space
ESTABLISHED   linux/x64 150-round control is unimodal and tight
NOT MEASURED  linux 50-round control — so whether the OLD slope gate would
              have been stable in CI is UNKNOWN
```

I did not collect Linux 50-round samples, so I cannot say the old slope gate
was fine in CI. What the redesign rests on is unchanged and sufficient: a gate
that is ~38% spuriously red on the platform developers actually run it on is
not usable, whatever CI happens to do with it.

## Sensitivity on the release platform

The macOS floor study (invisible at 2,500, marginal at 5,000, reliable at
10,000) was measured on the noisy platform. On Linux the control band is ~0.01
MB wide rather than ~12 MB, so the detection floor there is certainly LOWER —
but it was not measured, and the gate does not claim it. The honest claim
remains:

> Reliably detects gross retention at or above ~10,000 deliberately retained
> retired-node handles, verified on the release environment.
