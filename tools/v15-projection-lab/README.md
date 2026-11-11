# v15 long-lived collection projection

The retained candidate removes a repeated key-to-subject lookup from `all()`
without changing the public API. It lazily caches the active subject IDs in
order, then projects current values from that numeric array. Structural/key
changes invalidate the cache together with the existing key cache. A value
write keeps both orders valid, and each recomputed public value array remains
a fresh snapshot.

This addresses a concrete v15 application-profile lead: the previous projection
walked every ordered key, resolved each key to a subject, then resolved each
subject to its value. The active structural nodes already own those subject
identities. This is still an O(n) full collection read; it reduces repeated work
within that read. It does not make a global filter incremental or change the
fine-grained point-write contract.

The source base is published v15.4.8,
`37ef1788f6bac61678fc312f391b180bd7a6bbd7`. This branch is an optimization
candidate, not a new published version or full release qualification.

## Why the first attempt was rejected

The first attempt walked the live linked nodes with an internal callback on
every projection. It passed its correctness checks and improved a shorter
Angular aggregate comparison. The longer neutral comparison exposed the cost:
at 10,000 rows its cumulative CPU through 5,000 edits rose from 753.116 to
926.828 ms for full projection and 959.014 to 1,114.258 ms for filtered inventory.
Both directions resolved higher. The first 100 edits had improved, so stopping
at that short interval would have selected a regression for longer use.

That result does not by itself partition pointer chasing, callback dispatch,
compilation and GC. The second experiment removes repeated linked traversal and
callback invocation by using a demand-created contiguous identity array. The
first artifact, exact generator, source diff, controls and all 84 child receipts
remain preserved; its measurements are not pooled into the second cohort.

## Second matched screen

The [registered protocol](PROTOCOL.md) and [generator](compare.mjs) define eight
cells: 1,000/10,000 rows crossed with full projection, filtering, point-only
control and simultaneous `ids()`/`all()` demand. Each cell has two same-arm
control pairs and five alternating candidate/baseline pairs. All 112 fresh
serial children pass; both deliberate skipped-write controls fail. The offline
[analyzer](analyze.py) checks schedules, distinct PIDs, raw receipt values and
compiled artifact hashes before summarizing.

Both arms use production bundles exporting only `signalTree` and `entityMap`
from the installed kernel package. This is distinct from direct ESM barrel
imports, which can retain optional module registration. Node 24.15.0, Apple M4,
production mode; the shared host can still contend despite serialized benchmark
work. The second cohort's observed ranges remain in its analysis JSON.

Each child keeps one six-field-row store through 100, 1,000 and 5,000 edits.
The following CPU includes setup and all 5,000 edits in that same child. It
excludes the explicit full-state oracle and forced-GC checkpoints. Values are
medians across five children, in milliseconds.

| Rows | Observable task after each edit | v15.4.8 | Candidate | Direction |
| ---: | --- | ---: | ---: | --- |
| 1,000 | Full value array | 87.364 | 62.014 | Lower |
| 1,000 | Full array and active-row filter | 118.987 | 94.074 | Lower |
| 1,000 | Edited row only | 35.502 | 36.203 | Unresolved |
| 1,000 | IDs and full value array | 106.995 | 80.123 | Lower |
| 10,000 | Full value array | 921.381 | 392.077 | Lower |
| 10,000 | Full array and active-row filter | 1,557.174 | 860.650 | Unresolved |
| 10,000 | Edited row only | 101.045 | 98.427 | Unresolved |
| 10,000 | IDs and full value array | 1,576.016 | 700.732 | Lower |

The 10,000-row filtered task improves in every matched pair, but the broad
observed ranges fail the registered direction rule. Its favorable median is
not promoted into a resolved claim. Setup and point-only differences remain
unresolved. Cumulative early-checkpoint results and each separate segment are
retained, rather than summing phase percentiles into a synthetic session.

## Memory and delivered code price

Reading only values substitutes the new subject array for the old key array.
Its 10,000-row final live-heap medians are effectively equal in this screen
(6,323,328 versus 6,323,760 bytes above imported baseline, unresolved). A store
that also requests IDs retains both arrays: 6,417,688 versus 6,498,440 bytes,
an observed 80,752-byte increase. This is the intended cost of avoiding repeated
key lookup when both projections are demanded, not a claim of zero overhead.

These are whole-process forced-GC observations. Synchronous GC does not end a
JavaScript job or release WeakRef-kept targets; destruction yields to a later
turn before its checkpoint. The finite traces do not prove universal cleanup
or unlimited memory bounds.

The neutral production bundle is 89,579 bytes for frozen v15 and 90,002 for the
candidate, a 423-byte raw increase in this fixture. Python `gzip.compress` at
level 9 with `mtime=0` measures 28,108 versus 28,157 bytes (+49); the receipt is
`evidence/bundle-bytes.json`. Actual repository bundle ceilings and the production
demo are validated separately. Bundle SHA-256:

- Frozen: `dbdfe97d42051946f4f8ea01922f20b3b6317951bc6b57e65a9eec85441ef429`
- Candidate: `6033bb9c4607a0820d525eb9a9e936cee597f3aa3ab44a02b42acfc42179337b`

## Correctness and reproduction

The candidate passes 206 focused tests across eight files: structural order,
held snapshots, key/payload distinction, same-key entity replacement, rollback,
cached ID identity, sorting, external query dependencies, omission and reentry.
Removing every subject-cache invalidation makes seven of the nine dedicated
projection contract tests fail. The mutant is restored before the uncached
candidate build.

Final affected validation completes:

- Full kernel: 432 files, 7,842 passed tests; seven expected failures, thirteen
  skips and one todo remain explicitly reported by the existing suite.
- Full Angular: 214 passed tests; three existing skipped tests.
- Source typecheck passes. The spec-type ratchet has no new errors; its 222
  existing errors across 36 files remain debt, not a clean typecheck claim.
- Lint ratchet, API baseline, tree shaking, source controls, README API checks,
  declaration documentation and documentation links pass.
- Strict uncached production demo build passes its unchanged configuration.
- A fresh five-package gate build and the demo build leave all 109 measured
  candidate kernel files byte-identical to the timed artifact.

The selected gate command reports **7/8 passed**, with the development bundle
budget still numerically failing:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false CI=true node tools/verify-gates.mjs --only=lint:budget,api-baseline,tree-shaking,declaration-docs,doc-links,readme-apis,source-controls,bundle-budget
```

The unchanged entities fixture measures **25,269 production gzip bytes**, below
its 24.7 KiB ceiling (25,292.8 bytes). Development measures **28,194 bytes**
against 27.5 KiB (28,160 bytes), exceeding it by **34 bytes**. Both bare-tree
ceilings pass. Frozen v15 measures 25,222/28,147 bytes in the identical production/
development fixtures: the candidate adds 47 gzip bytes to each. Exact-byte
diagnostic runners preserve the canonical fixture and
build settings while printing unrounded output; the original failing gate log
is retained separately.

The owner's instruction is to weigh budgets against cost and feasibility. The
central task's disposition accepts this 34-byte development-only excess for the
measured repeated-read benefit, explicitly priced cache and unchanged passing
production ceilings. No ceiling was changed and no source was compressed merely
to turn the gate green. This economic acceptance is separate from its numerical
failure; it is not a claim that all release gates pass. Publication and version
changes are outside this branch's scope.

The first new test incorrectly assumed `changeId` rewrites the payload ID.
Unmodified v15 disproved that assumption; the test now separately asserts the
collection key and unchanged payload. That initial failure remains in evidence.
An initial Nx invocation stalled before test output with isolated plugin workers;
subsequent invocations use `NX_ISOLATE_PLUGINS=false`.

Generating commands from this checkout:

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false CI=true pnpm nx build kernel --skip-nx-cache
node tools/v15-projection-lab/compare.mjs compare /var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-application-lab-xmhw_k7_/application-baseline-4/v15/node_modules/@signal-tree/kernel dist/packages/kernel /private/tmp/st-v15-projection-comparison-2
python3 tools/v15-projection-lab/analyze.py /private/tmp/st-v15-projection-comparison-2
```

The receipt bindings preserve every installed package file, both compiled
metafiles, the runner, exact source diff and raw samples. A replay needs those
frozen package inputs and the pinned build toolchain; current npm/latest output
is not an equivalent substitute. The parent application study separately owns
Angular comparisons and the broader v15/v16 business interpretation.

The [evidence archive](evidence.tar.gz) contains both cohorts, exact installed
kernels, failed first candidate, raw validation logs,
sources and bindings. Its [checksum](evidence.sha256) and
[receipt](archive-receipt.json) identify the immutable packet. From this directory:

```sh
shasum -a 256 -c evidence.sha256
python3 verify-evidence.py evidence.tar.gz
```

The verifier checks the complete recorded payload set, hashes and lengths;
it does not claim complete repository history, signed authenticity or that every
external toolchain/browser dependency is included. The archived second-cohort
runner is its exact executed source. The current runner additionally captures
staged source changes in `sourceDiff`; this metadata repair occurred after timing
and does not change the measured runtime or workload.
