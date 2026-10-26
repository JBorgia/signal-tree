# Independent public reentry interpretation

The preserved probe demonstrates stale ordinary delivery in the heterogeneous live-row publication path: after synchronous callback reentry, the final native value contains a=777 while the last endpoint payload contains a=11. This is not the earlier controlled invalidation fault, a declaration misuse, or an unmigrated plain-member writer.

## Artifact and ordinary-input status

Read `reentry-probe.ts`, `build-reentry-probe.cjs`, `REENTRY-SOURCE.json`, `REENTRY-PUBLIC-FIRST.log` and matching publisher source. Independently rehashed all 100 source entries: every recorded actual input matches. Probe SHA-256 `1668ecf5d5686159385fbe114277593447a4eaab01f8c4590f4325e8491ac7e6`; build script `c2776cec742a144d6a024c9493e9d63debbe65dcd154d74e544d1f491713e250`; built probe `7801ea07f7082868bf5d6aaf7399c26be2b937db88b6e86fc218a2af798a550f`; raw log `badccf4935519e01f4e7c636c7b61a072602352c58ae7f27b7e1657986394b6a`.

The harness bundles baseline f01 source with the archived composition lane and `FINAL-ADAPTER.ts` (`167803fd…`). Entity publisher is composition `956d39c8…`; Link is baseline `f74fa84f…`, not current full-A1 Link. This is an exact isolated overlay witness, not a fresh installed-package/all-A1 qualification run.

The probe itself uses public signalTree/entityMap/restoration/undoable/link/tap methods and an ordinary top-level entity field setter. No private effect, mock, thrown sentinel, inspection, conditional declaration or missing-parent input is used. The source-overlay build is experimental scaffolding; it does not turn the callback input into a fault injection.

## Observed divergence and source interpretation

Raw output:

```text
SEND [{"id":"a","n":50},{"id":"b","n":60}]
CALLBACK b
SEND [{"id":"a","n":11},{"id":"b","n":12}]
FINAL [{"id":"a","n":777},{"id":"b","n":12}] LASTSEND [{"id":"a","n":11},{"id":"b","n":12}]
```

The probe waits for microtasks and `c.settled()` before its final comparison. It logs rather than asserts; the differing values are directly observed. No error or unresolved waiter is reported.

`tree-realization-adapter.ts:1460–1500` installs all live point plans before publishing them individually. `entity-signal.ts:569–590` then publishes each prepared row's captured after-image and runs that row's onUpdate tap. The first tap, for b, writes a=777 synchronously. The outer publisher subsequently resumes another already-prepared row and publishes its older a=11 after-image without a source-revision/installed-sequence guard. Baseline notifier coalescing and projection consume notification chronology; the later old row can replace the newly authored value in outgoing evidence.

The first divergence evidenced by the log is the stale second SEND relative to the surviving native write. The internal enqueue chronology above is source-derived, not an instrumented event trace. There is no evidence that outer installation physically overwrote 777: the final native row retains it. The problem is resuming older delivery after newer work, not failure to install the complete physical frame first.

## Coverage classification

This challenges the sufficiency of the delivered completion mechanism: installing P/O before callbacks and containing each row's publication error does not ensure chronological application of ordinary deltas under reentry. A0 lines 81,95–96,124,128 require nested/newer work to remain distinct and prevent older deferred publication from replacing it. Those requirements directly describe this case.

It does not prove A0's proposed installed-sequence mechanism impossible, nor establish behavior of the evolving full-A1 Link. It does refute treating the corrected heterogeneous publication path as qualified for ordinary callback reentry on the strength of the 292 passing controls. The same newly routed existing-lifetime point plans and per-lifetime publisher are exercised; no new writer family or pending aggregate API is involved. Within that claimed-covered lane, this is a recurrence of the completed-operation/delivery obligation and must be recorded against the existing stop boundary, not reclassified as unmigrated membership work. Final experiment disposition remains centralized.

No runtime edits or reruns were performed. The first public failure remains preserved. Any claim that this is only a local omission must still demonstrate a correction preserving existing callback chronology, exact O facts and newer writes; the current witness does not establish such a repair or authorize it.

## Distinct combined A1 confirmation received after the overlay review

Independently read `reentry-permanent/FIRST.spec.ts`, `FIRST.log`, `BEFORE.json`, `AFTER.json` and `SOURCE-CHECK.json`. The before/after manifests compare equal. The permanent test imports the native package source normally and uses the same public operations. It first asserts the useful 50/60 send, then after undo/reentry and awaited settled verifies native a=777,b=12. Those assertions pass; the subsequent endpoint assertion fails with a=11,b=12. Nx records one test/one failure at 13:28:11. This separately confirms the mismatch in the combined A1 candidate; it removes the overlay-only limitation for this behavior without conflating the two artifacts. No rerun by this reviewer.

- `packages/kernel/src/lib/link.ts`: `1e854b98436cf1eac2b2c8e2d96ebd382031793fe02810589f555ffca93b6b4c`
- `packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts`: `167803fd47bfa52469f125f7fcddae8c5a84842f52f41b9ef8fff252d52226d0`
- `packages/kernel/src/lib/entity-signal.ts`: `956d39c81548d5168df8ba40a20ddedd40b89b10b46d26eebb2c37827033b013`
- `packages/kernel/src/lib/internals/causal-runtime/heterogeneous-reentry-publication.spec.ts`: `af6b26df9c06e0c62bc19e97bc0dd1ecded0fef6666547016b0b610380e2feb1`

The earlier overlay limitations remain accurate for that first witness. This new run independently establishes the same covered-path failure in the combined candidate. Runtime repairs remain stopped; no new API/source authorization follows.
