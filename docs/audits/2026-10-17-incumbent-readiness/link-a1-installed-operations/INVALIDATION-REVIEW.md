# Independent heterogeneous realization consumer review

One bounded blocker demonstrated: the new per-lifetime plans isolate publication failures but not invalidation failures. A controlled installed-plan invalidation throw prevents subsequent live-row invalidation. Native state installation passed the same witness. The existing-port classification and selected P/O mapping otherwise have source support; this is not a new inverse-authority or public-scope objection.

## Exact artifact

Baseline `f01ed39a7df8a5de185ebec0773e09e36537dacb`; inspected `FINAL.patch`, `FINAL-ADAPTER.ts`, `FINAL.spec.ts`, raw `FINAL.log` and current matching source. Adapter SHA-256 `167803fd47bfa52469f125f7fcddae8c5a84842f52f41b9ef8fff252d52226d0`; entity source `956d39c81548d5168df8ba40a20ddedd40b89b10b46d26eebb2c37827033b013`; supplied new spec `cad4feca7d082b6d7f10dd6e6ab5a1172b19274d7602b21bbd0a0da6bf23ccaa`. `FINAL.sha256` identifies the remaining preserved controls.

Independent repro SHA-256 `a22e7978157eb600c6d87ee7567f64a2b36fb069d7152c6bacacaf2377f85544`. `INDEPENDENT-BEFORE.sha256` and `INDEPENDENT-AFTER.sha256` are identical for adapter, entity source and repro across execution. I did not implement this lane. No runtime or architecture file was changed by this review.

## Medium: later installed rows can miss invalidation after an earlier failure

Location: `packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts:1465–1470`, the `invalidate` function. Existing source port: `packages/kernel/src/lib/entity-signal.ts:546–565`.

Each `preparePointValues` plan may throw from `invalidate`: it attempts its row epoch and collection signal staging, retains the first error and rethrows. The heterogeneous consumer now creates one plan per live lifetime, but invokes these invalidations in an unguarded loop. The outer `preparePointRealization` wrapper catches failure of the whole heterogeneous invalidation and proceeds to publication; it cannot resume the interrupted inner loop. Later live rows—and scalar publication staging below the loop when present—are skipped.

The supplied new tap-throw test meaningfully checks `publish`, whose per-plan `run` wrapper does continue. It does not exercise `invalidate`. The point-only realization code already uses containment around each collection invalidation (`tree-realization-adapter.ts:903` vicinity), confirming that failure at this port is not treated as impossible by the surrounding contract.

Cheapest falsifier executed once: `heterogeneous-independent-invalidation.spec.ts`, preserved as `INDEPENDENT-INVALIDATION.spec.ts`. It uses the supplied two-collection structural-plus-two-live-row undo sequence. A wrapper around the existing private `__preparePointValues` port invokes the real invalidation, then throws an exact sentinel on the first lifetime; each plan records its attempted lifetime. Undo rethrows that sentinel. The assertions that the structural row and both live values were restored pass. The final assertion expects two distinct attempted live lifetimes and receives one.

This is controlled private-port fault evidence, not an ordinary application-input failure, a measured stale endpoint, or a failed native write. It establishes that the consumer does not finish required later invalidation after a supported throwing port. A native-framework observer/cache staleness witness was not run. The relevant contract is completing the notification/invalidation obligations of the already-installed frame despite an earlier callback/adapter failure; it is not rolling back committed state or granting new settlement authority.

```sh
COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm exec nx test kernel --testFile=src/lib/internals/causal-runtime/heterogeneous-independent-invalidation.spec.ts --skip-nx-cache
```

Cwd `/private/tmp/link-a1-installed-operations`; Node24.15.0/pinned pnpm. Raw `INDEPENDENT-INVALIDATION-FIRST.log`: one test, one failure, exit1, 13:23:49. First red preserved; no repair or rerun performed.

## Other bounded checks

- **Classification:** `:1065–1112` routes an existing subject through the indexed collection/lifetime key and existing `__preparePointValues` port rather than asking scalar slots to resolve its owner. Structural-revival effects remain in the prepared-subject path. Missing current lifetime, unsupported port and deeper field paths decline; this does not invent missing parents or broaden the selected inverse.
- **P/O facts:** the physical row seed is used to construct the physical target; ordered explicit row/field edits carry selected ordinary authorship through `prepareRealizationTransition`. The separately selected ordinary group still installs through `ordinaryPlans`. A physical sibling snapshot is not itself an authored sibling edit. The change supplies selected metadata to the remaining notifications instead of inventing a new selection policy.
- **Installation:** the physical revision is sampled before preparation and checked for all heterogeneous frames, even those without a scalar frame. Structural, live point and ordinary plans install before clock advance and callback delivery. Supplied throw/reentry tests require no partial inverse, retain nested count5 after reentry, retry successfully, and verify redo. Their assertions are useful atomicity controls.
- **Publication:** one plan per lifetime plus `run(() => plan.publish())` keeps a throwing first row tap from starving later row publication; the supplied test asserts complete endpoint rows, not merely a callback count. The finding above concerns the separate invalidation phase.
- **Work:** new grouping traverses selected effects and uses existing collection-owner/lifetime lookup. I found no added scan of registered trees or unrelated collections. It does clone the touched row payload, so the source does not establish constant work independent of row size, nor a performance qualification.

Raw `FINAL.log` records six Nx files and 292 passes, including the unchanged original membership delivery and compound-order controls. This is useful successful-path evidence, not a replacement for the discriminating fault. No full registry, framework, budget, artifact or retention run was added. The pending ordinary-presence source gap and aggregate declaration scope decision are separate and receive no implementation authorization from this consumer review.
