# Store comparison — findings, 2026-09-30

Development runs: Apple M4 (10 cores), Chromium 145 headless, Node 24, Angular 22 zoneless.
These are historical development results, including busy-machine runs (load average 3.7–7.5).
The old JSON `development` flag covered only `--quick`; a false flag or a filename without
`.DEVELOPMENT` does not make a historical run publishable.
Medians of 5 rounds, fresh browser per round/arm/group, arm order rotated. A same-arm A/A
control (`st15-released` twice) bounds noise: mostly 1–10% for the metrics below. Re-run on a
quiet machine before drawing performance conclusions. The A/A band is a descriptive noise
check, not a confidence interval or a guarantee that other arms have the same variance.

Arms: hand-written Angular `signals`, `ngrx` (SignalStore + `withEntities`), `st14`
(`@signaltree/core` 14.1.3), `st15` (`@signal-tree/angular` 15.3.1), `cand` (packed 15.4.0
candidate 6, before 115791e1), `cand+undo` (the candidate with `transactions()` and
`restoration()` installed but never used).

## Evidence identity and limits

Every result below applies to the historical artifacts, **not the final optimized candidate**.
The candidate-6 manifests recorded in these runs claim Angular SHA-256
`e5b52742412825dbfc5d17403c8aaab5a5c4cd2d9fd4b36f67f9cd16ff9f5a23` and kernel SHA-256
`7c97aa7641f4714dad8eb78f4883bb8211656d18107e320a59c2c1a93c1754e9`, both version 15.4.0,
from `/private/tmp/st-observation-candidate-6/`. These are recorded tarball identities;
the old harness did not hash the served JS or prove that it came from those tarballs.
The exact source commit of those tarballs is **unknown** from the saved manifests. The
runner's git SHA identifies the harness checkout, not the source used to pack the candidate. The candidate-6
directory now also has `source-commit.txt` claiming
`172a826899ffa9d736b9740328fb88eb6d3a9ba6`; that sidecar was not embedded in these historical
run manifests and does not independently establish their source/build mapping. The repaired
installer records such claims for future installs without rewriting old evidence.

Local historical evidence (preserved unchanged under `results/`):

| Claim                            | Saved run                       |
| -------------------------------- | ------------------------------- |
| Main table, signals through cand | `2026-10-01T03-45-46-590Z.json` |
| Main table, cand+undo            | `2026-10-01T04-46-51-097Z.json` |
| Footer off                       | `2026-10-01T04-33-12-026Z.json` |
| CDP 4× CPU throttle              | `2026-10-01T04-51-49-353Z.json` |

The main table combines two runs, not one simultaneous six-arm comparison. Earlier
integration runs are not substitutes for these rows. Historical size-matrix JSON files
(`size-matrix-2026-10-01T05-33-32-097Z.json`, `05-34-44-428Z`, `05-35-03-033Z` with the
same prefix/suffix) record versions only: their candidate checksum/source mapping is unknown.
They also predate explicit production defines and verification of the measured bundle. Re-run
that matrix; do not compare its old byte totals as if the configuration were unchanged.

The profile percentages and bench-local A/B gains below are historical experimental notes.
Their exact patched JS checksums and full source mapping were not recorded here and remain
**unknown**. A saved custom-root experiment (`2026-10-01T04-43-31-301Z.json`) has only one
round and an installation manifest unrelated to proof of the custom build's origin. It does
not establish all the quoted gains. None of these experiments measures the final optimized
candidate, and gains from separate patches must not be added together.

## Results

Unthrottled, status footer rendered (every arm recounts all rows after each write).
Single edit is `position-visible`; timings are ms unless otherwise stated:

|                            | signals     | ngrx        | st14        | st15        | cand        | cand+undo   |
| -------------------------- | ----------- | ----------- | ----------- | ----------- | ----------- | ----------- |
| JS transferred, gzip       | 70.6 KB     | +1.7        | +8.6        | +23.2       | +24.6       | +61.3       |
| startup script time        | 2.8 ms      | 2.9         | 2.9         | 2.9         | 3.1         | 3.2         |
| load 10k / 50k rows        | 5.8 / 15.7  | 4.4 / 12.1  | 9.4 / 28.2  | 31 / 132    | 31 / 133    | 82 / 433    |
| refetch 10k / 50k          | 2.8 / 11.5  | 2.3 / 8.6   | 6.4 / 33.8  | 13.0 / 62.6 | 14.0 / 69.3 | 50 / 251    |
| single edit p50, 10k / 50k | 0.33 / 1.95 | 1.19 / 8.16 | 0.17 / 0.88 | 0.41 / 2.75 | 0.42 / 2.73 | 0.41 / 3.06 |
| move p95, 50k              | 0.38        | 1.80        | 23.9        | 46.3        | 49.6        | 159         |
| remove p95, 50k            | 2.95        | 9.72        | 0.96        | 3.27        | 3.42        | 3.76        |
| JS heap slope per row      | 330 B       | 156 B       | 146 B       | 294 B       | 294 B       | 294 B       |
| editor open p50            | 0.18        | 0.20        | 0.29        | 0.32        | 0.32        | 0.57        |

CDP CPU throttling at rate 4 on the same M4 host (no device-class calibration), 50k rows: load 60 / 50 / 111 / 523 / 523 /
1809 ms; refetch 47 / 39 / 116 / 234 / 260 / 993 ms; single edit p50 8.6 / 34.9 / 3.8 / 12.1 /
12.6 / 13.3 ms; move p95 2.3 / 10.8 / 95 / 186 / 200 / 668 ms (same arm order). At 10k rows
under throttling, v15 loads in 125 ms and edits in ~2 ms; at 1k everything is sub-frame.

For visible single-row edits, one row template is evaluated per edit; leaving the screen releases the
store (heap returns to ~0.8–1.1 MB over baseline whatever the row count); editors retain
~17 B per open/close cycle after warm-up in these runs. This finite observation is not
a proof of absence of unbounded retention in other workloads.

## Decomposition: removing the summary over all rows

With the status footer off (`--footer off`), single edit p50 at 1k / 10k / 50k rows:

| signals            | ngrx              | st14               | st15               |
| ------------------ | ----------------- | ------------------ | ------------------ |
| 0.01 / 0.01 / 0.01 | 0.08 / 0.88 / 6.7 | 0.02 / 0.03 / 0.08 | 0.02 / 0.05 / 0.13 |

Footer-off timing still includes the grid, derived values, scheduler and stability wait; it
is not an isolated store-call microbenchmark. In these historical builds, most footer-on edit cost in signals, st14 and st15 is the O(n) recount, and NgRx's own
write is O(n) (it copies the entity map and ids on every `updateEntity`).

## Attribution (CPU profiles and heap snapshots, unmangled production build)

1. **v15 `setAll` builds observation payloads nobody consumes.** For every added/removed row it
   deep-clones the row into a structural effect, builds a metadata object with two spreads and
   calls `pathNotifier.notify`, with no enhancer or observer installed. Load at 50k: `deepClone`
   44% and `createStructuralEffectMeta` 25% of `setAll`; refetch: `ambientMeta` spreads 25%.
   Removing those payloads in a bench-local patch: load −57% at 10k and −62% at 50k
   (127 → 48 ms), identical digests.
2. **v15 rebuilds `ids()` after every field write.** One `version` cell drives `all`, `count`,
   `ids` and `map`; `ids` walks the order linked list and copies it. That is the O(n) in v15's
   own write (78 µs of 135 µs at 50k). A bench-local cached key array (invalidated by the
   structural store's 12 list mutators) plus identity-stable `ids`: edit p50 0.160 → 0.015 ms
   at 50k, flat across row counts, faster than 14.1.3; the full correctness run passed.
3. **v15 `all()` costs four O(n) passes with two hash lookups per row** (key snapshot, key →
   subject, subject → value, tuple then map). Any computed over all rows pays it after every
   write: ~2.6 ms of the 2.75 ms footer-on edit at 50k.
4. **Memory scope correction.** The ~294 B/row table value is the median across rounds
   of `[(afterLoad - baseline) at 50k - (afterLoad - baseline) at 1k] / 49k`, from
   `Runtime.getHeapUsage` after GC (`scripts/lib/report.mjs`). It includes the measured JS
   heap, including code and harness effects; it is a marginal slope, not a store-only total.
   The previous attribution of ~120 B row data + ~230 B v15 overhead (= ~350 B) came from
   a different method: `heap-per-row.mjs` at a single N, summing only **positive** category
   deltas in filtered snapshot `self_size`. It excluded code/hidden/synthetic/system objects,
   discarded shrinking/disappearing categories, and included grid/harness objects. Those
   estimates cannot decompose the 294 B slope. The old claimed overheads (NgRx ~44 B,
   st14 ~53 B, signals ~180 B, v15 ~230 B) and the 120 B baseline are **unreconciled**;
   their exact net contribution on the same artifact and scope is **unknown**. Do not
   subtract 120 from 294 to invent a corrected overhead. The repaired tool reports signed
   net change and positive-category growth separately; it still is not an ownership analysis.
5. **Historical candidate regression (reported fixed in 115791e1).** 15.4.0's survivor-order comparison (two Sets and
   two filters over the collection) ran on every `setAll` before checking for a consumer:
   refetch +8% at 10k, +11% at 50k. Gated on `publishCollectionOrder`, refetch matched 15.3.1.
6. **Undo/transactions installed but idle cost 3.3–3.5× on bulk operations.** ~70% of a 50k
   load goes to the transactions enhancer's capture pipeline: every plain write is recorded as a
   confirmed turn with its effects so later undo/rollback can classify dependencies. That is the
   v15 causal model, not an accident; what is tunable is the per-effect cost.
7. **v15 editors.** A kernel `WeakMap`'s hash table grows to ~280 KB over the first ~30 editor
   trees and stays at that capacity (bounded; entries die with their trees).

## Historical optimisation experiments (not final-candidate evidence)

|     | change                                                               | measured effect                | risk                                                                                                                           |
| --- | -------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| A   | build effect/notification payloads only when a consumer is installed | load −62%, refetch −13% at 50k | medium: every notify site in `entity-signal.ts`; observers attaching later see only later writes (already the reader contract) |
| B   | a structural version for `ids`/`count` + cached key array            | edit 10× at 50k, O(1)          | medium: every structural mutation must invalidate; one class owns them                                                         |
| C   | `all()` without tuples; patch a cached array on value-only writes    | not measured; benefit unknown  | medium                                                                                                                         |

Implementation status must be checked in the final source. The table records historical
experiments, not a current backlog or a validated speedup for the final artifact. A fresh
packed build, manifest and full comparison are required.

## Not covered

Studio attached vs detached (private adapter), active undo/transaction use, a quiet machine,
GT Web's real data sizes and components.
