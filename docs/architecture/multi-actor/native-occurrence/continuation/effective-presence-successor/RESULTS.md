# Effective-presence successor: bounded result

Frozen for independent review, not release acceptance. Two shared kernel seams changed on exact C11; all requested bounded correction gates pass. No new mechanism gap was found in these cases. Main retains acceptance authority.

Manifest: `SNAPSHOT.json`, SHA-256 `47e05e6216bab9fd186dfbb66b656f4e33dc1f9d98a81a1ad096ee61b12181f9` (3,050 files). Baseline: C11 `SNAPSHOT-COUNTERPARTS.json`, SHA-256 `dc21671bf92e2a74bd5798bfccfbc0b02d13e58dff4fe328758fd604d9f70148` (3,045 files). Frozen C11 was verified before copying and after verification. Root and frozen sources were not edited.

## Correction

- `member-membership.ts`: the existing changed-presence walk marks retained presence-aware opaque marker wrappers through `markSnapshotInstalled`. It recognizes existing membership-hook metadata without invoking the hook, stops at the marker, follows own ordinary accessor data descriptors, skips accessor/store peer metadata, and uses an operation-local visited set. An independently omitted edge suppresses marker invalidation when effective absence is unchanged. No wrapper is instantiated by invalidation.
- `entity-signal.ts`: the existing shared `createVersionedProjection` cache also compares effective absence using the existing public-read absence authority. Version, install revision and absence are all sampled **before** computation. Successful results retain those attempt keys; throws do not commit keys. There is no automatic retry. The existing native observation dependency, publication boundary and R4 collection revision remain in place.

No public API, framework runtime, second epoch/graph, caller guard, payload traversal, early native notification, helper-level `empty`/`activeEntity` expansion, or arbitrary sort self-reentry repair was added. No performance or allocation claim is made.

## Executed gates

All commands ran sequentially with Node v24.15.0 / pnpm 10.17.0, matching root dependencies, no ST_PREPARED_REVIEW_OUTPUT, Nx cache bypassed. Exact argv/cwd/environment and raw logs are under `runs/<name>/`; `COMMANDS.json` indexes them.

| Gate | Result |
| --- | --- |
| Unchanged kernel absent-collection + parent-currentness/focused/entity + marker memo/snapshot builder | 122 passed |
| Unchanged Angular absent-collection + parent-currentness/focused/entity | 26 passed |
| Unchanged React absent-collection | 12 passed |
| Unchanged Solid absent-collection | 14 passed |
| New kernel controls, final frozen source | 17 passed |
| New Angular controls, final frozen source | 13 passed |
| Source types | Passed |
| Spec types after type-only fixture correction | Passed; ratchet unchanged |

The unchanged first ordinary re-add counterexample was also replayed alone and passed before the broader bounded files. Existing refusal/no-op controls remain unchanged in those files.

New controls cover direct and ancestor omission; all/count/ids/asMap/has/where/find at pre-notification membership completion; parent and marker-wrapper currentness; unchanged native computed until delivery; post-delivery identity and subsequent dependency; an independently omitted descendant; a genuinely cold wrapper with a warm held projection; cyclic opaque payload and throwing getter non-traversal; predicate presence reentry; and predicate/comparer nested installation with first result/error identity, exact callback counts, explicit next-demand recovery and stable subsequent identity.

## Preserved falsifiers and fixture errors

- Exact-C11 own baseline with the new kernel controls: **5 failed / 12 passed**. Four completion cases expose empty projections after reactivation; the opaque-payload case reaches the known stale parent-wrapper assertion. It does not fail by traversing the payload.
- Exact-C11 Angular install-reentry controls: **3 failed / 3 passed**. Successful where/find/sorted-all calls preserve their first `n:10` result but incorrectly return it again after a nested `n:11` install. Throwing cases retain the original sentinel. Corrected source passes all six, without retrying the first call. This directly supports sampling install revision before compute, as Main requested.
- First cold-fixture check: **2 failed / 4 passed** because ordinary preparation had already materialized the wrappers. The failure and exact test source are preserved. Those cases now accurately assert preparation-warmed wrappers; a separate bare-tree test positively asserts the memo is absent through omission/re-add until first wrapper demand.
- First spec-types run: **26 new fixture errors** across three files because overloaded `ReturnType<typeof tree.$>` selected `void`. Explicit snapshot shapes fixed only the types. `FIXTURE-JS-EQUIVALENCE.json` verifies identical emitted JavaScript for all five new files before/after that correction. No assertions or type ratchet were weakened.
- Original C10 React/Solid failure logs and the causal C8a/parent/C10 first ordinary replays are copied byte-for-byte under `preserved/`, with origin hashes in `PRESERVED-FIRST-FILES.json`. C10's original 14 failures are retained, not relabeled as passes. This candidate passes the unchanged focused files containing those cases.

The pre-existing archived audit tsconfig-extends diagnostic and routine environment warnings remain in raw logs; they did not prevent the successful test targets. Full kernel/framework suites and jump-undo-equivalence were not run. Main's incomplete full-kernel run is not counted here.

## Review artifacts

`RUNTIME.patch` contains only the two runtime changes. `FROM-C11.patch` adds those plus five new test files. Patch application was checked and replayed in a separate own directory; all seven outputs match the frozen candidate (`PATCH-ROUNDTRIP.json`). `FREEZE.json`, `VERIFICATION.json`, `RUN-SUMMARY.json`, `COMMANDS.json`, and `EVIDENCE-SHA256.json` identify source, commands and preserved evidence. Candidate source/manifest/patches are frozen; no further tests are planned pending review.
