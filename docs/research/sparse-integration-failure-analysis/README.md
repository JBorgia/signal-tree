# Bounded sparse-integration failure analysis

Production changes remain paused. This analysis withdraws the working preference for the current persistent-root implementation. It does not reject contribution ownership, select a replacement, or authorize a restoration synchronization patch. The rejected integration and R3 remain unchanged.

Candidate: `9b9b0b35a7dd207df366047ef5c9621168a2b405`. Exact baseline: `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`. This record's commit contains analysis/evidence only. The original [integration packet](../sparse-production-integration-0/README.md) retains full suites, type diagnostics, artifacts and R3's separate sealed source. `identity.json` records the unchanged 12-file candidate source seal. No production, API, v15, test assertion, dependency or ceiling changes were made; nothing was pushed, merged or published.

## What the failure analysis establishes

The 647 kernel and 38 framework failures are 685 assertions, not 685 independent defects. 684 were previously passing original identities; one is an added restoration regression. The exhaustive table in archived `causes.json` preserves every original identity, failure, source excerpt and confidence. Its nine families are provisional groupings, not nine independently proved root causes:

| Family | Count | Causal qualification |
| --- | ---: | --- |
| Native/sparse lifetime presence disagreement | 400 | Same guard reached; omitted revival translation identified; not 400 individually traced origins |
| Missing branch/member/collection presence translation | 105 | Representation gap inspected; individual cases provisionally grouped |
| Missing scalar notifier/owner publication | 14 | Source omission and paired representative execution |
| Downstream Link/publication | 34 | First cause unresolved per case |
| Disposition/refusal/recovery | 44 | First cause unresolved per case |
| Restoration follow-up | 35 | Representative current-truth defect proved; individual causes unresolved |
| Occupancy/identity follow-up | 8 | Conflicting-index origin unresolved |
| Fixture/policy assumptions | 6 | Two conservative-refusal expectations, four internal retention premises; still unchanged reds |
| Other unresolved | 38 | No first divergence established |

Detailed reductions and exact replay: [causes.md](causes.md). Runtime unsupported operations are not the same as missing observation capabilities in the supplemental adapters. Neither is relabeled a pass.

Three concrete boundaries stand out:

1. **Current scalar truth diverges during restoration.** Undo installs native1 while the model remains committed2; a later transaction's rollback resolves to2. This ordinary-input replay remains unchanged. The first divergence precedes rollback, so adjusting rollback ordering alone cannot repair it.
2. **Same-lifetime restoration can lose translation even through the shared frame.** The physical frame implements `restore-subject`; its capture builder has no corresponding branch. This differs from a route that never invokes capture. Keeping a subject-to-ref mapping does not update sparse presence, and allocating a fresh identity would violate lifetime semantics. The 400 absent-lifetime stacks locate detection points, not necessarily this origin in every case.
3. **Successful physical rollback can omit required publication.** The paired owner-invalidation replay returns direct0 in both arms. Baseline subsequently delivers path0 and owner0 during the same eight-microtask flush; candidate delivers neither and fails the unchanged `[1,0]` assertion. Root independently replayed both arms. This is an independent publication-channel omission, not an application-owned computed timing exception. Other Link failures remain individually unresolved.

## Installation coverage and authority choice

[The inventory](inventory.md) identifies 18 current writer families and their physical endpoints, callers and evidence status. Ordinary registered scalar writes and ordinary entity mutations prepare responsibility alongside installation. Raw scalar frames, direct entity point realization and declarative entity targets do not cross those authored hooks. Restoration reaches those paths. Shared-frame lifetime revival loses translation separately. Branch presence and selection have additional state carriers outside the adapter's current schemas.

Link ingress and inspection are **not blanket bypasses**: both can reach normal captured writers. A writer-family inventory does not establish every enhancer-order, lazy-materialization and framework permutation; those limits remain explicit. A post-write restoration callback would not cover the identified families or establish atomicity.

[The concrete designs](designs.md) compare internal installation units, ingress classification, reentry, hidden truth, lifetime/ordering dependencies, publication and reclamation:

| Design | Concrete obligation | Principal cost/risk |
| --- | --- | --- |
| Sparse root owns current truth; native state is projection | Every semantic installer prepares a root transition; native projection cannot advance independently. Root/native installs, terminality and publication form one validated unit. | Migrate all writers and state facts; persistent indexes and native storage coexist even without pending work. Root swap alone cannot atomically install multiple fallible native targets. |
| Native state owns current truth; sparse records retain live contributions | Every native install atomically reconciles intersecting live ownership/dependency records. Zero-obligation locations need no independent committed mirror. | Pending records must preserve hidden canonical facts, authored order and dependencies; native visible values alone are insufficient. Reconciliation gaps or whole-store discovery can recreate the defect/cost. |

Both require separate contribution order, authority order and settlement relation. An authoritative snapshot need not dispose a pending overlay. Neither may infer supersession merely from arrival time. Both preserve the existing framework contract; fresh SignalTree reads do not promise fresh application-owned computed values inside a group.

A root and a derived projection are not inherently two authorities. The executed integration is defective because native realization can advance independently of the root used for settlement. This establishes an incomplete integration. It does not establish that completing it would be economical or that pending-only records automatically solve the problem.

## Attribution of the successful-workload CPU cost

[Cost report](cost.md) and archived `cost/` retain all commands, full emitted-artifact hashes, raw V8 profiles, counter instrumentation and outputs. The preserved assertions are unchanged. Twelve fresh-process profiles cover three samples per arm at 32 and 1,024 rows, 10,000 successful field-write/rollback cycles each, Node24.15.0, 100µs V8 sampling. No application observers. All pass.

| Attribution | Evidence |
| --- | --- |
| Persistent index work | One cycle: 697/1,237 AVL node visits and 86/156 node allocation events at32/1024 rows. Counts are not retained objects. |
| Repeated resolution | Two finalize/exportPrepared calls and four entityView materializations per cycle. Each view walks/clones the affected row's fields. |
| Avoidable-looking prepared output | Write preparation constructs entityChanges; the forward adapter consumes only writes/adds. No removal/optimization was implemented or claimed safe here. |
| Unchanged topology still incurs index edits | Four occupancy edits per cycle; finalization also rebuilds ordering paths for affected rows. |
| Remaining diagnostic machinery | Existing diagnostic/journal capture runs alongside sparse computation. Its removable share is not established because inspection/recovery still depend on it. |
| Notification/bridge | Sparse adapter and native-delta exclusive sampled shares are small relative to core/index work. No application callback execution can account for this workload's gap. |

Sparse core plus descendants occupies median52.7%/56.4% of sampled main-thread time. Persistent-map exclusive self shares are15.2%/18.2%; these overlap core-inclusive time and must not be added. The longer profiled runs show process CPU ratios1.64×/1.79×, corroborating the earlier approximately1.7× result without replacing the original measurement. Profiling samples are **not causal percentages of the CPU delta**. No ablation isolated necessary versus removable index work; no alternative implementation was measured. Root replay reproduced both counter records exactly.

The cost is therefore not solely an unoptimized notification bridge. There is substantial ownership/index work and concrete redundant preparation in this implementation. Sparsity prevents traversal of unrelated entities; it does not guarantee inexpensive point operations. This evidence weakens the current implementation's adoption case without proving persistent data structures intrinsically unsuitable.

## Disposition and limits

Keep contribution ownership as a capability to evaluate, but neither design has earned production preference. The persistent-root implementation has demonstrated overlap capability and sparse work; it has also demonstrated incomplete installation coverage, missing semantic facts/publication, and substantial matched-workload cost. Fixing individual assertion sites or adding an after-the-fact restoration sync would not establish the missing installation invariant.

This bounded analysis stops at that decision boundary. Unknown first causes stay unknown; no broad suite was rerun and prior test totals were not revised. No new heap or bundle superiority claim is made. R3's accepted bounded results and its ordering/terminality/publication/reclamation regressions remain requirements for any future candidate. A future implementation choice would need explicit coverage of all relevant installation families and equivalent semantic obligations before comparative production claims.

Independent premise and interpretation reviews are preserved with dispositions in `review-disposition.md`. Review evidence is subordinate to the executed traces and source; agreement does not accept either architecture.

## Replay and evidence

Extract `evidence.tar.xz` into `/private/tmp/st-sparse-failure-analysis-20261016` to reproduce the original absolute-path scripts. Existing baseline/final artifact locations come from the integration packet. If those were removed, restore exactbaseline8d and the original final source archive, install the pinned dependencies and build as documented there. Do not rebuild under a different runtime source identity.

```sh
python3 /private/tmp/st-sparse-failure-analysis-20261016/cluster.py
node /private/tmp/st-sparse-failure-analysis-20261016/publication-build.mjs
node /private/tmp/st-sparse-failure-analysis-20261016/publication-replay.mjs baseline
node /private/tmp/st-sparse-failure-analysis-20261016/publication-replay.mjs candidate
python3 /private/tmp/st-sparse-failure-analysis-20261016/cost/run-profiles.py
python3 /private/tmp/st-sparse-failure-analysis-20261016/cost/analyze.py
python3 /private/tmp/st-sparse-failure-analysis-20261016/cost/instrument.py
node --expose-gc /private/tmp/st-sparse-failure-analysis-20261016/cost/count-common.mjs /private/tmp/st-sparse-failure-analysis-20261016/cost/instrumented entity 1 32
node --expose-gc /private/tmp/st-sparse-failure-analysis-20261016/cost/count-common.mjs /private/tmp/st-sparse-failure-analysis-20261016/cost/instrumented entity 1 1024
```

Use Node24.15.0 and fresh output directories when preserving earlier measurements. Candidate publication replay is intentionally red. The classifier recomputes classifications from preserved full-suite evidence, not new test executions. Instrumentation copies built artifacts into a disposable directory and adds counters; that directory is omitted from the archive and regenerated by instrument.py. Timings from counter-instrumented runs are not used. Full profiles and scripts are included in the sealed evidence archive; production source remains unchanged.
