# v15 backports and v16 field-allocation follow-through

November 10, 2026. The owner authorized the complete recommended follow-through:
backport both retention repairs, replay wider aging, compare released/repaired
v15 and v16, remove demonstrated overhead, characterize an actual Angular view,
and reconcile release documentation through qualification.

Runtime identities:

- Released v15.4.4: `2bdf2ec54622e41b607242c8345b3389ce4ffb6c`.
- v15 retention-only checkpoint: `713f8a45841f84ca7740afc1515964f367227133`.
- v15 retention plus lazy fields: `ef806bef2a71aa48709c2b4cad5e71d1ee359c2f`.
- Qualified v16 predecessor: `83b8fe19e924e87dd66f28ef1b1c2756a4e4cfd9`,
  runtime `5dca0e457a1a348190275c560fc6d93aec88e5e4`.
- v16 lazy-field successor: `2826cc94185b4cccc3717ea1e6370d7bc27cbf27`.

**GO: the v16 successor is release-qualified, with the stated cost disposition.**
Registered cohorts, full normal and mutation registries, source restoration,
clean package equivalence, installed consumers and production browser checks are
complete. Numerical size failures remain visible under the owner's standing size
instruction. Neither review branch is a package publication. v15 retains its
15.4.4-based metadata; v16 remains 16.0.0-dev. Final version preparation must not
republish existing registry versions.

## Repairs and compatibility

The v15 finalizer previously held dependency-node Maps whose refresh recipes
could reach the consumer being finalized. It now holds cleanup edges containing
only weak consumer references. Separately, the global EntityMap registration
callback shared the first builder's lexical scope and retained its configuration
and application closures. Registration now happens outside that per-builder
scope, preserving lazy registration and registry deduplication.

Original v15 fails three new actual-resource controls. The finalizer repair alone
leaves the builder-config failure; both repairs pass. A live subscribed chain
continues to update across dependency replacement and forced GC. These are
correctness repairs, not a relaxation of a retained-heap target.

Both lines now create a field carrier on its first getter access. Keys,
accessor descriptors, getter identity and captured entity lifetime stay stable.
The carrier receives its complete existing binding and mutation-observation path
before exposure. Failed factories can retry. Inventory reads current descriptors
against weak getter identities; it neither creates carriers nor retains deleted
ones. Strong subject epochs and exposed-field mutation sources remain in place.

The stable port preserves v15's read, `api.updateOne`, metadata and settlement
paths. It does not import v16 selected-write/publication bindings or own-property
semantics. Controls caught and corrected invalid test assumptions about function
key order, pre-enrollment Link replay, the v15 `transaction` spelling and direct
field Link enrollment. Original controls and first failures are preserved.

v15 does not contain v16's new structured publication, ordinary-topology or packed
field-row machinery. Its older native publication, mutation frames, membership
and restoration structures have supported consumers. No concrete wholesale
subsystem removal was justified. The implemented savings target demonstrated
retention and unacquired field allocations.

## Wider v16 aging

Generator: `python3 tools/release-followthrough/compare-lazy.py PACKET aging`.
The child preserves the earlier packed-field-aging operations: six stores of
512 rows, all row handles held, widths 8/32 with two six-round edit phases and
width 3 with two twelve-round phases, including 3-to-4-field promotion. Two
qualified A/A controls and three alternating pairs per profile produce 32 fresh
serial processes. All complete, input hashes remain unchanged and all tree
sentinels collect. Values, order, width and held-row observations are asserted.

Second-phase live heap above imported baseline, MiB:

| Profile | Qualified v16 | Lazy v16 |
| ------- | ------------: | -------: |
| wide-8  |        114.35 |    38.24 |
| wide-32 |        370.16 |    63.90 |
| steady  |         56.36 |    27.80 |
| promote |         58.70 |    30.08 |

All four heap reductions clear the registered observed-range rule. The width-32
profile has resolved synchronous and total CPU reductions in both edit phases;
the width-8 directions remain unresolved. Promoted rows' second-phase total CPU
increases from 332.103 to 344.416 ms (+3.71%) under that same rule, while its
synchronous CPU and wall-time directions remain unresolved. Most other edit
wall-time/CPU directions remain unresolved. This modest CPU cost is retained in
the economic disposition alongside the substantial heap saving.
Finite edit phases do not establish an unlimited-time plateau. Held-store heap
is working set, and post-destruction heap residue is not a leak proof.

Before this change, the separate original 32-child packed-versus-qualified replay
confirmed that the retention fix alone did not remove the large live field cost.
That replay remains separate from the successor comparison.

## Demand progression and the fully materialized tradeoff

Generators: `compare-lazy.py PACKET demand` and
`compare-v15-fields.py PACKET demand` under `tools/release-followthrough/`.
Each runs two baseline A/A controls and three alternating pairs. The v15 baseline
here has the retention fixes, isolating field allocation. Each child holds six
512-row stores with 32 fields per row, performs 36,864 whole-row-observed edits,
then acquires one field and finally all 98,304 fields. It checks current values,
carrier identity, descriptors and subsequent writes. All eight children per line
complete without drift; all 18 sampled actual resources per child collect.

Live heap above imported baseline, MiB:

| Phase                          | Qualified v16 | Lazy v16 | Retention-fixed v15 | Lazy v15 |
| ------------------------------ | ------------: | -------: | ------------------: | -------: |
| Handles held                   |        352.17 |    45.24 |              219.43 |    28.40 |
| Whole-row edits                |        379.96 |    73.53 |              224.41 |    33.63 |
| One field per row              |        381.38 |    84.79 |              225.83 |    41.29 |
| All fields                     |        426.84 |   435.18 |              271.28 |   279.55 |
| Further edits after all fields |        430.65 |   439.01 |              275.05 |   283.31 |

The saving is conditional on demand. Fully materialized heap is about 1.95%
higher on v16 and 3.05% higher on v15. Deferred creation must still be paid: v16
handle acquisition falls from 364.78 to
39.03 ms, while the final all-field acquisition
phase rises from 81.90 to
382.07 ms. These phase timers include assertions
and exclude explicit GC/quiescence work. Total child duration is not an
application speedup. Cold costs and fully materialized edit latency are unresolved.

Independent review verified the source-only artifact difference, raw summaries,
input bindings and limited resource sentinels. The adoption rationale is the
large saving for whole-row/sparse-field use with an explicit small fully used
heap cost, preserved semantics and no demonstrated ordinary CPU regression.
This does not establish the minimum possible cost of v16 guarantees.

## Direct ordinary application comparison

Generator: `python3 tools/release-followthrough/compare.py FINAL_PACKET ordinary`.
It runs the actual job and inventory app bodies at 1,000 rows through the existing
neutral state-layer adaptation. Inventory imports use the kernel and its Angular
signals/computeds become explicit reads; this does not execute Angular rendering.
Model outcomes/actions are identical. Between arms, only library selection and
v15 transaction spelling differ. Two
released-v15 A/A controls and five balanced three-arm rounds per profile give
51 fresh serial children. The three arms below use the exact runtime identities
above. All six app self-tests pass, including wrong-selection/empty-output
negative controls. Seven released-v15 resource-collection failures remain
failures; both repaired candidates have none. All inputs stay unchanged.

The raw ordinary plan embeds the task's earlier qualified-v16 baseline label in
its copied policy. Its registered package payloads are the final successor, as
the [provenance clarification](provenance-clarification.json) verifies against
the preserved artifact bindings. The pre-run arm-description file was not itself
in the registered inputs. Raw registration and results remain unchanged; this
clarification does not silently relabel or replace an executed artifact.

Milliseconds, medians of five first-use samples or five child p95s:

| Endpoint                  | Released v15 | Repaired v15 | Final v16 |
| ------------------------- | -----------: | -----------: | --------: |
| Job state first use       |        6.443 |        6.555 |    28.775 |
| Inventory state first use |        3.936 |        3.977 |    25.522 |
| Job warm-route p95        |        1.645 |        1.647 |    13.103 |
| Inventory warm-route p95  |        1.621 |        1.664 |    11.306 |
| Job interaction p95       |        0.522 |        0.556 |     1.003 |
| Inventory interaction p95 |        0.343 |        0.342 |     1.781 |

Eight mixed stores, MiB above imported baseline:

| Endpoint            | Released v15 | Repaired v15 | Final v16 |
| ------------------- | -----------: | -----------: | --------: |
| Populated           |         3.84 |         3.83 |     18.21 |
| After 9,600 actions |         8.51 |         7.62 |     24.84 |

Repaired-v15 ordinary CPU directions are unresolved against released v15; edited
live heap is lower and actual resources collect. v16 remains measurably more
expensive for ordinary construction and interactions. These workloads normalize
ordinary outcomes, not v16's additional publication/refusal guarantees. Warm
route samples are not first-process startup, and child p95s are not population
percentiles. The 25 ms state-start target is missed in all five final-v16 job
samples (28.371–30.102 ms) and four of five inventory samples (24.726–27.385 ms).
These remain misses. The existing targets and interaction allocations are
retained; residual startup cost is assessed under the existing application-impact
policy, not hidden by changing a ceiling. The host Angular view below reaches
stable layout in 73–79 ms; its emulated result is materially slower and is not
represented as satisfying a universal readiness allocation.

## Actual production Angular inventory view

Generator: `node tools/release-followthrough/angular-profile.mjs prepare|build|run ...`.
The final cohort binds all five packages to
`sha256-ba5c01b75cd74e50293262f2a324cfe4072353dc845211e5c95e19948b126e05`.
It production-AOT compiles the actual inventory component, template, styles and
store, scaled to 1,000 products. Two planted omissions fail their intended
assertions; four calibration and ten measured children pass. Each browser is
fresh and runs serially. Five measured children use the host and five use 4x CDP
CPU emulation on the same Apple M4/Chromium host.

Milliseconds, medians across five children per setting:

| Endpoint                               | Host | 4x CPU emulation |
| -------------------------------------- | ---: | ---------------: |
| Store factory                          | 19.6 |             82.6 |
| Loaded bootstrap through stable layout | 73.2 |            318.6 |
| Filter, child p95                      | 33.6 |            138.4 |
| Availability, child p95                |  5.6 |             18.2 |
| Add, child p95                         |  5.7 |             18.6 |
| Remove, child p95                      |  5.4 |             16.6 |

Exact IDs/order/content, filtered DOM, availability, normalization, rejected
writes, taps, held readers, removal, reset and teardown are checked. Timings
include Angular scheduling/layout; there is no kernel/framework CPU attribution.
Loaded bootstrap excludes network, module loading, shell/router and paint; it is
not INP. Emulation is not physical-device evidence. Add/remove child p95 is the
maximum of ten observations. Teardown proves invocation and removed DOM, not GC.
No new timing ceiling was registered. The emulated filter/readiness costs remain
visible; this is a bounded application characterization, not a universal latency
claim. The earlier qualified-artifact cohort remains separately preserved and
is not pooled into a speedup claim.

## Qualification and release boundary

Focused source proofs include neutral/custom-native initialization and retry,
real Angular/Vue/Solid shape/dependencies, late acquisition, retirement/restoration,
pending ownership, intrinsic observation, deleted-carrier collection and original
payload release. Both canonical typechecks, spec-type ratchets and changed-file
lint pass. v16 built late-reader, retirement, reentry and frame witnesses pass.
The unchanged original point counter reports 1,800 visits at both 2,000 and
20,000 rows, below its strict 2,000 bound; its planted controls still fire.

The final v16 normal registry passes 86 of 87 gates; only `bundle-budget` fails.
The full mutation registry reports 87/87, including 13 indirect proofs, with zero
blind, vacuous, unproven or errored checks. All 3,772 tracked source files and the
clean checkout status restore exactly. An already-red size baseline means its
mutation result is not independent detection proof. A clean rebuild after
deleting `dist/` reproduces all 141 measured kernel payloads and the five-package
seal above. Fresh packed imports, strict consumer types under both resolution
modes, production Angular AOT/Chromium, coordinated-workflow controls and all four
built runtime witness groups pass. The original point bound remains 1,800 visits.

The strict production demo build fails only its existing 570 kB initial limit
(815.62 kB measured). A second build temporarily omits build-size budgets under the
owner's instruction, then restores the configuration byte for byte. Production
Playwright finishes with 137 passes, no skips or retries, and one size-only
failure: the main JavaScript is 789,924 bytes against 570,000. Assertions excluding
retired/development runtime code pass before that size assertion. Package size
measurements are 17.98/20.30 KB bare and 43.96/47.60 KB entities for production/
development. No ceiling is raised and no numerical failure becomes a green gate.

The repaired v15 normal registry initially passes 89/91: size and a now-insensitive
10,000-handle negative control fail. Its ordinary retention checks already pass.
The independently reviewed correction retains the 40 MiB ceiling, ordinary
workload and GC protocol, but plants 50,000 actual retained handles. All 18
preregistered local sensitivity children and the three canonical affected gates
pass. Full v15 mutation qualification reports 91/91 (15 indirect) with zero blind,
vacuous, unproven or errored checks and all 1,736 tracked files restored. Its
size mutation has the same already-red-baseline caveat. The production entities
bundle is 24.63 KB against 24.60 KB: roughly 30 bytes over, dispositioned under the
owner's cost/feasibility instruction rather than changing the ceiling.

The [Linux sensitivity run](https://github.com/JBorgia/signal-tree/actions/runs/42935863770)
at `2101a16c7` passes 18 sensitivity and six ordinary children, plus all three
direct cleanup mutations. Every raw heap verdict is independently recomputed;
all 109 Linux kernel payloads match the measured repaired-v15 package. This is
Linux retention/cleanup validation, not a full Linux release registry. Manual
dispatch first failed for access reasons; the recorded review-branch push trigger
ran the same fixed protocol. No access problem remains for that verification.

The final v15 clean build reproduces all 109 measured kernel payloads and its
five-package seal, `sha256-8f11180b4410a9402ee28aafcdcb8f5e01ee60def75bffddeb6d8a5f5e5edda9`.
Fresh packed imports, strict consumer types and production Angular AOT/Chromium
pass. The strict production demo build and all 146 browser tests pass, with no
skips or retries. The v15 repair is qualified as an unreleased maintenance
candidate; its 15.4.4-based metadata is not a version to republish.

The earlier v15 retention-only checkpoint passed all 91 normal gates after seven
environment-only failures were rerun with npm/Watchman access. The first sandboxed
lazy-v15 build stalled and was interrupted; the host-access rebuild succeeded.
Neither that interruption nor the noncanonical direct-lib TypeScript errors are
reported as passing checks. Final qualification uses the canonical commands.

The evidence archive preserves original failures, registrations, raw children,
source controls, exact artifacts, qualification commands/exits and Linux output.
Run `python3 verify-evidence.py` in this audit directory to verify the archive and
every included payload without extraction or execution. This checks supplied
payload integrity, not complete Git history or universal test reproducibility.
See `validation.json` for exact commands and artifact bindings and
`independent-review.md` for independent scrutiny and its limits.

The [current controller](../../../RELEASE-CURRENT.md) owns the final disposition.
No merge, tag or registry publication follows from these review branches.
