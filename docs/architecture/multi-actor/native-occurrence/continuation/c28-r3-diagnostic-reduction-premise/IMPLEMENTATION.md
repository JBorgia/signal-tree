# Independent bounded implementation review

**No blocker demonstrated in the inspected diagnostic-reduction diff.** Per-collection state, shared where/find warning accounting, separate query caches, rate policy, runtime flag toggling and query behavior are preserved by source comparison. The new shape plausibly enables production folding, but fresh emitted artifacts and package qualification remain necessary. No size success or release approval is asserted.

## Reviewed identity

Implementation root: `/private/tmp/st-c28-r3-diagnostic-reduction/candidate`.
Base: `/private/tmp/st-c28-r3-registration-lint-combined/candidate`, manifest `89058c7adf0bf680c3d8ef4778ff31d295ccc40d1911a31ac254484fa24a5c84`, independently verified during the premise review. The isolated candidate is not a Git checkout. Ambient repository HEAD remains `628d302dadb082a48c58528651c9088234d0a777`; unrelated dirty files remain untouched.

Compared all base-manifest entries: changed listed files were entity-signal.ts, constants.ts and check-devmode-foldable.mjs. New relevant source files are predicate-churn-warning.ts and entity-diagnostic-folding.spec.ts. Reviewed their actual contents, not an author verdict. Source hashes below were rechecked at the end; this is a point-in-time review of an active candidate, not a freeze of later work.

| Candidate-relative file | SHA-256 |
| --- | --- |
| packages/kernel/src/lib/entity-signal.ts | `1ee41e63bbfdc7d7bcca56e1f816d4dab041d4ffe5fe3709804a112508f3c051` |
| packages/kernel/src/lib/constants.ts | `dca84d80c06290aa139172821fa3aabfa6a6a89581fb5b1a098b1325c72d3209` |
| packages/kernel/src/lib/internals/predicate-churn-warning.ts | `c51c8b60f55bea8ca2e0fd501a970a2097d046b7c09cd5765719af801fb2d93e` |
| packages/kernel/src/lib/entity-diagnostic-folding.spec.ts | `531b5289bf45fb44871d8a0d308f8477009e5dd70a49eebc5b9c0fdcda52f436` |
| tools/check-devmode-foldable.mjs | `7abc79952aa6a8e131fb0db7235d0d94483fd1def081ad3ee3594d785e3b4078` |

Machine-readable duplicate: `implementation-source-hashes.json`. Review/contributor/build/support contracts read for the preceding premise review remain applicable.

## Semantic assessment

### Predicate diagnostics: preserved

`entity-signal.ts:1984`, `4062`, `4110`; new `internals/predicate-churn-warning.ts:2–45`.

The callback variable is inside createEntitySignal, not module-global. The factory allocates its Map and Set inside each invocation, so two collections cannot share counts or warning suppression. Both where and find initialize/use the **same** callback variable. Their distinct WeakMap query caches remain untouched; the factory does not replace, merge or hold those caches.

I ran a mechanical comparison of the moved state/function block: it is identical except for the factory's returned-function syntax. Threshold 12, elapsed-time reset strictly greater than 2,000ms, source-text keys, once-per-source suppression, the existing `size > 200` cutoff, time-source fallback and warning prose remain exact. It still counts diagnostic cache misses, not a new explicit set of function identities: the same function can contribute once through each of the separate query caches, as before. No semantic cleanup of that behavior is hidden in this change.

I also mechanically compared both complete query bodies through their return statements after normalizing the changed diagnostic invocation. They match exactly. Tap-depth early returns, cache-hit early returns, predicate evaluation, sort handling, derived-cell construction, caching and query results are unchanged. New allocation occurs only at the first qualifying diagnostic call; no stringification or clock read moves onto a production or cache-hit path.

False at construction followed by true/absent at use works because initialization occurs inside the existing call-time guard. True → false preserves existing diagnostic state without incrementing it; false → true resumes it, with the original elapsed-time rule deciding whether a window resets. Production-created cached predicates still skip diagnostics after enabling the flag, just as baseline does. The factory is assigned before predicate stringification, so reentrant conversion sees the same closure rather than allocating a second one.

**Cheapest falsifier/status:** existing predicate tests plus the new two-collection toggle test. Main's inspected successor log reports these passing; I did not rerun the integration suite. Exact source/body comparison ran independently. Mixed where/find threshold, true→false→true window continuation, cap boundary and Date.now fallback lack explicit new integration tests; unchanged body/call placement provides source evidence, not fresh runtime coverage for those cases.

### Wrong-method guard and proxy: preserved supported behavior

`entity-signal.ts:5602–5631`.

The local Set now initializes only for a qualifying wrong-name read. The development guard moves before the property checks, enabling the complete diagnostic expression to fold. Numeric-string routing still executes first. Symbols, normal properties and custom properties named like wrong methods still return target[prop]; accessor receiver and method identity are unchanged. No Reflect.get receiver substitution, numeric parser change or proxy replacement occurred. Per-name suppression remains per collection and survives disabling/re-enabling diagnostics.

The intentional observable difference outside ordinary supported use is that production no longer evaluates the diagnostic table lookup or `in` check. Modified Object.prototype accessors can observe that removal. Conversely, a getter-backed ngDevMode global is now read for nonnumeric real/symbol properties where baseline might short-circuit before reading it. This is not universal equivalence under instrumented host globals; no supported contract requiring either incidental access pattern was found. Ordinary boolean/undefined flags retain the intended policy, including absent flag with NODE_ENV=production remaining development behavior.

**Cheapest falsifier/status:** independently ran extracted successor proxy probes with stub byId under absent/true/false flags: coercible numeric strings, symbols, accessor receiver identity/count, unknown property and wrong-name deduplication passed. Main's new full EntityMap test checks numeric routing, symbols and an accessor; its existing suite includes batching's update-probe regression. Inherited accessors and exotic global getters were not executed in this review.

### Constants: preserved messages and type shape

`constants.ts:26–38`.

The same `as const` object is still frozen and exported; both removed selector arms aliased that very object. Keys, string literals and readonly/frozen behavior remain. Import-time environment reads intentionally disappear; this does not change entity diagnostic policy. No query/runtime environment helper is introduced.

**Cheapest falsifier/status:** independently ran exact-string/frozen-object assertions for the successor across absent/true/false ngDevMode and absent/development/production environment. All nine evaluations passed. Main's source-types run reports exit 0 and its SOURCE.json matches the reviewed runtime/test hashes. Declaration-output equivalence and package consumers were not independently run.

## Folding assumptions and remaining gates

The helper module contains a function declaration with no top-level allocation or registration. Its only runtime use in this diff is under the unchanged foldable query guards. With ngDevMode explicitly replaced by false and consumer tree-shaking enabled, those calls/imports should become unnecessary. The proxy's leading false guard should remove the table reference and lazy Set allocation. Constants no longer contain environment selection. These are source-level reasons to expect folding, not proof of emitted output.

Moving the function across a preserved-module boundary still relies on the actual build/consumer pipeline eliminating the unused helper. A runtime false global, NODE_ENV alone, or a different bundler configuration does not establish the same removal. The unconfigured/development graph must retain usable diagnostics. Do not add an unconditional pure annotation that erases development initialization.

`tools/check-devmode-foldable.mjs:110` adds ST2026 to the advisory-only list without removing required errors. The inspected baseline log fails specifically for surviving ST2026, which is a useful nonvacuous red baseline. Its saved SOURCE.json covers package sources, not the gate script hash, so that log is not independently hash-bound to the reviewed gate revision. The checker detects retained warning literals; passing it alone does not prove that every diagnostic allocation/table reference disappeared. Fresh four-graph inspection should confirm those structures, development warnings and retained required errors. No fresh successor artifacts or size-budget result were verified here.

## Run evidence and limits

Main's logs inspected: baseline-added 3 tests pass; baseline-diagnostics 18 pass; successor diagnostics 21 pass; source-types exit 0; baseline-folding exit 1 for ST2026. Relevant package-source hashes in each SOURCE.json match baseline or the reviewed successor as appropriate. Test logs include tsconfig-paths parsing warnings for an audit fixture; they still report the stated tests passing and Nx success. I did not silently reinterpret those warnings as a clean log or a runtime failure.

Independent work run: base/current diff inspection, exact helper/query comparison, current source hashes and final stability check, isolated successor proxy/constants probes. Reproduce the latter with Node 24.15.0 and `implementation-probe.cjs`; results are in `implementation-probe-results.json` in this packet. These probes transpile source into isolated VMs; they do not execute the entire library.

Not run independently: kernel Nx integration suite, fresh build, public/spec/declaration type gates, installed consumers, fresh artifact folding gate, four successor graphs, size/performance or release gates. No candidate source edits were made. Main's continuing implementation/build verification remains authoritative for those pending results.
