# Bounded entity graph collectibility review

Read-only review; no repairs and no repeated GC sampling performed by this reviewer.

## Observed result

Root's `link-repair-combined/receipt-graph-gc.ts` uses four entity cycles, four useful outbound8 values, retained terminal receipts, and sixteen fixed GC turns. Of twenty references, the first tree and its current payload remain observable; eighteen collect. All private lifecycle/projection diagnostics are zero. The live positive control survives.

Root's separately predeclared no-held-receipt control (`receipt-graph-dropped-gc.ts/.log`) produces the identical retention pattern. Therefore holding the receipt is **not necessary** for this observed retention. This does not prove the private candidate has no other retaining edge, nor establish an incumbent leak. No matched unmodified native baseline was run.

## Source ownership inspected

- Private `lifecycle.ts`: `makeReceipt` closes only over View; `started` updates View and clears operation proof/frames/views before removing the operation. Retained View contains primitive state/basis strings. This is consistent with the no-held-receipt control and narrower successful scalar GC.
- Private projection binding owns latest/completed/projected payload/queued facts while live. `releaseSource` deletes binding and equal-listener entries. Final measured counters show none remain. These counters cover these strong stores, not all native runtime roots.
- Native `lib/entity-signal.ts:1954–1965`: node cache values are WeakRefs; finalizer holdings are numeric subject IDs. This cache does not by itself establish a global strong path to the first tree. Other per-collection caches and subject maps require their collection to remain rooted; finding those maps is not identifying the retaining root.
- Native `lib/internals/position-registry.ts:182` and `snapshot-authority.ts:17–21` use WeakMaps/WeakSets. Their existence is not evidence of strong global retention of an otherwise unreachable key.
- Native `lib/path-notifier.ts:138–162,898`: global notifier owns subscription, flush/reset/enqueue observer and pending-event stores. These are concrete potential roots if cleanup or pending delivery leaves an entry. This review has not observed such a surviving entry or tied one to the first tree.
- Native `lib/internals/location-runtime.ts:206–218`: global active consumer, pending consumer set, and FinalizationRegistry dependency holdings exist. The holdings can retain dependency nodes until finalization. No surviving entry or ownership path to the observed first tree was established here.
- Native `materialize-markers.ts:817–825` global member-value applier is installed by module-level `signal-tree.ts:861`, not a first-tree-specific registration. It is not evidence for the first-instance pattern.

## Disposition

Entity payload-graph collectibility remains **unqualified**. The fixed sample fails its all-collected assertion; it is not a proven unbounded leak. Receipt retention is not the demonstrated cause. No known first-instance native cache was identified as the retaining root from this bounded source inspection.

Do not replace this evidence with the narrower scalar GC pass or rerun until collection happens. The combined candidate already has independent correctness blockers. A future necessary retention investigation should obtain an actual heap retaining path or a preregistered exact-native baseline comparison, not infer ownership from a WeakRef surviving one sampling schedule.
