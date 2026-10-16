# Comparative authority vertical slice — bounded result

Arm B demonstrates the specific capability under investigation: it can reveal the correct hidden surviving value after overlapping rejection **without retaining a full-store canonical mirror**. Arm A demonstrates the same tested settlement behavior with an authoritative map plus native projection. The current B implementation costs less on the successful model workloads. Neither is accepted: independent review preserved a shared failed-abort reporting counterexample, and the comparison does not establish production equivalence or an architectural winner.

Production source remains paused and unchanged. Exact incumbent control is `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`. The prior rejected integration `9b9b0b35a7dd207df366047ef5c9621168a2b405`, failure analysis `41dc84d73c1d36399ca632cfa711db3bc6a42a94`, and frozen R3 are preserved separately. This record adds only research models, tests and evidence. No push, merge, tag, publication, ceiling change, v15 edit or public API acceptance.

## State model and authority

Read [CONTRACT.md](CONTRACT.md) for exact boundaries. A/B are neutral reactive models, not another production bridge. They support explicit scalar/branch-cell presence, flat atomic branch records, flat entities with non-reused lifetime identity, local authored ordering, one-step undo, pending transactions, queued coherent observation, reentry and preparation faults. A branch containing a present undefined member differs from an empty branch and from an absent branch. They do not model arbitrary nested terminal granularity, ordering/rekey, Link/network authority, all restoration history, four-framework integration, or async callbacks.

**Arm A** uses one authoritative mutable location Map containing committed facts and pending contributions. Native values are a private reactive projection. Every modeled write, undo and settlement enters its prepared installation unit. There is no independently writable native API. This is authoritative sparse state, **not** the rejected persistent AVL implementation. Its copied per-location pending Maps scale with overlapping contributions at touched locations.

**Arm B** uses native current-state Maps and allocates ownership ledgers only where pending obligations exist. A ledger retains one hidden canonical fact and sequence-tagged contributions. Ordinary writes intersecting it update the surviving committed fact; accepting an older contribution cannot promote it over newer truth. Reject selects surviving truth, not an unconditional captured-before value. Last-owner retirement installs the resolved native value before deleting the ledger. Separate one-step undo history remains an explicit live obligation.

The hidden-value trace is decisive within this model:

| Step | Visible value | A canonical locations | B hidden base facts |
| --- | ---: | ---: | ---: |
| Ordinary x=1 | 1 | 1 | 0 |
| P1 writes2 | 2 | 1 | 1 |
| P2 writes3 | 3 | 1 | 1 |
| Reject P1 | 3 | 1 | 1 |
| Reject P2 | 1 | 1 | 0 |
| Destroy | unavailable | 0 | 0 |

`hidden-values.jsonl` preserves values and counters at every step. Holding a hidden base while live obligations need it is not a second whole-store current-truth authority. This result does not prove that the pending-only representation covers production structural dependencies; those were deliberately not smuggled into this slice's acceptance claim.

## Common outcomes and preserved failures

Final immutable assertions in `tests.mjs` run unchanged against each arm:

| Arm | Pass | Fail | Unsupported by adapter |
| --- | ---: | ---: | ---: |
| A | 40 | 1 | 0 |
| B | 40 | 1 | 0 |
| Incumbent control | 25 | 8 | 8 |

Both arms pass original restoration undo-before-later-rollback, useful overlapping acceptance/rejection, newer committed truth and ABA, branch absence/undefined, same-lifetime revival, replacement isolation, coherent mixed publication, observer writes/nested settlement/throws, early and after-first-location preparation faults with retry, and logical reclamation checks. Native/state installation and ownership/terminality finish before observer delivery. The prepared commit region contains no user callbacks; arbitrary allocation failure during trusted Map/Set updates is not covered.

The control's eight negative results are **not eight new production regressions**: five are conservative settlement refusals, one is unsupported nested transaction execution, and two expose stronger fixture policies (defensive branch output copying and mandatory rejection of getter-reentrant entity update). Control preserves the getter's independent write and permits the outer update; this has not been declared incorrect. Eight adapter-unsupported cases consist of six unified preparation-fault/recovery probes and two internal counting/reclamation observations. Unsupported never counts as successful runtime behavior. This prevents any whole-contract production ranking.

**Permanent case41 fails both arms.** An extensible Error already has a nonconfigurable own `recovery` property. The callback writes speculative state, arms an abort-preparation failure and throws that original Error. Both arms then try `defineProperty(error,'recovery',...)`, throw `TypeError: Cannot redefine property: recovery`, replace the original error and leave pending authority without the intended recovery access. Source and raw probe show one retained pending owner and visible speculative state. The final test asserts exact original-error identity and stays red. This is a shared reporting/authority-access gap, not evidence preferring A over B. No new recovery API was invented to make it disappear.

First failures remain in the archive:

- The first harness incorrectly demanded undo during a pending contribution, despite the declared permitted refusal. Corrected to require unchanged state/history/authority on refusal, then useful rejection and undo. Original restoration counterexample assertions never changed.
- The first control adapter read cached aggregates during callbacks. Direct native reads fixed that measurement shim; no runtime source changed.
- The control's ordinary/history setup needed an explicit flush boundary to isolate the intended undo command. Initial result is preserved, not presented as a production bug.
- Review found that observer assertions could be swallowed. Final harness drains unexpected errors; explicit observer/recovery errors are checked by identity. No observer result silently passes after an assertion throw.
- A cloned entity input before capturing preparation revision; getter reentry escaped validation. First source/probe preserved, cloning moved inside the preparation boundary.
- B exposed mutable branch aliases. First source/probe preserved; supported ingress/read payloads now use detached copies under revision validation.
- Repeated removal of visible absence differed. Exact control matched B for scalars and threw for missing entities. Both arms now preserve that policy; A's extra absence contribution was not counted as a gain.
- Exploratory nested payload/control-row wrapper differences are preserved. Control now uses natural flat native entity fields and actual replaceOne; no artificial deep clone hides control behavior.
- The first cost control observer wrapper materialized a full snapshot that its callback ignored. That harness-added work was removed, the entire first cohort retained, and all57 measurements repeated.

## Work, allocation and retention measurements

All successful timed cycles validate intermediate and final values, terminal state, retry and unexpected observer errors. Workloads: ordinary field1→0; one pending write then rejection; two overlapping writes with older-then-newer rejection; and observed pending/rejection with exact [1] then[0] delivery. The control is not timed on overlapping rejection it cannot complete. Snapshot enumeration is outside these point workloads.

Common operation counters after each 1,000-cycle cohort:

| Workload | A/B native writes per cycle | A/B installed units per cycle | Observers delivered per cycle |
| --- | ---: | ---: | ---: |
| Ordinary point1→0 | 2 / 2 | 2 / 2 | 0 / 0 |
| Pending write/reject | 2 / 2 | 2 / 2 | 0 / 0 |
| Two overlapping writes/rejections | 4 / 4 | 4 / 4 | 0 / 0 |
| Observed pending write/reject | 2 / 2 | 2 / 2 | 2 / 2 |

At both32 and1024 entities, one pending cycle performs A2 touched-location visits plus1 pending-resolution visit; B's combined visit count is3. Neither enumerates untouched entities. Both copy/scan pending entries at a touched location, so this is not a constant-work claim for unbounded owner fan-in.

For the same entity pending cycle, A reports3 prepared cell wrappers,6 cloned prepared object nodes and2 read-cloned object nodes; B reports2 prepared cells,2 fact objects,2 ledger copies,2 contribution-entry copies and4 cloned object nodes including reads. These counters have explicit meanings and are **not interchangeable total-allocation counts**. Common clone-node counting for this workload is8 A versus4 B. Neither uses the prior AVL index. A retains1024 authoritative locations plus1024 native projection locations; B retains1024 native locations and0 ownership locations after settlement. Pending removal temporarily retains B's one base fact and releases it after successful restoration. One hundred remove/recreate operations leave no model-owned retired record, while held references remain detached. These are logical structure checks, not a GC/dominator proof.

## CPU and heap: matched successful models only

Node24.15.0, fresh processes, three alternating samples per arm/workload,31 warmups,1,000 measured cycles.57 final processes all pass. Timing includes assertions and each arm's flush; collection setup is outside timed cycles. Process CPU is user+system time, not sampled main-thread percentages. This experiment does not reuse earlier profile percentages to explain any regression.

Median process CPU µs/cycle, final cohort:

| Workload | Entities | A | B |
| --- | ---: | ---: | ---: |
| Ordinary two writes | 32 | 10.671 | 6.329 |
| Ordinary two writes | 1024 | 10.489 | 6.617 |
| Pending write/reject | 32 | 10.335 | 7.373 |
| Pending write/reject | 1024 | 9.531 | 5.988 |
| Overlapping rejection | 32 | 14.213 | 10.524 |
| Overlapping rejection | 1024 | 14.286 | 10.610 |
| Observed pending/reject | 32 | 13.291 | 10.115 |

Raw incumbent common-workload timings are included, but do not establish a speedup over production: it implements materially more behavior and uses real kernel/restoration/lifecycle/notification machinery. Control flush uses setImmediate, A flush uses a microtask loop, B drains synchronously; this scheduling cost is included. A makes more defensive internal payload copies; immutable sharing could reduce them without changing authority design. Thus observed B advantage is an **implementation result**, not a lower bound for A or proof B always wins.

Whole-process post-GC heap increase from empty store to seeded store, median: at32 entities A70,416 bytes versus B42,264; at1024 A776,200 versus B263,912. These include construction/runtime effects and are not retained-object or leak measurements. Three explicit GC calls separate phases. Store/closure references still exist after destroy, so after-destroy heap is not a lifetime-reclamation proof. Full distributions, post-loop heap and source hashes are in `measurements/summary.json` and `raw.json`. No ceilings changed and no new bundle claim was made for these unintegrated models.

## Independent review and disposition

Premise review verified A's authoritative/projection distinction and B's pending-only hidden-fact handling; it supplied the preclone, alias, missing tests and shared recovery-collision findings. Root preserved and replayed them. A second reviewer recomputed cost statistics, checked source/artifact hashes, counter units and workload equivalence, and found the control snapshot overhead. Both reviews and dispositions are archived; neither reviewer agreement nor passing40 cases accepts the remaining red.

The comparative experiment resolves one narrow uncertainty: **B does not require a permanent duplicate canonical store to handle the tested hidden-value and overlap cases.** Its current model also costs less on those passing workloads. It does not resolve the production authority decision: unsupported production boundaries, different control policies, copying/scheduling choices and the shared recovery failure remain. Keep B as a supported hypothesis for further consideration, not an accepted engine or a mandate to migrate writers. Keep A as a viable alternative whose implementation cost is not fixed by this version.

## Replay

Use Node24.15.0. The models need only Node built-ins. From this directory:

```sh
node tests.mjs "$PWD/arm-a.mjs" /private/tmp/slice-a-replay.json
node tests.mjs "$PWD/arm-b.mjs" /private/tmp/slice-b-replay.json
SIGNAL_TREE_CONTROL_REPO=/path/to/fresh-built-8d220643 node tests.mjs "$PWD/control.mjs" /private/tmp/slice-control-replay.json
node hidden-values.mjs
node review-final-adversarial.mjs
node --expose-gc measure.mjs "$PWD/arm-a.mjs" transaction 1024 1000
node --expose-gc measure.mjs "$PWD/arm-b.mjs" transaction 1024 1000
```

Final test commands intentionally exit1 for the preserved failures. For exact cohort replay, extract evidence.tar.xz to `/private/tmp/st-authority-slice-20261016`; run-measurements.py records original paths and toolchain. Select fresh output paths/directories before rerunning so first results remain intact. Source seals identify final models, final41-case harness, preserved40-case harness and cost harness separately. The archive includes every initial source, first red, review probe, raw result and measurement cohort; production suites were not rerun because production source was not changed.
