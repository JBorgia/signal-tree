# Independent partial producer-slice review

**Bounded acceptance of this scope-declaration/per-step handoff slice.** No concrete regression found in the reviewed patch. This does not accept ownership repair, complete native integration, work/retention qualification or public activation.

Identity: runtime.patch SHA-256 `41410c87e937f5bd3b6f7d8a93df9a7f6e5ddef1fcdbc7d910ab63b9a90dc7f8`. All frozen evidence hashes, 2921 candidate manifest files, and 2918 predecessor plus unchanged-control manifest files verified. All 28 baseline/final diagnostic stage records match exactly. These comparisons preserve known incorrect proofs; they do not prove their repair.

## Writer semantics and handoff

- The six replacement constructors are explicitly classified: placement realization, full add-overwrite, replaceOne, transformed updateMany keys, merged upsertMany update keys, and full setAll replacement. Direct updateOne separately carries transformed keys.
- replaceOne retains the existing callable-intent precedence over ambient mutationIntent. Row updater calls remain derive; literal row calls remain replacement. Derive classification still uses the existing value-store resolution, including its accessor staging and ordinary-field semantics. This slice does not add resolved derived-field evidence or an ownership result.
- Partial field scope is not equivalent to independent provenance. Field callbacks and enclosing updaters still depend on existing input/context capture. Likewise whole setAll/add-overwrite scope does not erase inherited consumption. The new tag must not be interpreted as a complete input-origin classification or clean proof.
- Previously omitted add-overwrite/setAll scopes become null. In the existing value store undefined and null both take the whole-replacement path, so this makes declaration explicit without changing that transition. The realization sentinel maps back to the previous undefined transition behavior; it is not a new ordinary author.
- Frame replacement classifications are associated with the corresponding changes ordinal and handed off with ordinaryPlan.byStep. Frozen field arrays prevent later mutation of the declared list. Direct updateOne now supplies an explicit step carrying its existing ordinary changes and explicit keys. No recipient consumes authoredFootprint as ownership in this patch.
- Required PreparedValueReplacement scope is private; no public export/signature or callable behavior change was found. Optional publication-step footprint remains for non-replacement paths. Inspection keeps its existing ordinary-step suppression.

## Independent execution

Node24.15.0/pnpm10.17.0 through Nx, NX_DAEMON=false NX_ISOLATE_PLUGINS=false, --skip-nx-cache.

1. Candidate `native-authored-footprint.spec.ts entity-mutation-frame.spec.ts`: **7 passed**, raw focused-replay.log.
2. Candidate `native-certificate-successor.spec.ts entity-publication-work-lifetime.spec.ts native-structural-composition-gates.spec.ts`: **6 passed / 5 failed**, raw candidate-failures.log.
3. Same three suites in unchanged baseline-control: **6 passed / 5 failed**, raw baseline-control-failures.log. Names and assertion/error outcomes match: original restoration support failure; three occurrence-enrollment failures; compound inspection rollback order mismatch.

Thus the five inherited-failure claim is independently reproduced. The three work/lifetime cases fail before their measurement loops and establish no cost/retention result. The supplied 67/5 broader run and typecheck records were inspected, not independently rerun in full.

The authored-footprint test exercises whole/partial/row-updater tags and equal-value separation, but does not itself exhaust every callback wrapper, realization or multiple-step permutation; acceptance of those code paths here also relies on source inspection. Remaining admission/normalization/inverse pairing and output-demand/materialization work is explicitly unimplemented, not silently qualified by this review. Native source and author files were not edited.
