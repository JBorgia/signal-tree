# Independent scalar-frame publication review

Disposition: changes required; not accepted as the complete shared scalar-frame handoff. One concrete finalization-order counterexample remains. This does not reject the passing coverage/completion improvements, qualify full integration, or authorize activation or a runtime repair.

## Identity and isolation

Reviewed author README, source.patch, exact candidate and preserved tests. Author manifest SHA-256: `e9b1555e1c2f49f1dfd5b26aa56cae20b22afa9d8d386c32f32091d46a8590a6`; source.patch: `c8e2819a9f36333533ccd3631f4411282882c87ce35ef33232c002d93c5790a7`; tests.patch: `b6824c397f9b70275c0e3db879e59bf9f28c0b7c29a3e1ae25812a19da3a1fa4`. Base is combined SNAPSHOT-A, not combined B or the ordinary-placement successor. Root HEAD inspected for context: `628d302dadb082a48c58528651c9088234d0a777`, branch `fix/d1-d2-forward-port`; unrelated root changes preserved. Review/contributor contracts applied; this is not release verification.

Execution copy: `/private/tmp/st-scalar-frame-publication-independent/candidate`. Final verification in VERIFICATION.json finds no mismatch in any of 2,970 manifest files in either author or independent copy. Separate baseline copy preserves all 2,963 original A files. Only independent new test source was added in the execution copy; its hash is recorded. No author/runtime/root edits or candidate combination.

## Finding: each source finalizes before later sibling preparation

`packages/kernel/src/lib/internals/tree-scalar-slot-runtime.ts:207–224` prepares each staged scalar sequentially through `prepareScalarSourcePublication`. `internals/intrinsic-mutation.ts:311–326` runs that scalar's preparers and immediately calls `nativeUnit?.finalize?.()` at line 322. The enclosing frame has not yet run later scalar preparers.

`experimental-publication/lifecycle.ts:155–166` describes finalization after all callback-capable preparation and before installation. Finalization samples the pending-owner window; outside active frames it caches the proof and clears its inputs/known arrays. A later sibling callback can open a real pending transaction on a separate tree. That does not change this frame's physical revision, so its revision guard does not reject the frame, and the first scalar's already-finalized requirement is not refreshed.

The independent control uses real neutral trees, the existing private publication-preparation seam, and the actual scalar runtime. It prepares a=1 and b=2 with `publish:false`; b's preparer opens foreign.x=7 in a real pending transaction. It asserts a/b remain zero after preparation, then installs and publishes the complete frame. Both scalar requirements are inspected through the actual native proof implementation. The first proof has `unknown:false, possible:[]`; the second has `unknown:true` and the pending foreign owner. Opening that owner in the first sibling instead makes both proofs retain it. Exact observations are in `runs/independent-controls-final/observations/sibling-window-false.json` and `sibling-window-true.json`.

This is a concrete order-dependent installed proof gap at the proposed shared preparation boundary, not a request for a new public callback API or a change to native computed timing. The test does not demonstrate a consumer endpoint leak, and does not establish that every public caller exercises this private hook. It does demonstrate that the shared mechanism does not satisfy its claimed all-preparers-before-finalization lifecycle when exercised through an existing callback-capable source seam. Passing ordinary public controls alone does not close this gap.

Bounded correction requirement for a separately reviewed successor: retain unfinalized source units until all callback-capable preparation in the owning installation unit has completed, finalize their windows before any stores, then perform required revision validation. Preserve direct-write finalization and exact per-source input facts. Account for mixed outer preparers where they share the same installation unit. Blindly calling finalize again on a proof whose inputs have already been cleared is not a sufficient correction. No implementation is supplied here.

## Bounded source positives and qualifications

- Native and neutral leaf creation bind scalar slots to their source identities. Frame preparation uses ordinary inspection baselines, including equality-only ordinary adoption; operation-local predecessor threading avoids collapsing later sibling facts onto stale predecessors. It does not give nested independent writes the frame's predecessor map.
- Installation stores values/shadows and source terminal records before invalidation. Completion ownership travels with the result independently of changedSlots, including publish:false. Completion drains units before invoking callbacks. Captured source completion parts survive unregistration and installed enrollment is consumed once.
- Native and neutral publication wrappers complete in finally. The independent error control confirms exact invalidation sentinel remains primary, both completions execute, and the secondary completion sentinel is reported through the existing console fallback. No new tree-scoped error-reporting promise is inferred.
- Private contribution metadata preserves enqueue-time payload/revision and per-contribution coverage. Coalesced coverage is intersected; mixed covered/uncovered contributions are retained separately. Link filters covered/stale exact-source scalar contributions rather than treating aggregate coverage as permission. Ordinary notifier subscribers retain their established metadata/delivery behavior.
- No framework runtime algorithm or public index/adapter export change was found. Shared wrappers and private notifier/Link plumbing do change; the four framework replays are bounded evidence, not universal supported-peer/native-timing certification.
- Existing net-ABA notification suppression is not converted into a new public delivery requirement. Synthetic uncovered-notification controls establish private plumbing behavior, not approval of arbitrary unsupported adapters.
- Completion clears its pending unit receipts. Retaining a commit result can still retain its coverage map/channel identities; no GC discriminator was run and no universal heap/release claim is made. No independent new retention failure was established.

## Executed evidence

All package tests ran through Nx with pinned Node v24.15.0 and pnpm10.17.0, skip-nx-cache, maxWorkers=1. Each named run directory contains exact COMMAND.json (argv/environment/cwd), first.log, RESULT.json, source-before/after identities and observations. Timings in raw runner output are not performance claims.

| Run | Result |
| --- | --- |
| runs/author-220-replay | 220 passed: author scalar preparation/finalization plus preserved branch, oracle, publication, membership, native-address, scalar runtime, reversal, target-transition and composition controls |
| runs/replay-final-angular | 28 passed |
| runs/replay-final-vue | 28 passed |
| runs/replay-final-solid | 28 passed |
| runs/replay-final-react | 28 passed |
| runs/independent-controls-final | 1 failed (later-sibling window), 2 passed (earlier-sibling positive control; primary/secondary error identity and drain) |
| runs/diagnostic-reds | 8 failed, 34 passed |
| baseline/runs/unchanged-diagnostics | Same eight named failures, 34 passed on unchanged A |
| runs/source-types | exit 0 |
| runs/spec-types | exit 0 under existing ratchet; no baseline edits |

The eight independently baseline-reproduced failures are six enrollment-invariance branch/root cases (before-pending, during-pending, enroll-in-updater) and the two whole-value-new-keys Link cases. They are inherited unresolved diagnostics, not newly attributed candidate regressions and not green acceptance evidence.

Minimal new-control replay from the independent candidate:

```sh
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false corepack pnpm nx test kernel --skip-nx-cache independent-scalar-publication.spec.ts --maxWorkers=1
```

Use the recorded command/environment to reproduce JSON observations as well.

## Preserved failures and not-run limits

`runs/independent-window-replay` and `first-window-fixture.spec.ts` preserve the first genuine counterexample. `runs/independent-controls` and `first-error-report-fixture.spec.ts` also preserve an initially incorrect independent error-report oracle: it expected onTreeError despite no treeId being supplied. Existing implementation uses console fallback in that case. The final test observes that fallback and verifies exact secondary identity; that earlier test failure is not a runtime finding. Initial `author-220` and `independent-window` setup attempts lacked the runner's predecessor manifest and failed before tests; those directories remain separate from successful replays.

Not run: full kernel or release gates, GC/retention sampling, performance/bundle work, all peer versions, combined-B/ordinary-placement integration, or a repaired implementation. The author candidate remains byte-identical. This review supplies a bounded falsifier and required lifecycle correction, not full integration approval.
