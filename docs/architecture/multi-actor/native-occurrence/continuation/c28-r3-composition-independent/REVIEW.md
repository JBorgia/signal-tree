# Independent frozen R3 composition review

**Bounded accept of the composed source/shared-ingress behavior tested here; no broad qualification or release acceptance.** Exact MANIFEST SHA2562a020da77e263693fbee66973bfba7072cb489a7cbde53bcda4336d686f820cd. No Main/root/candidate edits. Own copied source plus one additional diagnostic spec only. All3102 manifested files verified before copy and after execution against both copies.

## Layer audit

LAYER-AUDIT.json validates the31-entry composition chain from exact R3: every prior hash matches the preceding layer and the resulting map equals MANIFEST, with no unlisted changes. Eight reviewed test overlays remain exact. Dynamic/cleanup successor, index and metadata are not treated as alternatives silently replacing each other.

Independently reconstructed three-way merges using actual R3, cleanup/index source and exact metadata0ececc2f73a615ecebe88b0d44113cae7555ba1d19beefc4cc53c4acfa1c1061. Only transactions/intercept top imports conflict; retaining both imports yields byte-exact final source. All other metadata merges match cleanly. The prepared owner/subject index is preserved, alongside new realized admission frame options. No whole-context wrapper was introduced.

Archival qualification: COMPOSITION.json's `from` paths for those two import-conflict files point to metadata-merge staging bytes that STILL contain conflict markers, while the row sha256 describes final resolved bytes. Thus those two sourceHashMatches values are false in the audit by design of the packet. Final candidate hashes and independently reconstructed merge are correct; this is an archival provenance note, not an unresolved candidate conflict. Archive final manifest/candidate plus resolution, not staging paths alone.

PRODUCER-EQUALITY.json verifies the shared transaction producer's exact function text against reviewed cleanup successor. Its guards, cumulative/per-operation effect pair and detached record construction are unchanged. The explicit new shared attachment ingress invokes scalarAdmissionMetadata(getActiveWriteContext(), mutation) with the exact received attempt object. It neither reconstructs a reduced tuple nor forwards ambient metadata alone. isActive/changed/provider gates and identity-local release remain intact.

Both initial traversal and dynamic owned-leaf paths call that shared attachment. Legacy terminalRecord interception also uses the helper. Slot-frame preparation captures admissionParticipation before callback-capable equality, includes it on that attempt's mutation, and supplies the same classification to terminal/publication preparation. Selector derives metadata from this attempt; direct/reentrant writes without that flag retain their own ambient authored classification. Public callbacks still see original ambient context. Cleanup registration/unwind survives the transaction merge unchanged except reviewed metadata/dedup operations elsewhere in the file.

## Independent execution and added regression

Own `candidate/` includes only one extra file, internals/dynamic-realization-composition-independent.spec.ts. TESTS.patch archives it. Pinned Node24.15.0/pnpm/Nx, explicit8files, --skip-nx-cache --maxWorkers=1, own cache/data/tmp,120s owned-process bound. ingress-first/COMMAND.json retains exact invocation. **95/95 actual cases, exit0, no timeout.** First output preserved; no failed run or assertion adjustment for this added fixture.

Eight new dynamic tests fill a gap in the seeded metadata fixture: ordinary leaves are created after enhancer initialization. Both neutral and controlled native scalar carriers exercise prepareCommit and commit with realized frame B between authored A/C. They assert caller-context identity, exact realized flag, value/current identity, A/C rollback with B retained, and a later ordinary transaction on B which rolls back correctly (flag cannot stick).

Four of those8 cases exercise reentry from publication preparation to the same or another newly created ordinary source. Outer realized frame fails with Reentrant scalar preparation; inner authored write survives that refusal, stays in the outer transaction, and rolls back with it. Exact values, attempt flags, callback count and held leaf identity are asserted. These are private frame/publication integration controls on actual runtime, not merely a reconstructed algorithm model. Controlled native carrier is not a framework UI scheduling claim.

Remaining replay includes unchanged realization-admission-metadata controls, scalar lifecycle/minimal controls, both initializer failure tests, entire tree-realization-adapter and transaction-safety files. These include the earlier ABA and inner-realization failures plus the preparation-reentry history counterweight that rejected the whole-context prototype. All passed on composition. Counts overlap previous individual gates; do not add them as unique coverage.

## Limits

No independent complete8-overlay replay, all-framework replay, spec/source/public types, large files, heap, bundle or full suites in this turn; Main owns composition-wide qualification. Added dynamic shapes use explicit known-installed Location assertions and actual replaceLocation operations, not a widened public Record typing claim. No test/discovery/budget edit outside the extra own-copy fixture. Large entity OOM and prior first failures remain preserved;95passing controls do not establish cost/large-gate acceptance. No concrete cross-layer blocker found in the bounded scope.
