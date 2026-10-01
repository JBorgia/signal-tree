# Store comparison — findings, 2026-09-30

Development runs: Apple M4 (10 cores), Chromium 145 headless, Node 24, Angular 22 zoneless.
The machine was busy (load average 3.7–7.5), so the runner labels every run development-only.
Medians of 5 rounds, fresh browser per round/arm/group, arm order rotated. A same-arm A/A
control (`st15-released` twice) bounds noise: mostly 1–10% for the metrics below. Re-run on a
quiet machine before quoting decimals; the shapes below held across every run.

Arms: hand-written Angular `signals`, `ngrx` (SignalStore + `withEntities`), `st14`
(`@signaltree/core` 14.1.3), `st15` (`@signal-tree/angular` 15.3.1), `cand` (packed 15.4.0
candidate 6, before 115791e1), `cand+undo` (the candidate with `transactions()` and
`restoration()` installed but never used).

## Results

Unthrottled, status footer rendered (every arm recounts all rows after each write):

|                            | signals     | ngrx        | st14        | st15        | cand        | cand+undo   |
| -------------------------- | ----------- | ----------- | ----------- | ----------- | ----------- | ----------- |
| JS transferred, gzip       | 70.6 KB     | +1.7        | +8.6        | +23.2       | +24.6       | +61.3       |
| startup script time        | 2.8 ms      | 2.9         | 2.9         | 2.9         | 3.1         | 3.2         |
| load 10k / 50k rows        | 5.8 / 15.7  | 4.4 / 12.1  | 9.4 / 28.2  | 31 / 132    | 31 / 133    | 82 / 433    |
| refetch 10k / 50k          | 2.8 / 11.5  | 2.3 / 8.6   | 6.4 / 33.8  | 13.0 / 62.6 | 14.0 / 69.3 | 50 / 251    |
| single edit p50, 10k / 50k | 0.33 / 1.95 | 1.19 / 8.16 | 0.17 / 0.88 | 0.41 / 2.75 | 0.42 / 2.73 | 0.41 / 3.06 |
| move p95, 50k              | 0.38        | 1.80        | 23.9        | 46.3        | 49.6        | 159         |
| remove p95, 50k            | 2.95        | 9.72        | 0.96        | 3.27        | 3.42        | 3.76        |
| heap per row               | 330 B       | 156 B       | 146 B       | 294 B       | 294 B       | 294 B       |
| editor open p50            | 0.18        | 0.20        | 0.29        | 0.32        | 0.32        | 0.57        |

4× CPU throttling (roughly a mid-range laptop), 50k rows: load 60 / 50 / 111 / 523 / 523 /
1809 ms; refetch 47 / 39 / 116 / 234 / 260 / 993 ms; single edit p50 8.6 / 34.9 / 3.8 / 12.1 /
12.6 / 13.3 ms; move p95 2.3 / 10.8 / 95 / 186 / 200 / 668 ms (same arm order). At 10k rows
under throttling, v15 loads in 125 ms and edits in ~2 ms; at 1k everything is sub-frame.

Common to every arm: exactly one row re-renders per edit; leaving the screen releases the
store (heap returns to ~0.8–1.1 MB over baseline whatever the row count); editors retain
~17 B per open/close cycle after warm-up (no leak).

## Decomposition: the store's own write vs the summary over all rows

With the status footer off (`--footer off`), single edit p50 at 1k / 10k / 50k rows:

| signals            | ngrx              | st14               | st15               |
| ------------------ | ----------------- | ------------------ | ------------------ |
| 0.01 / 0.01 / 0.01 | 0.08 / 0.88 / 6.7 | 0.02 / 0.03 / 0.08 | 0.02 / 0.05 / 0.13 |

So most of the footer-on edit cost in signals, st14 and st15 is the O(n) recount, and NgRx's own
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
4. **Memory per row.** ~120 B is the row itself in every arm. Overhead: NgRx ~44 B (entity
   dictionary), st14 ~53 B (key arrays), signals ~180 B (an Angular signal per row), st15
   ~230 B (≈142 B of `Map`/`Set` hash tables for key ↔ subject, subject state and value
   backing; a 28 B order-list node; a 24 B subject state record).
5. **Candidate regression (fixed in 115791e1).** 15.4.0's survivor-order comparison (two Sets and
   two filters over the collection) ran on every `setAll` before checking for a consumer:
   refetch +8% at 10k, +11% at 50k. Gated on `publishCollectionOrder`, refetch matched 15.3.1.
6. **Undo/transactions installed but idle cost 3.3–3.5× on bulk operations.** ~70% of a 50k
   load goes to the transactions enhancer's capture pipeline: every plain write is recorded as a
   confirmed turn with its effects so later undo/rollback can classify dependencies. That is the
   v15 causal model, not an accident; what is tunable is the per-effect cost.
7. **v15 editors.** A kernel `WeakMap`'s hash table grows to ~280 KB over the first ~30 editor
   trees and stays at that capacity (bounded; entries die with their trees).

## Optimisation opportunities (measured, not implemented)

|     | change                                                               | measured effect                                                  | risk                                                                                                                           |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A   | build effect/notification payloads only when a consumer is installed | load −62%, refetch −13% at 50k                                   | medium: every notify site in `entity-signal.ts`; observers attaching later see only later writes (already the reader contract) |
| B   | a structural version for `ids`/`count` + cached key array            | edit 10× at 50k, O(1)                                            | medium: every structural mutation must invalidate; one class owns them                                                         |
| C   | `all()` without tuples; patch a cached array on value-only writes    | not measured; profile says ~2.6 ms → tens of µs per write at 50k | medium                                                                                                                         |

## Not covered

Studio attached vs detached (private adapter), active undo/transaction use, a quiet machine,
GT Web's real data sizes and components.
