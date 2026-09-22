# Entity realization — the record

**The front door for the entity-realization performance work.** Everything else
in this area is detail or evidence; start here. Closed 2026-09-21.

The one-line result:

> **One semantic authority, framework-specialized physical realization.** The
> kernel owns semantic truth; each framework package owns the cheapest correct
> way to realize it.

---

## 1. The decision

```
@signal-tree/kernel     semantic authority, SubjectId + lifetime,
                        EntityValueStore + StructuralStore,
                        publication + grouping, shared epoch publisher,
                        portable token epoch fallback

@signal-tree/angular    createEpoch/advanceEpoch pair; the epoch IS a bare
                        Angular signal                      1,350 B/entity

@signal-tree/vue        createEpoch/advanceEpoch pair; the epoch is a
                        Vue shallowRef                      1,135 B/entity

@signal-tree/react      token / neutral path                ~1,748 B/entity
```

| option                  | status                                                             |
| ----------------------- | ------------------------------------------------------------------ |
| Angular-native epoch    | **CHOSEN**                                                         |
| portable token fallback | **CHOSEN** for Vue, React, neutral                                 |
| shared epoch publisher  | **CHOSEN** common infrastructure                                   |
| cell epoch              | **REJECTED** — memory-dominated by token, no admissible CPU offset |
| strong carrier          | **HISTORICAL CONTROL** — valid, not the preferred path             |
| bare-cell epoch         | **REJECTED** — killed Vue invalidation                             |
| weak entity carrier     | **REJECTED** — non-retaining observers freeze                      |

Landed in `be03665d`. Disposition in [`CPU-FINAL-DISPOSITION.md`](CPU-FINAL-DISPOSITION.md).

---

## 2. What is established, and how firmly

### HIGH — memory

Angular `released` B/entity, `tools/bench-entity-realization-matrix.mjs`,
process-isolated, reproduced at two entity counts and from a clean checkout:

```
3,591   baseline (71182dd5)
3,470   after lazy observer Set              -121
2,222   after weak subject-state carrier
1,863   normalized token (shared publisher)
1,350   Angular-native epoch                 -513 vs token, -27.5%
```

Cross-framework at the chosen architecture: **angular 1,350 · vue 1,135 ·
neutral 1,747 · react 1,748**.

Against the pre-work baseline:

| path          | before | after | change |
| ------------- | -----: | ----: | -----: |
| Angular       |  3,591 | 1,350 | -62.4% |
| Vue           |  4,519 | 1,135 | -74.9% |
| neutral/React |  3,715 | 1,748 | -52.9% |

And native realization against the already-improved portable token path:
Angular 1,863 -> 1,350 (-513 B, -27.5%); Vue 1,576 -> 1,135 (-441 B, -28.0%).

**Angular is not uniquely suited to this design.** Angular measured first, so it
looked that way at 1,350. Vue then landed at 1,135 — cheaper — using a
`shallowRef` rather than a callable signal. The advantage is FRAMEWORK
SPECIALIZATION, not Angular. Two independent frameworks now show the same
architecture paying off, which is what makes Solid and Preact worth trying next.

Angular remains the flagship for market reasons, not because it is the cheapest
realization.

Why this is trusted: spreads of 0.00–0.08% across runs; stable per-entity at
N=10k and N=20k (a per-entity quantity must not move with N); the benchmark
harness provably unchanged across the compared range; and independently
reproduced by an adversarial audit that built its own worktrees rather than
trusting `dist/`.

### HIGH — semantics

Every claim is pinned by a test that fails when the behaviour is removed:

- a weakly held epoch fails 6 of 12 non-retaining-observer tests
- a strongly held subject-state carrier fails 3
- an unobservable native projection fails 1
- cell-writing epoch publication fails 2 kernel tests **and** reproduces the
  original Vue failure
- bypassing `publish` fails the grouping test

### UNKNOWN — CPU

**Not "equal", not "free" — unresolved.** The preregistered A/A gate rejected
the decisive workloads on a calm host, across three independent runs:

```
byId-warm      8.5% · 11.5% · 20.0%    gate is 5%
byId-cold     24.4% · 30.6% · 24.8%
updateOne      3.7% ·  2.9% ·  3.4%    the only one that ever passed
```

The stopping rule fired; the four-way candidate run was correctly never
executed. **No candidate CPU delta from this program is admissible**, including
those that favoured the chosen design.

### Three things NOT to claim

1. **Not** that CPU is faster. It was never resolved.
2. **Not** that native realization is always cheaper in every framework. Two
   frameworks measured; the rest are untested.
3. **Not** a direct memory comparison against v14 implying equal semantics. v14
   is a materially weaker semantic system — its keys are identity, and a held
   node follows a fresh same-key occupant. Quoting its 698 B alongside these
   figures without that sentence misrepresents both.

The only permitted statement about CPU:

> CPU differences could not be resolved on the available hardware under the
> preregistered methodology. Among implementations with validated semantics,
> Angular-native provides the lowest measured Angular memory cost, saving
> 513 B/entity (27.5%) versus the normalized token realization.

---

## 3. Retractions — everything this program got wrong

Scattered across the detail documents; collected here so no withdrawn number
can be quoted by accident.

| withdrawn claim                                        | correction                                                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| residue `2,831 -> 2,709 B/entity`                      | wrong anchors. Real: `3,591 -> 3,470`. The -121 B delta was right                                                                                 |
| `updateOne +4.1%` regression                           | **false**. Blamed a `WeakRef.deref()` in code that provably never executed in that arm — counters showed 0 calls over 200,000 operations          |
| field read `-51.8%`, "faster on every path it touches" | **withdrawn entirely**. A/A control rejected every workload; the same measurement read -13.8% on a busier host                                    |
| Angular `1,350 B` as first shipped                     | measured on an implementation that had silently disabled Vue entity invalidation. The number is only real with the _correct_ Angular-native epoch |
| native carrier saves `609 B`                           | **513 B**. The remaining 96 B is the shared publisher, a framework-neutral change that also helped Vue                                            |
| shared publisher "provably common infrastructure"      | overstated. Equal 96 B on two adapters shows its _memory effect reproduces_; what makes it common is structural — it lives in the shared runtime  |
| core placement causes the timing multimodality         | **withdrawn**. Multimodality is demonstrated; its cause is not. Inference presented as fact                                                       |
| `SUBJECT-STATE-MINIMAL-0` "not worth it"               | reversed. Priced a type specialization; what was needed was one boolean parameter                                                                 |
| this range reproduces from SHA to SHA                  | **false** until `48d64207`. No commit in the range built — a required `export` lived only in an uncommitted file                                  |

---

## 4. Defects found along the way

**In the measurement tooling** — four harnesses measured something other than
their name (`bench-entity-layers` and `bench-raw-signals` silently exercising
the neutral fallback; `entity-byId-field-read` conflating three questions;
`entity-setAll-10k` conflating create/setAll/destroy). The retained-heap
`collectable` gate was **vacuous** — it watched the wrapper `build()` returned,
so it answered `true` even for arms retaining ~100 MB. The CPU harness was never
committed, making its claims unfalsifiable.

**In the product** — a non-retaining `computed` froze silently when a weakly
held entity carrier was reclaimed; the bare-cell epoch left Vue's entity
invalidation permanently dead; staging pending invalidations by subject id lost
removals entirely; `native-location-realization.ts` — the file every framework
realization depends on — had **zero direct coverage**; and the canonical
ownership path was blanked in production builds while link and mutation capture
read it (`48d64207`).

Each is now guarded by a test that fails without the fix.

---

## 5. Methodology, in one place

What repeatedly produced false results, and what stopped it:

- **A green suite proves nothing about a path it never executes.** Kernel trees
  fall through to `NEUTRAL_LOCATION_RUNTIME`; 2,346 tests passed with a live
  capability deleted. Framework-adapter tests are the only oracle for native
  code.
- **An A/A control decides resolvability, not the operator.** A build cannot
  differ from itself; where identity measures 20%, a 15% delta is not a finding.
- **Preregister before measuring.** Thresholds, matrix and stopping rule fixed
  in advance, with candidate deltas disclosed once seen.
- **One workload per process; never compare across harness runs.** Both
  retracted CPU claims came from violating this.
- **A per-entity quantity must not move with N.** The scaling check is what
  distinguishes a real cost from a harness artifact.
- **Mutation-prove every guard.** A test that cannot fail is worse than no test,
  because it is read as evidence.
- **Verify by exit code, not by grepping output.** A `head` at the end of a
  pipeline made a passing check report a violation.

---

## 6. Where everything lives

| document                                                                       | holds                                                     |
| ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| [`CPU-FINAL-DISPOSITION.md`](CPU-FINAL-DISPOSITION.md)                         | the closing verdict and landing report                    |
| [`v15-performance-baseline.md`](v15-performance-baseline.md)                   | full experiment-by-experiment detail, including negatives |
| [`VALIDATION-FREEZE-2026-09.md`](VALIDATION-FREEZE-2026-09.md)                 | the independent audit and its findings                    |
| [`CPU-DECISION-PREREGISTRATION.md`](CPU-DECISION-PREREGISTRATION.md)           | v1 — thresholds, gate, option grid                        |
| [`CPU-DECISION-PREREGISTRATION-V2.md`](CPU-DECISION-PREREGISTRATION-V2.md)     | v2 — Angular-native added to the candidate set            |
| [`CPU-DECISION-PREREGISTRATION-V2.1.md`](CPU-DECISION-PREREGISTRATION-V2.1.md) | v2.1 — normalization onto a common base                   |
| [`CPU-DECISION-PREREGISTRATION-V3.md`](CPU-DECISION-PREREGISTRATION-V3.md)     | v3 — calibrated duration, stopping rule                   |
| `cpu-candidates/`, `cpu-v3-evidence/`                                          | manifests and raw output                                  |

Preregistrations are kept **in sequence rather than merged**: each was written
before its results existed, and rewriting them retroactively would destroy the
only property that makes them worth anything.

Branches `cpu/v2-*` and `cpu/*` are preserved as evidence. Raw CPU output is also
at `~/signaltree-cpu-results/results/`.

---

## 7. Closed

No v4. No further CPU methodology work is justified for this decision. Reopening
it requires hardware that can pass the A/A gate on `byId-warm` and `byId-cold` —
not a new statistic, and not another run on this host.
