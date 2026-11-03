# Independent C20 recipient correction/discovery review

**Bounded accept: the two requested assertion corrections are implemented, and the exact twelve-case archival scope preserves all thirteen original counterweights live.** No additional source correction requested. This is source/discovery approval only; Main's targeted25 execution is separate qualification evidence.

Exact C20 manifest: `9f14f5a476482cca596528aaed18cbf6be17122f73261e0fa047be40b641e94c`. Compared with exact C19 `b8eace4025ff735988dee88db512a2e9ceb5ac9e1302683d68d6900acea17576` and the previously reviewed positive spec `f403ea1d3e618a90c13cf0a4d0b6f81fdb849680875e7a8bcccc5e540738124d`. All manifest files checked; only the three specified specs differ. No runtime/configuration/public API/budget changes. Inspected /private/tmp/assemble-st-c20.py as source; did not execute the assembler or edit frozen inputs.

## Pre-start declaration capture

Both parameterized groups now save the original lifecycle.started function, install a forwarding spy, capture hasDeclaration(channel, revision) into a plain record BEFORE calling originalStarted(...args), then delegate normally. No return value or retirement behavior is replaced. The assertion locates the record by exact secondary channel and actual started revision. Missing record yields undefined, which fails toBe(false), so this does not pass vacuously. Existing exactly-one started call and surviving-basis assertions remain. Both spy instances restore at teardown.

This observes the intended pre-retirement permission state instead of relying on the deleted operation after started. It closes the specific safety-evidence gap from the C19 review without adding a runtime permission or API.

## Post-settled observations

After pre-terminal child/b settled, both groups now reassert exact primary and secondary arrays, one secondary start, unchanged pending-owner inspection, local state and foreign value7. The equal-repeat case also reasserts the no-write receipt.

After the terminal action, flush and final settled await, both groups reassert exact arrays, one secondary start, exact local state, correct foreign value (7 confirm, 0 rollback), and the equal-repeat no-write receipt. A duplicate/stale send during settled can no longer escape the terminal assertions. Existing pre-await assertions and useful initial holds are retained. No longer wait, timing oracle, reduced count or optional success branch was introduced.

## Exact routing and retained obligations

Verified byte-identical full original files in research-only/*.spec.ts.txt against C19. Each DISCOVERY-CHANGES.json removedExactBody is a unique exact substring of its original. Removing precisely those three bodies reproduces C20's two active original files byte-for-byte:

- First omission scalar/empty/collection/mixed × confirm/rollback:8 archived.
- Equal undeclared recipient × confirm/rollback:2 archived.
- Membership omission recipient × confirm/rollback:2 archived.

All other original bodies remain exact, including eight occurrence counterweights (consumed q, independent replacement, slot cancellation/disposal, bounded nonzero finalization, two reverse ingress cases, hidden support/reappearance, fresh lifetime) and five recipient-window counterweights (two equal unknown, two native input/uncertainty, finalizer-abort atomicity). No whole-file deletion or skip/xfail. All12 positive cases remain parameterized as before; only the reviewed capture and after-await assertions were added.

The three active files keep their original packages/kernel/src/lib/*.spec.ts locations. Kernel discovery/project/runner configuration is unchanged from C19; the existing **/*.spec.ts inclusion therefore includes them. Archived .spec.ts.txt files are outside candidate and not ordinary specs. This is static source/discovery verification, not a test-list run or25/25 execution claim. Original archives retain their original package-relative import context for disposable-copy replay.

## Artifacts and limits

Read-only verification command:

```
python3 /private/tmp/st-parent-freshness-implementation-independent/c20-recipient-corrections-review/audit.py > /private/tmp/st-parent-freshness-implementation-independent/c20-recipient-corrections-review/audit.log
```

IDENTITY.json records all three before/after hashes; original full bodies, active files, assembler source, DISCOVERY-CHANGES.json and manifest are copied here. POSITIVE-CORRECTIONS.diff compares against the exact earlier positive proposal. The diff command's exit1 means differences found, not a verification failure.

No test/typecheck/build or broad suite executed; no interference with Main's running targeted replay. No assertion that the archived original twelve passed. This recommendation covers only the reviewed corrections and discovery disposition, not new source/recipient policy, general terminal behavior or release acceptance. Prior exclusions for unrelated native uncertainty/readiness/ingress/safety tests stand.
