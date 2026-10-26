# Complete-operation and leaf-Link design review

October 26, 2026. **Read-only design investigation complete; runtime successor remains unqualified.** Rejected candidate `f01ed39a7df8a5de185ebec0773e09e36537dacb` and production `87f6831fa60cafe87508f0ace84b7638698ca3b0` are unchanged. B remains closed. No new tests, model runs, builds, runtime gates or measurements were executed in this investigation; documentation checks are recorded separately below.

## Findings

1. Source installation, callback reentry, transaction capture and causal history turns are distinct boundaries. `undoable()` designation does not create a turn boundary. A completed source operation must be immutable before its first delivery; a transaction/history scope composes completed operations under its existing authority.
2. Compound undo composes physical membership/order over a larger boundary while leaving ordinary endpoints at the intermediate prepend. The paired-domain disagreement is source-confirmed and supported by the preserved public differential. Filtering absent IDs would not establish a valid inverse.
3. The separate leaf timeout originates in the new eligibility handoff: native membership projection updates the leaf's eligible value but supplies no new affected-leaf publication fact. Exact-position/ping filtering misses the ancestor event; supported-source delivery then lacks permission and retains a waiter. This is a source-derived causal explanation, not a new instrumented execution. Reusing an old fact for another payload is a separate unexecuted safety concern.
4. Shared facts cannot mean identical Link payloads: relationship creation adopts its then-current baseline. Two connections created on opposite sides of inspection must preserve different baselines while applying the same authorized footprint.
5. Extending the existing shared boundary/effect records is a serious alternative to enriching operation records. Neither is selected. The candidate already retains a transaction OperationRecord chain; adding a parallel chain is not justified by this review.

The [design](DESIGN.md) specifies six paths, eleven writer families, composition, consumers, reentry, faults, retention and unchanged acceptance controls. [Boundary trace](BOUNDARIES.md), [separate leaf trace](LEAF-LINK.md), [independent review](DESIGN-REVIEW.md), and [review disposition](REVIEW-DISPOSITION.md) distinguish established findings from missing native proofs. The [exact draft reviewed](DESIGN-REVIEWED-DRAFT.md) is retained. Source paths and hashes are in SOURCE-SHA256.txt; archive member hashes are in MEMBERS-SHA256.txt.

## Preserved verdict and replay

The [slice-5 qualification record](../slice5-integration-disposition/README.md) remains the authority for commands, logs, first failures, artifact identity and limits: **79/84 gates pass; 66 ordinary kernel failures; four bundle budgets fail.** Framework passes, expected failures and skips remain separate in that record. Nothing here changes those results, runs the missing semantic/mutation qualification, or establishes performance equivalence.

The two unchanged acceptance reproductions remain:

- `packages/kernel/src/enhancers/restoration/order-composition-readiness.spec.ts`: addition then overwrite prepend supports repeated undo and redo with held references. Candidate fails; production passes in the preserved run.
- `packages/kernel/src/lib/link-absent-locations.spec.ts`, filter `no enhancers.*an omission`: candidate leaf timeout with branch/collection controls passing; production all three pass in the preserved run.

Use the exact Nx commands and environments in the prior record; no disposable replay or weakened assertion is substituted here. Check this packet's frozen source hashes from the rejected checkout with `shasum -a 256 -c SOURCE-SHA256.txt` using the packet's absolute path. Check packet integrity from this directory with `shasum -a 256 -c MEMBERS-SHA256.txt`.

## Stop disposition

The finite design review is complete, but it has **not** proved complete-operation composition in a native representation. Concrete ordinary continuity, selected-scope and retention mappings remain necessary. A passing isolated model cannot lift this stop. No runtime successor, later qualification, activation, API change, ceiling increase, merge, push, tag or publication is authorized by this record.

Production remains unchanged. The source/evidence packet is preserved for a specific future decision; it is not an active list of caller-specific patches.

## Record verification

- Node 24.15.0: `node --loader /private/tmp/inverse-disposition-native/docs-loader.mjs tools/check-doc-links.mjs` passed: 768/768 relative links across 187 live surfaces resolve. The loader supplies the existing semver dependency from the main checkout; it does not change the checker. Raw output is docs-links.log; the loader is preserved as docs-loader.mjs for audit.
- `git diff --check` passed. The 19 source hashes match frozen f01ed39a; both unchanged falsifier hashes match the previous qualification packet.
- Readiness `git diff --name-only 87f6831f -- packages` is empty. Frozen candidate and comparator checkouts remain clean. No runtime tests were repeated to close this documentation task.
- Unrelated AGENTS.md and measurement-contract.md edits remain outside this record and commit. No ceilings changed.
