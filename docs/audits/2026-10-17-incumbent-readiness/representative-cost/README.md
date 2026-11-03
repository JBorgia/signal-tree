# Representative cost characterization

October 18, 2026. **Measurement completed; artifact acceptance remains blocked.**
No runtime, API, ceiling or release changes. B remains closed.

## Provenance and predeclared decision

Incumbent: `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`.
Candidate: `9917c92fbbdc9dfdd14601f1f5fb7ce21799be71`.
[Preregistration](PREREGISTRATION.md) committed at `3d4d3f73`, reviewed harness at
`a67b5720`, and heap correction before its run at `50b7fe68`.
The updated acceptance policy was read before the study; its snapshot/hash is
preserved. The owner's working-tree edits to that policy and AGENTS.md are excluded
from these commits.

Artifacts are the identified existing builds from the
[artifact attribution](../artifact-cost/README.md). All 110 incumbent and 248
candidate artifact hashes match that record before and after this study. Runtime
uses the built kernel module graph; this is separate from the tree-shaken consumer
bundle fixture. No new build settings, dependency resolution or runtime patches.

Five independent decision samples per arm/profile, plus two baseline A/A controls;
sequential AB/BA order. Original campaign: **324 processes / 27 profiles, zero
assertion failures**. Corrected heap campaign: **84 processes / 7 profiles, zero
assertion failures**. All recorded process IDs are distinct within each campaign.
Preflight and diagnostic runs are additional, separately preserved.

Node 24.15.0 on Apple M4, production ngDevMode=false, exposed GC. Original campaign
1-minute host load ranged 3.61–4.37; host activity was not controlled. No calibrated
throttle, browser renderer or exclusive-core claim. Runtime assertions are included
in timing. These synthetic profiles and frequencies are not measured adoption.

No application CPU/heap SLO was supplied. As preregistered, results characterize
cost rather than invent performance acceptance thresholds. Existing bundle ceilings
remain the only numeric artifact acceptance authority. Required correctness is
not exchanged for performance.

## Timing and CPU

All **20 synchronous timing comparisons and all 20 process-CPU comparisons remain
directionally unresolved** under the predeclared rule: overlapping arm ranges or
differences within observed same-arm variability do not establish direction.
This is not statistical equivalence or proof of no regression. Full min/max ranges,
A/A controls, CPU, batch drain and raw samples are preserved.

Representative synchronous medians in microseconds per checked cycle:

| Work | Incumbent | Candidate | Absolute difference |
| --- | ---: | ---: | ---: |
| Bare scalar write/read | 0.16 | 0.15 | −0.004 |
| Point update, 10,000 rows | 1.11 | 1.14 | +0.02 |
| Update plus all(), 10,000 rows | 279.60 | 277.09 | −2.51 |
| Two add/remove pairs, 10,000 rows | 86.15 | 84.28 | −1.88 |
| Mixed confirmation, 10,000 rows | 64.36 | 61.26 | −3.09 |
| Mixed rollback, 10,000 rows | 103.34 | 100.66 | −2.68 |
| Successful newer-first overlap | 61.11 | 61.49 | +0.38 |
| Refusal, conflict removal and retry | 280.78 | 285.81 | +5.03 |
| Construct/populate/destroy, 100 rows | 256.09 | 257.91 | +1.82 |
| Empty construct/destroy | 12.79 | 14.86 | +2.08 |

Differences are computed before rounding. Construction includes teardown; these
are not isolated constructor timings. Refusal is a pending removal conflicting
with independent same-key replacement, not two pending owners. Successful overlap
is newer-first and is supported by both arms; no capability gain is inferred.
Two setImmediate boundaries are timed after synchronous work separately; finite
drain does not establish arbitrary scheduler completion or rendering latency.

## Heap, growth and cleanup

Use **heap-v2** for corrected heap comparisons; do not splice absolute checkpoints
from the original harness. Values are whole-process heapUsed deltas after the
shared finite quiescence protocol, not dominator retained sizes.

| Live profile | Incumbent median bytes | Candidate median bytes | Difference |
| --- | ---: | ---: | ---: |
| 100 empty trees | 1,158,768 | 1,187,816 | +29,048 |
| 10 trees × 100 rows | 1,637,312 | 1,642,872 | +5,560 |
| 10 trees × 1,000 rows | 4,852,488 | 4,857,408 | +4,920 |
| 10 trees × 10,000 rows | 47,902,776 | 47,907,920 | +5,144 |
| 10 enhanced trees × 100 rows, 100 owners total | 3,581,400 | 3,588,776 | +7,376 |
| 10 enhanced trees × 1,000 rows, 100 owners total | 6,715,240 | 6,721,568 | +6,328 |
| 10 enhanced trees × 10,000 rows, 100 owners total | 49,073,192 | 49,083,320 | +10,128 |

All listed live differences are higher under the preregistered descriptive rule.
The ordinary populated increment does not grow monotonically with row count in
these samples; do not extrapolate a permanent per-row slope or constant overhead.
The empty control is a separate shape, not a substitute for populated workloads.

A separate enhanced-idle checkpoint primes ten row handles before creating ten
owners per tree. At 10,000 rows, creating owners still produces a **negative net
process delta** (−47,072 / −43,320 bytes). This cannot be negative owner storage.
Aggregate heap movement, including unrelated collection/representation changes,
prevents isolated responsibility-byte attribution at that size. That question is
**unresolved**, not a memory improvement. Smaller profiles and all pre-/post-drain,
settled, process-baseline and enhanced-idle distributions remain available.

All 84 corrected heap samples reported **zero surviving tree WeakRefs** after
teardown. This establishes sampled tree collectability only; independently retained
children/metadata and universal long-lived leak freedom are not proved. Ordinary
post-destruction process deltas remain roughly 0.64–0.66 MB, enhanced deltas roughly
1.78–1.82 MB. Those residuals are not attributed to library storage or leakage.
Optional history retention was not enabled; default transaction history is shared.

## Corrections, review and capability

The initial preflight used shaped empty trees and conflated pending ownership
with priming. Independent review caught this before the campaign. Its 54 raw runs
are preserved, not used as decision samples.

The original heap campaign's async frame retained its final constructed tree.
A diagnostic observed 9/10 cleared references. Its first helper variant accidentally
held the returned array (0/10 cleared); direct destructuring cleared all ten in
both arms. These diagnostic failures are preserved. A preregistered heap-only
correction moved fixture work into synchronous scopes. No timing samples were
rerun, discarded or selected for favorable results. WeakRef instrumentation adds
shared harness overhead; compare arms within v2 only.

The first summary call ran before the final profile completed and failed with
an empty-data StatisticsError. Summary generation subsequently ran on complete
data. Review also corrected an overly narrow noise check to include each arm's
own range; three original directional labels became unresolved. No observations
or acceptance criteria changed.

Independent reviewer `cost_review` verified artifact identities, process isolation,
work equivalence, heap-v2 reference lifetimes and key medians. Parent independently
rechecked hashes, counts and summaries. Review did not grant product acceptance.
A separate candidate-only probe passes new-key write, inspection, rollback, repeated
settlement and atomic preparation failure. It is not timed against unsupported
incumbent behavior. Existing broader correctness evidence remains separate.

## Disposition and tradeoff

The benefit remains owner-authorized whole-value new-key behavior with tested
capture/publication safety. Ordinary users pay its core footprint even if they
never add keys. Populated consumers in these fixtures pay small additional live
heap; no general CPU gain or slowdown is established. Transaction users receive
correct new-key responsibility, not demonstrated faster settlement.

Reused bundle evidence: candidate production gzip is **+673 bytes bare / +566
bytes entities** versus incumbent. The four unchanged budget overages are **560,
590, 426 and 414 bytes** (bare production/development, entities production/development).
No heap or timing result waives them. No ceiling/headroom increase is proposed as
implicitly accepted. Owner acceptance must explicitly cover the cost, benefit,
affected consumers and headroom; CPU/heap observations do not authorize a budget
change. Other open-key, restoration and semantic-scope readiness items remain open.

Omissions: framework observation/rendering, browser startup/parse, Link, failed-abort
injection cost, optional history, application traces and long-lived metadata
attribution. No universal production-superiority or release-ready claim.

## Evidence and replay

- [Timing and original distributions](DISTRIBUTIONS.md): original cleanup is
  superseded by the diagnosed fixture correction, not silently removed.
- [Corrected heap distributions](heap-v2-DISTRIBUTIONS.md).
- `summary.json` and `heap-v2-summary.json`: every metric's samples, ranges and A/A.
- `evidence.tar.xz`: raw campaigns, preflight, diagnostics, review, capability probe,
  environment data and before/after artifact hashes. `manifest.json` hashes files.
- [Harness](child.mjs), [heap correction](child-heap-v2.mjs), [runner](run.mjs),
  [heap runner](run-heap-v2.mjs) and [summarizer](summarize.py).

Replay with Node 24.15.0. The frozen runners reference exact pre-existing artifact
paths `/private/tmp/st-new-key-cost-20261018/{incumbent,shared}/dist/packages/kernel/dist`;
restore those source/build arms using the sibling artifact-cost setup/build recipe
if absent, and verify hashes before claiming exact artifact replay. Place harnesses
and heap-quiescence.mjs together in a fresh output directory. Runners refuse to
overwrite prior files:

```sh
node run.mjs
node run-heap-v2.mjs
node capability.mjs
python3 summarize.py
python3 summarize.py heap-v2
```

Each runner spawns Node with --expose-gc. Retain raw stdout/stderr and failures.
Measurement validity, product acceptance and release sign-off remain separate.
