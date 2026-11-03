# Prepared disposition index — isolated prototype

One runtime function is changed from frozen R3: heterogeneous realization groups its immutable ordinary-plan changes by owner and entity lifetime during preparation. Publication then retrieves only the matching group, returning a fresh array per call just as the old filter did. Group order and strict-equality NaN behavior are preserved. No global cache, public API or production activation.

All base files verify unchanged except tree-realization-adapter.ts. Original source and first lazy-index version are preserved separately; final version builds its index before installation. The first version's result remains its own checkpoint. runtime.patch and IDENTITY.json identify the final candidate.

Final bounded diagnostic: 5 passes (slice/filter calibration plus 32/64/128/256-row round trips). Exact undo IDs and redo IDs pass; these diagnostics do not assert every row payload. The original broader wording is preserved in the prior archive and corrected following review. Counts for undo: 10,547 / 21,043 / 42,035 / 84,019; redo: 11,411 / 22,771 / 45,491 / 90,931. Initial population/replacement unchanged. Source types pass. Six unchanged heterogeneous/adapter files: 53 pass / 1 unchanged inner-realization authorship failure (already reproduced on R2/R3). This does not qualify that state defect or prove all semantic equivalence.

The calibrated baseline at the same sizes records undo 14,512 / 37,168 / 107,056 / 345,136 and redo 15,376 / 38,896 / 110,512 / 352,048. Corrected slice counting removes an inherited counter artifact: bounded slice copies output length, not full receiver length. The production regression test and its ceiling are unchanged. Source attribution identifies repeated plan.changes.filter at publicationMeta as the remaining quadratic term; replacing that scan removes the term in these workloads. Counts are selected iteration/copy work, not elapsed time, CPU, bytes or universal complexity proof.

Independent source review found no bounded blocker; its raw-results assessment is not an independent replay. Public Link composition, heap/retention, bundle/demo and matched performance remain unqualified. Large 130,000-row qualification has begun separately. The first launch selected no files because its positional path retained the workspace prefix; that failed command is preserved in large-entity-first. The corrected launch uses the kernel-relative path, without changing tests. No ceiling or timeout change in production tests.

## Unchanged large-file qualification

The corrected entity-large-batches invocation records one passing case, then worker V8 heap exhaustion near 4,056 MB live heap; Nx exits1. This is not a supervisor timeout and does not establish whether the index caused the memory demand. No case completion beyond that first pass is credited. The original path-selection command found no files and remains separately preserved.

The separate unchanged large-batch-restoration-v16-controls file passes both 130,000-row controls, Nx exit0, within original case timeouts. This qualifies that file only. The entity replacement/undo gate remains failed, and no package budgets, public semantics or test timeouts changed. Exact invocations and first logs are in large-entity-first, large-entity-corrected and large-restoration-first.
