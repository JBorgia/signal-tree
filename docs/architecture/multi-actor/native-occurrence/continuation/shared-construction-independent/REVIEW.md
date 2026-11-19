# Independent shared-construction implementation review

Recommendation: bounded acceptance of resource ownership/cancellation and installed-receipt preservation for the two named post-construction ordinary-member routes. The original keyed refusal slot leak is closed by this exact successor. No source edits or integration performed. Main retains integration authority. A separately preserved parent-snapshot timing observation is NOT qualified by this resource verdict (below).

Exact shared manifest: `f63ade892aa381b827f1db54986fbb2ca787cb1bde497847104bd0a40bd9dffe` (2982 files). Incremental runtime patch: `cf878ebbd612bb79237f5fc38e31c980d09e42ccf2deeb7080c14bcabca5d679`. Base: `a158ac53ac601c7fbe065fe09ba0057f024a9695ac58d25bce14770fa61802b6`. SOURCE-RECHECK.json verifies every author/copy file, zero mismatches, exactly three runtime files and two author specs differ from base. Reviewer-only files are hashed separately. Prior review and failures: /private/tmp/st-construction-cleanup-independent/REVIEW.md.

## Source-owned resource and receipt assessment

1. Ordinary recursiveUpdate and keyed materializeMember both obtain PreparedMemberConstruction from the actual owner-bound constructor. The keyed route now creates its allocation BEFORE reserving position or recursing; responsibility receives the exact `(ownerBranch,key,child)` that later installs. No caller reconstructs responsibility or chooses a foreign source.
2. constructionContext strips a prior provisional allocator before creating a fresh attempt. Reentrant nested installations therefore have independent inventories, including same-key attempts. No reused slot truncation or global registry is introduced.
3. The original neutral/native detached binding handoff is unchanged. Before installation, reads/writes/derive use detached storage; changed detached revision refuses installation. Attach switches all kernel/publication/liveness variables and records actual live slots without calling equality, factory, user getter, or notification. A second Angular factory throwing after one leaf leaves no live slots and does not invalidate the readable first detached carrier.
4. Cancellation removes exact provisional registry entries, owned intrinsic capture observer, ordinary branch-builder entries, leaf registry forwarding, and branch+backing runtime/registry forwarding. It clears attach/cancel/check arrays. Escaped branch callable/updater/new-key attempt cannot acquire root storage through the canceled builder.
5. Both callers cancel in finally, but allocation state is already installed before callback-capable completion. Exact terminal map records, child identity, scalar storage and nested installed handles survive a completion that reenters and then throws. This is tested for both entry routes in neutral and actual Angular, not inferred from test totals.
6. KEY_INDEX lookup remains before construction: existing active/dormant members retain their applyMemberValue route, identity and allocation count. The new packet is private; public barrels are unchanged. It does not cover EntityMap row producers or arbitrary custom marker construction.

## Exact independent execution

All runs have COMMAND.json, first.log, RESULT.json. Node24.15.0 and pinned corepack pnpm; no runtime edits. Test filenames below are literal command filters; Nx command form is `corepack pnpm nx test <project> --skip-nx-cache <files> --maxWorkers=1`.

- unchanged-review-kernel: kernel construction-marker-review.spec.ts construction-review-controls.spec.ts construction-resource-cleanup.spec.ts shared-construction: 11 pass in3 files. `shared-construction` matched no author fixture; no claim it ran. The unchanged marker falsifier was red1 on a158ac53 and green1 here.
- unchanged-review-native: angular construction-resource-cleanup.spec.ts construction-factory-review.spec.ts construction-retention-review.spec.ts shared-construction: 7 pass in3 files. Same unmatched-filter limitation.
- route-receipts: kernel construction-routes-review.spec.ts keyed-construction-cleanup.spec.ts: 10 pass/1 reviewer failure, preserved. All5 author keyed controls executed here.
- explicit-payload-receipts: kernel construction-routes-review.spec.ts: 6 pass. Both routes: same-key preparation reentry WITHOUT an explicit nested refusal; exact responsibility source/child pairing; completion reentry then throw preserving two installed receipts and identities; detached mutation rejects prepared payload and cannot affect retry.
- native-explicit-payload-receipts: angular construction-routes-review.spec.ts: same6 pass using actual native cells and typed internal writer dispatch. Existing author tests independently cover native .set/.update/isSignal/computed.
- native-route-retention: angular construction-retention-review.spec.ts keyed-construction-cleanup.spec.ts: 14 pass (12 targeted retention +2 author native keyed).
- retention-route-controls: `NODE_OPTIONS=--expose-gc corepack pnpm exec vitest run --root packages/kernel --config construction-review-gc.config.ts --maxWorkers=1`: 12 pass. This follows the repository dedicated retention gate pattern, outside kernel Nx runner which hardcodes its config. NODE_OPTIONS is inherited, not captured by runner whitelist; every case requires actual gc.
- source-types: `corepack pnpm exec tsc --noEmit --pretty false -p tsconfig.typecheck-all.json`: exit0.
- final-spec-types: `node tools/check-spec-types.mjs`: exit0 after reviewer fixture type repairs. Earlier invalid string completion token errors are preserved, not a runtime failure. Final-sidecar-spec-types adds the later diagnostic; see RESULT.json.
- completion-snapshot-diagnostic: same exact kernel diagnostic executed on BOTH a158ac53 and shared successor; exit0 generating raw observations, not an acceptance assertion for snapshot timing.

No broad author433/28 replay or release/build qualification claimed.

## Retained edges: discriminating evidence and limits

Matrix is ordinary-refusal / keyed-refusal / no-attempt teardown × held/drop × capture/no-capture, on neutral and actual Angular (12 each). After unregistering participant, disposing Link, destroying root, and draining notifier, hold only the escaped child (when one exists). Weak targets are root accessor, scalar runtime, capture runtime, and registry when present. Explicit GC runs across16 separate jobs; weak refs are NOT dereferenced between rounds. Only AFTER collections are they dereferenced; held child read also occurs afterward. All available weak targets collected in all arms. Detached read/write was checked before collection too.

This is positive collectibility with dropped and no-attempt controls, not a universal heap claim or live-tree retention proof. No failed root edge demonstrated in this scope. Source tracing matters: merely observing slotCount0 or removing registry properties would not establish this. The owned observer release and builder deletion are required closure-edge removals. Retained local LocationRuntime association did not retain these root witnesses in these cases.

Prior all-retained/invalid-WeakRef fixture is preserved under old review runs/retained-edges-direct-retention; it is expressly NOT a leak finding. The neutral corrected four and Angular corrected four passed before this larger control matrix.

## Preserved completion snapshot observation; separate timing boundary

The first receipt fixture used `rows({...rows(),b:{n:2}})` inside completion of installing a. It initially also claimed every membership visit, producing an extra completion for existing a; restricting the participant to ordinary.before.present=false removed that fixture mistake. Its next assertion saw `{b:{n:2}}`, not `{a:{n:1},b:{n:2}}`, in BOTH neutral and Angular. Those raw failures remain under route-receipts-first-appearance and native-route-receipts. Subsequent updates asserted below that point did not run there.

A typed diagnostic now records identical results on prior and shared source:
`observed={}`, `physical child a.n()=1`, `nested payload={b:{n:2}}`, `after={b:{n:2}}`.
See runs/completion-snapshot-diagnostic/observations/completion-snapshot.json in both review roots. Physical installed identity and receipts survive; the nested whole write really omitted a because it constructed its payload from an old parent snapshot. The explicit-payload receipt control instead supplies `{a:{n:1},b:{n:2}}`; all subsequent assertions pass. This separates receipt/resource correctness from snapshot freshness; it does not redefine the original read-derived oracle as passing.

Source boundary: installPreparedMember publishes membership before completing; snapshot-authority.ts:69 increments the membership cell, but materializeSnapshotNode uses a cached locations.createDerived. location-runtime.ts publish queues during an invalidation group; notifications/derived invalidation drain when the group exits. The ordinary caller is already in that group, so increment-before-completion does not imply recomputation-before-completion. Neither shared delta nor this review changes that timing. Main must retain this evidence for any broader direct-parent-read timing qualification; no newly approved semantic concession is implied by this bounded resource verdict.

## Final freeze check

`final-types-corrected`: spec ratchet exit0, no baseline update. The final diagnostic required a runtime shape guard for its unknown dynamic child; its initial type failure is preserved in final-sidecar-spec-types. `typed-completion-diagnostic` exit0 on BOTH predecessor and successor with the same raw snapshot observations. All2982 shared source-manifest files rehashed unchanged after review; original2980 predecessor files also unchanged. REVIEW-FIXTURES-SHA256.json identifies final reviewer additions. Resource/installed-receipt verdict above is final for f63ade; no new demonstrated resource blocker remains in either named route. The separate inherited parent-snapshot timing observation remains explicitly outside that verdict.
