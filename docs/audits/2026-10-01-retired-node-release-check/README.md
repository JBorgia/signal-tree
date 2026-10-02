# V15 retired-node release measurement

Status: OPEN; preregistered after the first exact-candidate Linux failure and
before the diagnostic batch. No release waiver or new threshold is authorized
by this record.

## Preserved failed candidate

`26cc7ffb196e9e665bd92fff59dad8ed66412dec`, Validate run
[36939452876](https://github.com/JBorgia/signal-tree/actions/runs/36939452876):
85/86 gates passed, one failed, zero known-red, exit 1. The failed gate was
`retired-subject-slope:node-reads`; later mutation/consumer steps did not run.
The independent demo job passed. Local full gates, mutation proofs and fresh
artifact checks passed on that SHA; this does not override the Linux result.

The gate's `no-history-node-reads` arm produced:

| Retired entity lifetimes | Fresh-process growth samples, MiB | Minimum |
| ------------------------ | --------------------------------- | ------- |
| 50,000                   | 16.17, 16.17, 4.18                | 4.18    |
| 150,000                  | 15.32, 15.31, 15.31               | 15.31   |

The selected endpoints imply 117 bytes/additional retired lifetime under the
current estimator, above its 20-byte limit. This is a failed measurement. The
samples alone do not identify the retained objects or establish that their
cross-process difference estimates per-lifetime retention.

The estimator's claim that net `after - before` measurements have only positive
noise requires evidence; a minimum of three does not guarantee the same runtime
population at both endpoints. Prior v16 observations are useful hypotheses,
not validation for this different v15 node-read workload. Its 40 MiB ceiling
must not be copied without validation. The activation-carrier cleanup in
`87a6b116` remains a correctness requirement, independent of this measurement.

## Diagnostic protocol frozen before execution

Use the unchanged candidate runtime, the existing quiescence protocol and a
fresh process for every sample. Add measurement tooling only. On the actual
`ubuntu-latest` release environment, with the repository's pinned Node version:

1. 30 controls: `no-history-node-reads`, 50 rounds, retain 0.
2. 30 controls: the same arm, 150 rounds, retain 0.
3. 10 mutation samples: same arm, 150 rounds, strongly retain 10,000 `byId()`
   handles whose entity lifetimes retire during the workload.
4. 10 blindness controls: same mutation targeting/touching, strong retention
   neutralized, 150 rounds.
5. 10 reference controls: existing `no-history-reads`, 150 rounds, retain 0.
6. 10 actual cleanup-regression samples: node-read arm, 150 rounds, retain 0,
   against an isolated copy of the built kernel with exactly the
   `subjectStateSignals.delete(subjectId)` cleanup removed. Verify the unique
   mutation anchor and record the mutated artifact identity. Never mutate the
   verified candidate artifacts. This addition was preregistered before any
   diagnostic batch, following independent review.

Keep width 1,000 and all ordinary state work identical within comparisons.
Record every sample, not only an aggregate: raw heapUsed/heapTotal/RSS before
and after, V8 heap and space statistics, GC settling rounds, Node/V8 versions,
platform/architecture/PID, workload parameters, exact source SHA and complete
built kernel identity. Preserve failed child executions. No retry-to-green.

This tests deliberately retained retired-node handles; it does not establish a
one-handle/one-internal-object correspondence. It also does not by itself prove
sensitivity to the smaller WeakRef-map-entry regression fixed in `87a6b116`.
That mechanism needs its own falsifier, preferably deterministic rather than
another inference from aggregate heap size.

## Decision rules

- Attribute discrete populations only to heap spaces actually measured; do not
  infer the V8 allocation/GC mechanism from the spacing alone.
- If control populations overlap across workload sizes, do not continue claiming
  that their chosen difference resolves a small linear retention slope.
- Deliberate retention must reliably separate from control under the same fixed
  protocol; neutralizing it must return toward the control distribution.
- Any replacement measurement must state its sensitivity and blind region.
  Test real cleanup regressions separately when a gross-retention measurement
  cannot see them.
- A threshold chosen from this characterization requires a subsequent independent
  validation batch with that threshold frozen. Do not tune it until green.
- Do not remove, weaken or waive the existing gate before the evidence and its
  independent review justify a replacement contract. Runtime bugs, if found,
  require their own failing tests and repairs.

No result from this diagnostic work authorizes v16 integration or publication
of the failed candidate. Finish v15 qualification first.

## Harness qualification before Linux dispatch

Syntax checks and a six-process miniature plumbing run passed. Retained and
neutralized cells performed identical workload reads and held four/zero handles.
The isolated cleanup mutant used a distinct built-kernel manifest. The tool
records the child working directory and requires its reported kernel entry to
match that directory; complete original and mutant manifests are verified again
at the end. The first added provenance check exposed a macOS `/var` versus
`/private/var` path alias, not a wrong artifact import. Canonicalizing the child
working directory fixed that false negative; the subsequent six-cell run passed.
The failed smoke output remains at
`/private/tmp/st-retention-review-smoke-provenance`, and its corrected control at
`/private/tmp/st-retention-review-smoke-realpath` on the development host.

Independent routing review found no dispatch blocker. These miniature runs prove
plumbing, not memory sensitivity. A separate isolated-artifact prototype found
79 cleanup checks passing, 33 failing after removal of the actual activation-map
cleanup statement, and 79 passing after restoration. That is mechanism-specific
white-box evidence, not a replacement heap contract or a release waiver.

## Characterization result (before threshold selection)

Run [36941924557](https://github.com/JBorgia/signal-tree/actions/runs/36941924557),
head `79b754cb38e89a81336969fd33c4317c34184509`, completed all 100 planned
processes with zero execution/identity failures. Node 24.15.0, V8
13.6.233.17-node.48, Linux x64, Ubuntu 24.04 runner image 20260927.320.1;
heap limit 4,496,293,888 bytes. The generating command was
`node tools/characterize-retired-node-memory.mjs`, using the registered defaults.
[All child measurements and artifact manifests](linux-characterization.json)
are preserved, together with the SHA-256 of the full downloaded results.

| Cell                      | Processes | Growth minimum–maximum (MiB) |
| ------------------------- | --------: | ---------------------------: |
| `node-reads-low`          |        30 |               4.2357–16.2320 |
| `node-reads-high`         |        30 |               3.3564–16.2350 |
| `node-reads-retained`     |        10 |              96.4230–96.4676 |
| `node-reads-neutralized`  |        10 |              15.3411–15.3519 |
| `byid-only-control`       |        10 |                3.2922–3.3013 |
| `carrier-deletion-mutant` |        10 |              14.9112–27.7861 |

All 102 built kernel files from this Linux run match the locally verified
`26cc7ffb` artifact byte-for-byte. Instrumentation differs from the original
failed run: the new snapshots/counters can affect allocation and timing. Its
cost has **not** been proven constant. These are diagnostic-protocol results,
not an unchanged-instrument rerun of the original gate.

Control distributions overlap across workload sizes. The actual cleanup mutant
also overlaps the healthy node-read distribution. These observations do not
prove zero retention; they show why the aggregate difference cannot reliably
certify this small cleanup regression. The direct Map-entry test distinguishes
that regression without inferring it from heap totals.

The sampled `large_object_space` used sizes expose discrete populations: the
low control endpoints contain 4.25 or 16.25 MiB; high controls contain 4.25,
8.25 or 16.25 MiB. This locates the observed discrete space variation; it does
not identify its allocation/GC mechanism. The mutant additionally increases
old-space usage. Grouped cell execution permits time/order confounding; neither
a constant overhead nor an asymptotic bound follows from these finite samples.

Holding 10,000 retired handles produces a separate gross-retention population;
neutralization returns to the high control population. This proves sensitivity
to that deliberate strong hold under this protocol, not every small lifetime
leak. Any newly selected ceiling still requires a frozen independent validation
batch. No release-gate verdict has changed at this checkpoint.

## Frozen replacement candidate and independent validation

Selected **after characterization, before validation**: a **40 MiB growth
ceiling** for each fresh-process sample of the fixed width-1,000 / 150-round
workload, separately for the lookup-only and node-read arms. This is an
engineering tripwire for gross retention: the observed healthy maximum is
16.235 MiB (23.765 MiB margin) and the smallest deliberate 10,000-handle sample
is 96.423 MiB (56.423 MiB margin). It is not expected memory usage or a small
per-retirement bound. The number is being selected for this v15 instrument and
must earn independent validation; prior v16 acceptance does not validate it.

Each normal gate run will check three independent samples and require **all**
to meet the fixed ceiling. No minimum, median, favorable retry or ratio decides
that verdict. The heap check is explicitly blind to the observed smaller
activation-map cleanup mutation. A separate deterministic built-artifact guard
must detect that exact deletion regression, retain survivor identity and prove
held old nodes do not retarget. Existing lifetime/revision and restoration
contracts remain required; the new heap check makes no claim to detect every
small retained object population.

The lookup-only estimator has a separate historical warning, not merely an
inference from node-read data: `b2341c3d` records opposite old-estimator verdicts
on an unchanged lookup workload, then replaces the median with a minimum using
an unsupported one-sided-noise argument for net heap deltas. Its canned-number
self-test does not validate real-world estimator resolution. The independent
batch below includes both arms, so no node-read threshold is silently promoted
to lookup-only protection.

The independent Linux validation plan is **150 fresh processes**, interleaved
round-robin in the listed cell order by sample index (skip exhausted cells):

| Cell                              | Rounds | Samples | Expected heap verdict |
| --------------------------------- | -----: | ------: | --------------------- |
| Node-read control                 |     50 |      20 | pass                  |
| Node-read control                 |    150 |      30 | pass                  |
| Lookup-only control               |     50 |      20 | pass                  |
| Lookup-only control               |    150 |      30 | pass                  |
| Node-read retain 10,000           |    150 |      10 | fail                  |
| Lookup-only retain 10,000         |    150 |      10 | fail                  |
| Node-read retention neutralized   |    150 |      10 | pass                  |
| Lookup-only retention neutralized |    150 |      10 | pass                  |
| Node-read actual cleanup deletion |    150 |      10 | descriptive only      |

The cleanup-deletion heap results have no required direction: characterization
already demonstrated that this gross ceiling misses that mechanism. Instead,
run the deterministic guard against the original and isolated cleanup-deletion
artifacts on Linux and require actual exits 0 and 1 with cleanup-specific
failures, respectively. A discovery error, crash, or missing result is not a
successful mutation proof.

Use the same diagnostic benchmark, Node pin, GC flags and runner family.
Preserve every raw sample and identity; report all deviations. Any healthy or
neutralized sample exceeding 40 MiB, any intentional 10,000-handle sample at or
below 40 MiB, or any failed deterministic/control identity check blocks
promotion. Do not adjust the threshold from validation samples. Small plumbing
runs must be labeled non-qualification. Only after independent review of this
batch may the new checks replace the old slope verdicts and terminology.

### Additional direct correctness obligation before promotion

Independent review found a second assertion gap: the historical
`entity-lifetime-ledger-null.spec.ts` revision-resurrection row observes
`resolveSubjectHandle`, which returns `missing` before consulting revisions when
lifetime state is absent. That observable result cannot prove the revision Map
entry was deleted. The standalone guard must also observe populated lifetime
and revision Maps directly, check their current entries after retirement and
after notification delivery, and kill the historical mutation that publishes a
forgotten subject again after retirement. Unchanged and restored artifacts must
pass. This is a test correction, not evidence that production currently performs
that mutation.

The Linux validation must include the standalone guard's isolated-artifact
self-test for cleanup deletion, post-forget revision publication, and late-read
registration after permanent removal.
These short guard subprocesses are additional to the 150 registered heap samples.
Promotion requires exactly all expected heap records, successful execution and
quiescence, finite raw endpoints, correct workload postconditions and matching
artifact identities. A missing sample or invalid number fails qualification.

### Confirmed runtime boundary before independent validation

The bounded late-first-read probe on the unchanged `26cc7ffb` artifact found
one activation WeakRef entry recreated by reading a held node for the first
time **after** zero-owner removal. The entry remained after dropping that
handle and flushing microtasks while the tree stayed alive. Already-read nodes
created no new entry, and a restoration-owned tombstoned node reactivated on
undo. This is a concrete cleanup defect, not a heap-slope inference. Evidence:
`/private/tmp/st-late-first-read-uiunvx5j/{probe.json,receipt.json,probe.mjs}`.

The independent validation has not run. Its candidate must include a focused
regression and the narrow missing-lifetime first-read repair; keep restoration
subscription and post-tracking resolution intact. The fixed threshold and
150-sample protocol remain unchanged. Consequently, the validation artifact
will differ from characterization; identify that change explicitly rather than
claiming byte-identical runtime evidence across these two phases.

The narrow repair registers a newly created activation carrier only while its
entity lifetime still exists. Permanently forgotten references keep any carrier
caller-owned; restoration-owned tombstones remain registered. Six source tests
ran against unchanged runtime first (4 failed, 2 passed), then the repair
(6 passed). The built original candidate also fails the extended guard. All
three isolated source mutations produce control/mutant/restored exits 0/1/0.
The first development build emitted output but was terminated after remaining
idle and exited 1; its emitted artifact is diagnostic evidence only. A successful
build was then completed outside the sandbox (exit 0, `kernel-build-host.log`);
the exact cause of the earlier idle process was not established. Raw local evidence: `/private/tmp/st-late-read-fix-proof/`.
