# Bounded Link policy comparison — failed integration candidate

Baseline HEAD ffc50d3be5b19bd76c1cd4c20bc7d8144972b73b, Node v24.15.0. No repository edits, commits, public exports, release work or budgets. Original files remain untouched. This is ONE finite evidence engine and ONE bounded ingress bridge, not production acceptance. Automatic independent progress for ordinary writes remains UNMET.

## Executed actual-Link evidence

`node /private/tmp/link-policy-bridge/loader.mjs` builds original kernel with private in-memory substitutions at two Link admission sites, one precise acquire bracket, scalar projection revision receipt, notifier metadata revision stamping, and disposal callback cleanup. The endpoint queue, eligible projection, knownY, serialization and settlement code remain actual Link. `BASELINE=1 node .../loader.mjs` builds byte-identical original kernel sources; receipts confirm zero transformed source differences. Runs use the same witness. Use ONLY baseline bridge=false rows as valid paired unchanged-source controls. Baseline bridge=true rows are inapplicable harness diagnostics: original code has no private policy, so progress expectations fail and in-flight release may be undefined. Those rows are not counted as runtime failures. Raw originals are preserved.

| Discriminator | Actual bridge result |
| --- | --- |
| Same-tree x pending at7; separate subscription-only incoming y and set-only outgoing y; acquire42 then7 | Sends `[42,7]` while x remains7. Control sends `[]`, then `[7]` after confirmation. |
| Ordinary direct y=42 while x pending | Holds `[]` before AND after confirmation. Safety fallback only; normal/default usefulness and required ordinary independent progress are unmet. |
| Copy x7 to y outside transaction, then rollback x | Bridge holds `[]`; actual control sends `[7]` after x becomes0 and surviving y remains7. This sequence tests unowned copy; it does not claim a transaction-owned y rollback leaked. |
| Callback writes previous y or captured x after clean ingress42 | Holds `[]`; arbitrary callback not classified clean. |
| y already7 unknown; acquire7 | Holds `[]`: actual no-op creates no revision proof. |
| Known42 in flight, known7 replacement before completion | Sends `[42,7]` serially. |
| Sending observer replaces y with pending copy7 | **FAIL** sends captured `[42]` despite current y7. This is stale-revision admission, NOT speculative7 leakage. No final-guard repair applied. |
| Known42 in flight; unknown7; finish42 so send admission holds; then acquire9 | **FAIL** remains `[42]`: private held send is not awakened and blocks later queued flush. No scheduler redesign applied. |
| Intrinsic observer registered before links writes x7 during ingress42 | Sends `[]`; specific reentry test conservatively invalidates ingress proof. Does not qualify all intrinsic ordering. |
| Enqueue observer reenters after stamp | Sends `[]`; latest revision invalidates receipt. |
| Dispose queued outgoing connection | No send. |
| Dispose already-started outgoing42; finish promise; acquire9 | Only `[42]`; bytes already started remain unrecalled. |
| Acquire42 then immediately tree.destroy() | **FAIL** sends `[42]` in both control and bridge by the post-destroy checkpoint. A later harness attempt to confirm the destroyed transaction throws; recorded separately, not the send assertion failure. No production defect conclusion without lifecycle investigation. |
| First endpoint throws; next eligible ingress9 | Attempts `[42,9]`; existing error reporting retained. |
| Separate z connection receives9 | z sends `[9]` despite x pending. |

First-run.log and traces-first.json preserve first failures. Extended-run.log / traces.json contain added reviewer falsifiers. The latter includes expected endpoint errors and explicit harness errors on attempted confirm after tree destruction. No assertions were weakened or admission algorithm repaired after failures. Snapshot-run.log adds source receipts without changing policy. Original/source-loaded snapshots are saved as `link.ts.original`, `link.ts.loaded`, `path-notifier.ts.original`, `path-notifier.ts.loaded`; baseline-prefixed variants are byte-identical. receipts.json lists exact substitution counts and original/loaded SHA256 for every kernel input. SHA256SUMS pins final files, including bundles and logs.

## Finite A/B/C engine comparison (MODEL ONLY)

`node engine-test.ts` exercises the SAME evidence eligibility algebra with A automatic scheduling, B complete declarations at unknown boundaries, and C explicit request scheduling. `engine-run.log` records all passing model assertions and raw payloads. It is not a Link scheduler and does not demonstrate runtime evidence capture or actual B/C integration.

- Two owners: one confirmation or refusal cannot release; both confirmations admit whole immutable record. Rejected/destroyed/missing owners cancel rather than becoming empty.
- B/C complete declarations preserve every observed owner, reject omissions/foreign identities before current authority replacement; partial declarations cannot clear unknown. C tree updates alone do not request publication.
- Complete empty declaration permits unknown ordinary input; false complete empty declaration with hidden rejected input deliberately sends7. This negative witness is an application trust burden, not automatic provenance safety.
- Whole record immutable capture, revision replacement and final observer revalidation pass in the MODEL. Actual Link final observer revalidation FAILS above.
- Simple parent/child/previous facts union preserves owners and unknown. Independent outer constant retains false dependency: explicitly UNMET. No automatic getter/frame/throw instrumentation was implemented, so model union does not qualify such capture.

B requires complete contributor declarations at every unknown boundary (including hidden closure/cache/deferred inputs); C additionally requires each manual snapshot request. Neither can erase known pending/rejected owners. This is internal vocabulary, not selected public API.

## Verification and limits

Strict TypeScript check passes for engine.ts, engine-test.ts and private.ts:
`<baseline>/node_modules/.bin/tsc --noEmit --strict --target es2023 --module nodenext --allowImportingTsExtensions /private/tmp/link-policy-bridge/engine.ts /private/tmp/link-policy-bridge/engine-test.ts /private/tmp/link-policy-bridge/private.ts`.
Esbuild executes witness/transformed source but does not typecheck those integrations. Initial `node engine-test.ts` could not parse a TypeScript parameter property in strip-only mode; engine-first-run.log preserves that COMPILER/HARNESS failure. Changed only equivalent constructor syntax; subsequent test and strict check pass.

The scalar bridge marks all non-acquisition mutation receipts unknown; it does NOT implement automatic portable dependency discovery, owner outcomes, callback-frame restoration or rejected-owner tracking. A/B/C owner logic is model-level only. Actual Link records, native cached cells, entity lifetime/membership, callback x→y→z, nested throws, async declared boundaries, full-suite/release gates and GC retained-root measurement are UNEXECUTED/unqualified. Tree lifecycle has a concrete failing discriminator, not a lifetime proof. Clean metadata comes from first matching synchronous scalar notification during acquire, not payload equality; pre-notifier and enqueue reentry tests qualify only those exact orderings. An endpoint falsely presenting speculative computation as authoritative ingress remains trusted under the existing contract; no provenance discovery claim is made.

private.held callbacks drain to zero after explicit disposal. private.latest and receipts remain retained across runs; this is an unbounded research metadata limitation, NOT cleanup/GC evidence. No memory/performance claims. Unknown holds never delegate to original settlement, so rejection cannot accidentally cleanse them, but this disables ordinary useful behavior; the comparison is partial by design and fails acceptance.

Conclusion: bounded authoritative ingress progress is demonstrated, while the unchanged requirement and lifecycle/reentry/held-send controls are not satisfied. Stop here; do not promote this candidate or iterate provenance architecture from these results.
