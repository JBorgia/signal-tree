# Final cost execution-integrity review

**Pass within the supplied evidence. No execution-integrity counterexample found.** No workload rerun, benchmark, production edit or cost-interpretation verdict. Euclid's interpretation and cost tables were not consulted.

Run: `/Users/jonathanborgia/code/signaltree/artifacts/v16-acceptance-20261014/cost-final-8d`.
Final-input seal SHA-256: `fc921e38091bdcb0555e44d9b38425da82d4b3e29a66625cf516b32521624c6f`.
R5 preparation seal: `0b9cb6325173fd0da829d3a8db6684ee99f3994504b22c12481fcf14c07325c3`.

## Exhaustive execution checks

- **204/204 measurement rows:**108 write timing,48 memory,48 construction. Every preregistered configuration/round/arm occurs exactly once in the fixed order. Baseline A/B remain separate timing replicates; candidate maps only to the optimized import slot.
- **212/212 child receipts:**204 exit0 measurements and8 expected exit1 controls. Every receipt has null signal/error; no timeout, failed measured sample, skipped/replacement sample or duplicate ID. All204 measured processes have distinct recorded PIDs. All positive stderr files are empty.
- **848/848 run files:**exactly one stdout/stderr/receipt triple per child,204 validated records and8 control-check records. Directory contents match this set exactly. Aggregate receipts equal their individual files. The driver progress log contains precisely204 ordered completion entries,1 through204.
- Command argv, child path/hash, count, leaves, tree count/warmup, arm and mode match the schedule. Node24.15.0, V8, platform/architecture, NODE_ENV=production and ngDevMode=false agree across all positive rows; NODE_OPTIONS is absent in the recorded driver environment.
- Receipt intervals are serial and nonoverlapping, with child timestamps contained within their receipt interval. Run interval:2026-10-15 05:19:37.795–05:20:48.142 UTC (70.347seconds). Timing blocks fit their enclosing process intervals. CPU/wall values are finite and positive; per-operation CPU/wall and throughput arithmetic recomputes from raw totals/counts. CPU need not be bounded by wall time because process CPU includes multiple threads.
- Every validated row exactly equals its raw stdout JSON plus schedule entry. Every summary pairing/value list/median/range, memory byte-difference list and short-block list recomputes from those raw rows. This checks integrity and inclusion only; no relative-cost conclusion is made.

## Controls and useful work

All four negative mechanisms fail as intended on both arms: zero count; unknown mode; retained actual terminal handle while trees live; and no-op repeated rollback cycle. Each stderr contains its expected AssertionError, not an unrelated import failure or timeout. Negative stdout is empty, exit1, and each saved check matches its receipt and expected case.

Both mutant scripts were compared byte-for-byte to the declared single replacement in the positive child. The held mutant only retains h.p; the no-op mutant only substitutes a dummy handle for the repeated-cycle transaction. Initial real transaction checks remain. The no-op case specifically fails `cycle must create pending responsibility`. Positive child bytes match R5 and contain pending1 plus actual speculative scalar/entity checks before every repeated-cycle settlement. No extra mutation was found in these scripts.

All48 memory rows contain the required ordered checkpoints, finite heap values, exact heap-delta subtraction, convergence rounds within3–40, expected pending/tree/handle counts, and final watched-object count zero. Enhanced rows track initial handles plus first/last cycle handles (five per tree overall); watched counts grow exactly as specified. Both dispositions retain their separate result rows. All48 construction rows report128 created independent trees, all leaf checks, and zero pending responsibility for enhanced construction. These are the sealed assertions' completed outcomes, not a claim that every internal operation has an independent trace.

## Source, artifact and mutation integrity

All sealed preparation files match both the output copies and the reviewed R5 directory. Driver, positive child, construction child and helper hashes match environment/per-child receipts. Complete packages—including metadata/declarations/docs—match the final-input seal, both recorded pre/post inventories, and independently rehashed staged and original package directories:108 baseline files,110 candidate files. Full-package and JavaScript digests remain distinct between arms. Build receipt/log hashes, package metadata, source/installed lock hashes and copied install evidence agree.

Current read-only Git inspection still reports clean tracked source at baseline `19a5bd034d5ebef262f637c397bb41fe50a6a1e3` and candidate `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`. Shared isolated dependency-root/lock identities remain those sealed for the e467 frozen install. No persistent or undeclared mutation was detected. The terminal record is complete, failure:null, identitiesUnchanged:true; all recorded child statuses support it. The reported outer launcher exit0 is consistent with this record; no separate outer-process exit receipt was present among the inspected top-level cost files.

## Limits retained

Pre/post hashes and clean source cannot rule out an external transient modification restored between observations; this is an artifact-consistency audit, not continuous host attestation. No evidence of such a modification or hidden retry exists in the supplied run. The install's missing original start/finish timestamps remain explicitly disclosed. Final-source/build chronology was separately audited before execution and is bound by the unchanged input seal.

`host-before-cost-final.txt` records Defender100%, Chrome21.5% and active Codex; load readings also remain in each result. This is busy-host evidence, not a quiet-host certificate. No new performance threshold, acceptance decision, universal leak claim or inference from elapsed gate/run time is made here. Interpretation remains a separate review.

Audit implementation and machine-readable results: `/private/tmp/v16-final-cost-execution-audit.py` and `/private/tmp/v16-final-cost-execution-audit.json`. These only read/hash/recalculate existing evidence; no workload was rerun.
