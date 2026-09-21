# Quiet-host CPU decision — preregistered

**Written before the run. Nothing below may be edited after a number is seen.**

The entity-realization memory work is validated. The one open question is
whether `EPOCH-TOKEN-0` costs Angular measurable CPU, because Angular is the
primary target and its memory win is the smallest of the four paths.

This document exists so that "+3.8%" cannot be argued into "basically nothing"
after the fact. It has happened twice in this program already: a `+4.1%`
regression was published against code that provably never executed, and a
`-51.8%` field read read `-13.8%` on a busier machine. Both looked decisive at
the time.

## Why not on the development machine

The A/A control — the same build against itself, through the identical path —
spread **5.9% to 32.4%** there, against a 5% threshold. Load average 3.25 with
an agent server at 69%, a browser at 60%, the window server at 45% and
enterprise endpoint protection at 26%, none of it under this repository's
control. Every workload came back NOT RESOLVABLE, including ones that favoured
the change by 25-28%.

Re-running until a band looks clean is the researcher-degrees-of-freedom failure
this whole validation exists to prevent. The question is closed on that host.

## Candidates — derived from HEAD, not from history

The three arms are branches off the CURRENT reproducible HEAD with one file
swapped each, NOT the historical commits that introduced them. The historical
range was not independently buildable until the provenance fixes, so
benchmarking old SHAs would reintroduce exactly the artifact problem those fixes
removed — and worse, would build the three arms from differently-provenanced
trees, which is the confound this whole validation exists to eliminate.

| branch               | swap                                      | released B/entity (angular/vue/neutral) |
| -------------------- | ----------------------------------------- | --------------------------------------- |
| `cpu/strong-carrier` | `entity-signal.ts` <- pre-epoch           | 2,222 / 2,687 / 2,476 |
| `cpu/cell-epoch`     | `native-location-realization.ts` <- cell  | 2,087 / 1,752 / 1,747 |
| `cpu/token-epoch`    | HEAD, unchanged (reference)               | 1,959 / 1,672 / 1,747 |

Verified mechanically in `cpu-candidates/*.json`: each candidate differs from
the reference by EXACTLY ONE FILE, carries 0 dirty files, and produces a
BYTE-IDENTICAL `@signal-tree/angular` dist hash (`25383e31a8aa8d50`). Only the
kernel realization varies. The manifests also pin the Node version, the lockfile
hash and a content hash of each built package tree, so a reported number can be
traced to the artifact that produced it rather than to a branch name.

## Test fairness — classified BEFORE the run

All three candidates pass every suite identically: kernel 280 files, angular 24,
vue 4. Nothing needed excluding, but the classification is recorded because
"strong-carrier passed" means different things for different specs:

| class | specs | status |
| ----- | ----- | ------ |
| shared semantic contract — must pass all three | everything driving the public entity API, INCLUDING `subject-epoch-non-retaining-observer.spec.ts` | all three pass |
| implementation-specific | `native-epoch-publication.spec.ts` — drives `runtime.createEpoch` directly | passes on all three; under strong-carrier the runtime still DEFINES `createEpoch`, but `entity-signal.ts` references neither it nor `subjectEpochs`, so it does not gate that candidate's entity path |
| mutation guards for one implementation | weak-epoch mutant | applies to epoch candidates only; NOT used to reject the strong carrier |

`subject-epoch-non-retaining-observer.spec.ts` is named for the epoch but is a
SHARED contract test: it asserts behaviour through the public API rather than
mechanism, which is why the strong carrier satisfies it honestly rather than
vacuously. A test named after an implementation is not automatically an
implementation test.

## Command

```
npx nx run-many -t build -p kernel angular          # per build under test
node tools/bench-build-ab.mjs \
  --roots strong=<dist>,cell=<dist>,token=<dist> \
  --pairs 15
```

`strong` is the reference (pre-epoch carrier, `09b0d9c3`). All three builds are
interleaved within each pass and the order is reversed for the second half, so
no build systematically occupies a hotter slot.

## Gate

A workload whose **A/A spread exceeds 5% of its median reports NOT RESOLVABLE
and gets no number.** It is not re-run until it looks clean. If most workloads
reject, the host is unsuitable and the answer is "unknown", not "flat".

## Angular thresholds — fixed in advance

| workload             | flat    | tradeoff zone | materially worse |
| -------------------- | ------- | ------------- | ---------------- |
| `byId-warm`          | <= 2%   | 2-5%          | > 5%             |
| `updateOne`          | <= 2%   | 2-5%          | > 5%             |
| every other workload | <= 5%   | —             | > 5%             |

`byId-warm` is the arm that matters. An independent audit measured `byId`
~37% faster COLD and ~5% SLOWER WARM, with a mechanism visible in the source: a
warm read was one `Map` lookup plus a carrier read, and is now an epoch lookup,
an epoch call, and a second `Map` lookup into `valueStore`. Cold and warm are
SEPARATE arms in the harness for exactly this reason — a single `byId` name hid
the sign change, and the first published claim measured whichever arm it
happened to write.

## Decision rule

- **Flat** on `byId-warm` and `updateOne` → keep `EPOCH-TOKEN-0` everywhere.
- **Tradeoff zone** → keep it, and record the cost against a 263 B/entity
  (11.8%) Angular memory saving so the trade is explicit rather than implied.
- **Materially worse** → do NOT accept it on Angular. Move to an
  Angular-specific realization with the token epoch retained on Vue, React and
  neutral, where the memory wins are 63.0% and 52.9% and are not in question.

The governing principle: **cross-framework consistency is valuable, but Angular
does not subsidize the other adapters.**

## Option grid, frozen

| option                                | Angular |   Vue | neutral/React | correctness             | CPU                        |
| ------------------------------------- | ------: | ----: | ------------: | ----------------------- | -------------------------- |
| strong pre-epoch carrier              |   2,222 | 2,687 |         2,476 | proven                  | reference                  |
| cell-based correct epoch              |   2,087 | 1,752 |         1,747 | proven                  | likely dominated           |
| **token-only epoch (HEAD)**           |   1,959 | 1,672 |         1,747 | proven, grouping tested | **pending**                |
| Angular-specific + token elsewhere    |   2,222 | 1,672 |         1,747 | provable                | fallback if Angular loses  |
| bare-cell epoch                       |   1,350 | 2,039 |             — | **REJECTED** — Vue invalidation dead, grouping bypassed | — |
| weak entity carrier                   |  ~974 ceiling | — |             — | **REJECTED** — non-retaining observers freeze | — |

The two rejected rows stay in the grid because they are lower bounds obtained by
DELETING semantics, and knowing what correctness costs is worth more than
forgetting that those numbers existed.

The cell-based epoch is probably dominated: identical semantics, more memory,
and a state primitive allocated for a non-state job. It leaves the frontier
unless CPU gives it an advantage nothing currently predicts.

## Historical figures these replace

Baseline `71182dd5` -> HEAD, released B/entity, all reproduced from a clean
checkout at two entity counts:

```
Angular        3,591 -> 1,959   -45.5%
Vue            4,519 -> 1,672   -63.0%
neutral/React  3,715 -> 1,748   -52.9%
```

The previously published Angular `1,350` / `-62.4%` / `1.93x v14` figures are
WITHDRAWN: they were measured on an implementation that had silently disabled
entity invalidation on Vue.
