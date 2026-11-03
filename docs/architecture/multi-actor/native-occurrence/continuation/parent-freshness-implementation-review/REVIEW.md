# Independent bounded implementation review

Disposition: **accept this bounded proof; no blocker demonstrated**. This is not activation, integration, release, performance-budget or universal callback/retention sign-off. Main retains composition and final architectural authority. No frozen input or repository source was edited.

## Identity and premises

Reviewed candidate `/private/tmp/st-parent-freshness-resumed/c8-proof/candidate` against exact C8, not the working repository HEAD. Working repository HEAD inspected: `628d302dadb082a48c58528651c9088234d0a777`; its pre-existing dirty files were untouched. The frozen trees have manifest identity rather than an independently asserted Git commit.

- Candidate SNAPSHOT-PROOF SHA256: `5cb0b3d5616b3f9d002625270ee4b6793f8ba0388f5d6327ba52fa213d789b7b`; all 3047 manifest files verified.
- Base SNAPSHOT-C8 SHA256: `3ad1adb2de2936e52baf2ca06d630babc858d4186c2c4fed48818639056b388a`; all 3031 manifest files verified.
- RUNTIME.patch SHA256: `19e8c5dbd6208da35754e97244c389ade7f199548d6c81610ce309669cc78c6d`.
- tests.patch SHA256: `00a15e3ed20153d52b2993c27bd86e4ddd3bfb3460987da28afea021eb27f463`.

Controlling premise, current user instruction: “Owner authorizes acquisition-independent fresh SignalTree-provided reads duringcallbacks, app-created native computed timing unchanged.” Also: “Firstinvocation behavior/exceptionidentity shouldpreserve; don't repair arbitrary sortself-reentry.” The framework-current-read DECISION.md states: “Acquisition time does not change this guarantee. Application-created native computed values retain framework timing.” The C7a REENTRY-CACHE-RULES supplement is design guidance, not a replacement for this task's exact-C8 oracle or authority. Review contract, contributor ownership, support policy, scoped protocol, hook inventory and reentry rules were read. Contract file hashes are in FINAL-IDENTITY.json.

## Findings and interpretation

1. **The exposed callback deltas follow fresh explicit demand.** Paired grouped throwing sorts reproduce 9 base / 10 candidate comparisons in both facades. The extra call is precisely `completion-root`, calls 2→3, throwing the same original sentinel. The held collection reader already throws in both. `completion-derived` returns the old two-row value in both; both finish with three derived executions. A stale successful root would violate the authorized fresh reader contract here. No retry is introduced merely to overcome the error. Evidence: `runs/{focused,oracle}-{kernel,angular}/observations/sorted-true.json`; comparator assertions in compare.py ran.

2. **Neutral next-demand 6→8 is bounded recovery, not a changed first invocation.** sort-E4 and E5-child preserve the initial return and initial callback count; the next explicit root reads installed child/collection state and incurs two comparisons, then repeats without more work. All 20 marker/sort first-call outcomes across kernel/Angular match C8 after excluding stack paths. Exact error identity is separately asserted where reached. Same-node reentry is characterized, not repaired. Evidence: PAIRED-COMPARISONS.json and corresponding sort/marker JSON; compare.py ran. These controls do not certify arbitrary recursively mutating comparers.

3. **Cold Angular NG0600 does not erase an installed backing write.** The added paired probe records base `{backing:1,native:0,parent:{n:0},calls:1,sameError:true}` and candidate `{backing:1,native:0,parent:{n:1},calls:1,sameError:true}`. The parent read is fresh installed truth; it neither publishes the native mirror nor replaces the root's cached error. This is consistent with approved freshness and unchanged error/native timing. Evidence: `runs/discriminators-{angular,oracle}-final/observations/cold-error.json`; executable assertions and final cross-arm assertions ran. The probe uses transactions solely to obtain real position metadata and a discarded frame updater to inspect backing without installing a write.

4. **Pending-observation reuse is conditional, but no supported counterexample is established.** snapshot-authority.ts:93–96 can discard a freshly built result in favor of an earlier same-generation winner. It would be wrong if an included, cacheable source could change without an install hook. Public `registerMarkerProcessor` hardcodes `cacheSnapshot:false` (materialize-markers.ts:382–386); snapshotMarkerNode:266–268 marks its ancestry volatile. The only actual caller of internal `registerBuiltinMarkerProcessor` is EntityMap, whose installed revision paths now mark ancestry. Existing native signals/other-tree leaves are rejected as construction inputs; explicit leaf payloads stay opaque. The new public custom-marker probe reads a real Angular signal, changes it after an undelivered scalar install, and observes the new value before and after delivery. It passes. No artificial built-in registration or arbitrary mutable plain-store shape was used to manufacture a defect. A future supported cacheable source without a matching installed hook reopens this question. This is a bounded reachability conclusion, not a proof for every custom realization.

5. **Hook and dependency coverage has positive evidence.** Scalar frame and recorded writes mark after backing/evidence installation; native terminal readers read the native dependency before consulting backing. Member creation marks before completion, and actual presence changes mark held descendant accessors. Entity revision increments route through advanceInstalledRead. utils.ts retains dormant dependency reads and binds both string and symbol terminal/accessor ancestry. The full tracked builder runs on observer recomputation before cached identity reuse, preserving new-child dependencies. Executed focused controls cover new children, held dormant equal-value reactivation, a supported symbol-store child, refusal/discard/no-op, direct capture, and installed-source versus native mirror. Multi-parent aliasing is not established as supported and is not a rejection premise.

6. **Lifetime evidence is limited but consistent.** New snapshot/source-reader keys are WeakMaps; parents remain WeakRefs, with no new global strong registry. Angular construction/keyed cleanup tests ran and trees are destroyed in added fixtures. No independent heap-retention experiment ran; no universal leak claim follows.

The tracked builder can allocate a temporary output on delivery. This is explicit in snapshot-authority.ts:114–116 and the producer's builder-work artifact excludes direct fallback work from its counter. Do not report zero rebuild/allocation overhead or claim the old proposed callback-free touch optimization was implemented. No performance gate was requested or run.

## Execution and limitations

All execution occurred under this new review directory, using copied dependencies with local executable shims rebased, Node 24.15.0 and package-pinned pnpm 10.17.0 through Nx. Oracle manifest files were restored from exact C8 into a separately copied tree. Each run preserves COMMAND.json, first.log, RESULT.json and observations; compare.py supplies non-vacuous cross-arm assertions beyond permissive characterization fixtures.

- Candidate focused kernel: 32 passed, six selected files.
- Candidate focused Angular: 43 passed, eight selected files (includes construction input and cleanup controls).
- C8 oracle callback/reentry: kernel 13 passed; Angular 19 passed.
- Added candidate discriminators: 2 passed. Oracle cold-error discriminator: 1 passed; the separate candidate-only freshness test was intentionally excluded by testNamePattern, not counted as oracle coverage.
- Paired interpretation assertions: 24 controls passed; final cold-error cross-arm assertions passed.

Preserved first failures: the first new cold-error probe assumed position metadata without an enhancer; the second incorrectly called a substrate readSlot method on the tree-facing port. Both failed in both arms before parent evidence was emitted. FIRST-FIXTURE/SECOND-FIXTURE and their original logs remain. Corrected fixture uses the actual port and passes. Kernel logs also retain non-fatal missing archived tsconfig diagnostics. No production patch was changed to make these probes pass.

Producer's initial source/spec type failures and final passing result files were inspected; they are not represented as independently rerun gates. No broad suite, release build, spec-type gate, cross-framework sweep, heap study, benchmark or installed-package packaging test ran in this review. Source-backed versus native-mirror reads were tested; npm packed-package resolution was not.
