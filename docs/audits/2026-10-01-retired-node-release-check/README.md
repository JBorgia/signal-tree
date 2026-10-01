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
