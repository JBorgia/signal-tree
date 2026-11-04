# Runtime responsibility attribution — complete, HOLD

The measured candidate remains frozen at `3eabc01ddab71f16b8def0172c43c344bfd08731`
(runtime `fe18a8e1c1f3da42727341d6c6fa30a407c1461e`). This finite experiment
explains the original count and demonstrates one removable copy. It does not
resolve the absolute point-work requirement or establish runtime-cost recovery.
No runtime change is adopted; activation, push, merge and publication remain
unauthorized. The implementation is restored after collecting prototype evidence; the public
late-history fixture passes against the restored runtime.

## What causes the13,000 visits

The [55-path ledger](LEDGER.json) reconciles every charge at both2,000/20,000 rows,
with tracing on/off. The unchanged workload performs200 distinct two-field row
updates. The original counter charges yielded iterator elements and selected
array/Object operations, including nested charges. Visits are not CPU instructions.

| Observed responsibility | Visits across200 writes |
| --- | ---: |
| Native preparation excluding row copies | 3,600 |
| Four row-map copies per write, two entries each | 1,600 |
| Admission normalization | 1,800 |
| Source composition | 1,200 |
| Ordinary topology | 1,000 |
| Source footprint/packet construction | 1,000 |
| Value equality | 800 |
| Location delivery | 600 |
| Write key enumeration | 400 |
| Physical value transition | 200 |
| Source finalization dispatch | 200 |
| Publication input capture | 200 |
| Completion dispatch | 200 |
| Source completion | 200 |
| **Total / unclassified** | **13,000 / 0** |

Observed phase calls separately include200 native preparations,200 requirement
preparations,200 window finalizations and400 proof calls (200 cached/200 materialized).
Known-owner/input/frame/pending populations are zero in this particular workload.
Window/proof phases therefore contribute zero charged visits while still running;
this does not establish zero CPU or universal emptiness. The observed count
supports size independence at the two tested sizes, not a general complexity proof.

## Responsibility versus representation

A late collection consumer is created after an earlier ordinary write during a
foreign pending transaction. It then declares an independent sibling-field write.
The baseline holds delivery until the foreign owner confirms or rolls back;
separate tests exercise both outcomes and exact delivered values. Omitting native
preparation only for the earlier ordinary write causes premature delivery in both
cases. Later independent writes and disposed-consumer refusal are asserted.
Earlier history cannot simply be dropped because no consumer exists yet.

That counterexample establishes a responsibility, not necessity of every current
map, proof or traversal. The remaining12,600 visits are **not proved mandatory**.

The sole prototype reuses the already detached physical image for a singleton
admitted ordinary edit. Missing pairs and multi-edit sequences retain copies.
It removes exactly200 copies/400 copied-entry charges:13,000→12,600 (65→63 per
write). Three other row-copy categories remain unchanged. Independent saved-reader
controls cover reuse on/off, paired singleton, missing pair, repeated edits,
installation, refused preparation and later writes:6/6 pass.

A deliberately retained internal source keeps its row maps observable after tree
destruction. Population counts stay at rows=N/fields=2N across the sampled writes.
This is reachable-state evidence, not a demonstrated tree leak. Whole-process heap
measurements and scoped WeakRef clearance are reported separately; no dominator
or allocation attribution is claimed.

## Verification and costs

Commands and full source manifests are preserved in the evidence archive.
Node24.15.0/pnpm10.17.0; Nx tests with cache disabled and one worker.

- Corrected instrumented/focused run:35 passes. Planted7-charge and throwing
  undefined/patch-restoration controls run independently of the failing bound.
- Independent reader fixture:6 passes.
- Uninstrumented original point suite plus focused history/pairing/publication
  suites:70 passes, one failure. Original assertion remains `<2000`; measured
  result12,600 at both sizes. No threshold or test was weakened.
- Five-package canonical build passes. Production demo compilation reaches bundle
  generation but its unchanged570kB numerical size ceiling fails at807.46kB.
  Size already has owner disposition; this is preserved as a failure, not relabeled
  a passing build. No new production browser or full outer mutation proof claimed.
- Fresh uninstrumented cost campaign:84/84 valid serial children,7 profiles;
  two A/A controls then5 alternating pairs per profile. All source/artifact/harness
  checks match, no global stop, no recorded owned survivors. All24 heap children
  clear their10 sampled WeakRefs. This is a finite scoped check.

| Persistent/process heap delta, bytes | Frozen median | Prototype median | Registered interpretation |
| --- | ---: | ---: | --- |
| Populated live−baseline | 17,756,264 | 17,757,656 | Unresolved (+1,392) |
| Pending live−baseline | 20,480,224 | 20,484,248 | Unresolved (+4,024) |
| Pending settled−baseline | 20,396,000 | 20,396,400 | Unresolved (+400) |
| Pending live−primed idle | 1,033,336 | 1,031,960 | Unresolved (−1,376) |

All five synchronous wall, synchronous CPU and total CPU comparisons are unresolved
under the registered range/variability rule. Some median reductions are large but
ranges overlap; those are not established gains. Pending process baseline and
pre-drain live−baseline classify lower; neither establishes persistent recovery.
See [all distributions](COST-DISTRIBUTIONS.json), [registration](COST-PREREGISTRATION.json)
and [structured result](RESULT.json). Dimensions do not compensate for one another.
The four relevant documentation gates pass. Independent review recomputed63 classifications from756 raw metric rows without
discrepancy; [review record](INDEPENDENT-REVIEW.md) distinguishes source findings
from main-agent execution.

First failures are retained: initial trace reconciliation accidentally included22
setup charges; interval scoping corrected it. Trace overhead exceeded5seconds;
only the diagnostic timeout became30seconds. A newly written population test
incorrectly assumed held-source maps clear on destroy; source inspection disproved
that oracle and the test now records reachable populations explicitly. Two guard
preflight attempts stopped before child launch (stale manifest/blocked ps). An
initial build invocation forwarded Nx flags into an executor and failed schema
validation; the corrected canonical invocation passed. No favorable cost retries.

## Review delivery and path forward

[Evidence manifest](EVIDENCE.json) binds the exact archive, including raw counters,
resource receipts, source manifests, cost children/harness and193 prototype package
artifacts. [Experiment fixtures and patches](../../../tools/runtime-responsibility-attribution/README.md)
are diagnostic records, separate from frozen source. Absolute temporary paths in
receipts record original execution; use bundle root/path mappings when replaying.

The external source bundle supplies original candidate/predecessor snapshots,
original Git commit objects, manifests and SHA256/Git-blob verification, plus the
prior qualification archive and this experiment. Historical binary archives and
PDF/DOCX references are explicitly omitted by hash; historical archive-input gates
need those omitted payloads. No dependencies, complete Git history or fresh release
proof are implied. The configured remote is `JBorgia/signal-tree`, not
`JBorgia/signaltree`; local commits have not been pushed.

The finite experiment closes with HOLD. A next implementation effort needs a
specific bounded representation question, or the owner can explicitly accept a
failed point-work gate with a workload/cost envelope. Neither has happened here.
Release additionally requires runtime-cost acceptance, full current outer mutation
proof and authorized release preparation. No automatic optimization/pilot queue
is opened by these results.
