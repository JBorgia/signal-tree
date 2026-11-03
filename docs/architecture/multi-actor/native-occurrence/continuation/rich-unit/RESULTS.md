# Frozen failed experiment

Candidate: `/private/tmp/st-rich-unit-successor/candidate`, copied from frozen combined B. No edits to predecessors, Main's lazy-owner helper, or scalar-worker source. Runtime editing stopped at first covered recurrence; subsequent work was verification and a diagnostic in a separate copy.

Source manifest SHA-256: `55ba1e3bb29ac66f1a493e196cee9b68853fa8ad30ac7067a7ea8e280bf871f5`.
Runtime patch SHA-256: `22a4c7349fb65d1ba348058eb557516480b584394708724581385f6ac969df4d`.
Test patch SHA-256: `c3a383d7257e63bc5cd023b8559d9831c1087222ae9c8b305ac87028a45f947c`.

## Implementation boundary

Private witness registrations are separate from arbitrary rich observation. Transactions/restoration retain synchronous witness folds and existing responsibility filters. Source structural preparation creates an ordered same-source proposal, then exposes install and completion separately. No public API, global authority overlay, persistent root, or lazy capture-owner gate was added. Seven runtime files changed; exact inventory in CHANGED.json and source.patch.

## Results

Commands, pinned environment, exits and first logs are in `runs/<name>/COMMAND.json`, `RESULT.json`, and `first.log`.

| Gate | Result |
| --- | --- |
| Before runtime: three original falsifiers and two negative controls | 2 passed, 3 failed |
| First runtime: those five plus same-source restore and two public handoffs | 6 passed, 2 failed |
| Unchanged required controls/adapter/restoration/transaction selection | 111 passed, 11 failed (122 tests, 7 files) |
| Final runtime source types | exit 0 |
| Spec types | exit 2; 202 diagnostics, exactly equal after candidate-root normalization to retained structural-completeness spec log |

The first runtime still fails original rich observation and source completion assertions. Preparation refusal, both negative controls, same-source two-restore control and both public handoffs pass. These passes do not qualify the candidate.

## First recurrence and concrete cause

Separate test-only `diagnostic/candidate` preserves frozen runtime. `diagnostic/read-boundary.jsonl` shows that during rich completion, direct row reads are 11 and 12 and the leaf is 11, while collection `all()` is still cached as 50 and 60. The callback's nested 777 write survives afterward (final 777/12). Original assertion remains failing.

Adapter `invalidate` calls structural-unit `complete` before structural and live-point invalidation. Completion invokes rich observation/source completion against a stale derived collection. Complete storage installation alone does not satisfy the shared readable-unit boundary. The next mechanism must make all participating read models coherent before reentrant completion/observation while preserving synchronous authority folds. This report does not authorize or apply that repair.

## Other unchanged-gate failures

Ten tests fail at the new `Prepared structural subject missing` check: paired rekey inspection controls (2), ordered remove/rekey completeness (1), transaction pending-rekey preservation (1), heterogeneous draft abort (1), and adapter rekey/coherence/causal-silence/stale-unit/shared-revision controls (5). See first.log for full identities and downstream assertions.

Source cause: adapter lines 1431–1469 permits a live rekey through `__planRekey` without a preparedContext entry. `rememberRekeyedSubject` returns when no entry exists (223–230). New grouping at 1569 requires that entry unconditionally. Thus the new grouping loses the existing live-source planner path. A future source-owned grouped recipe must preserve the subject/value and ordered occupancy resolved at the original preparation boundary, rather than demand an absent late context entry. The stale-unit test is blocked by this earlier failure; its safety result is not established.

The eleventh test, “keeps restore planning side-effect free when later scalar frame preparation fails,” injects a failure in the old private `__planRestore().commit` hook. The new route prepares that old plan but no longer calls its commit, so the injected error does not occur. This is a changed private fault-injection seam, not evidence that refusal atomicity passed. Original unchanged failure is preserved; an equivalent injection at the actual new boundary would be required before qualification.

## Limits and handback

Same-source structural proposals share one ordered placement simulation, but this does not prove every fresh-restore dependency or collision with separate live-point Map replacement. Scalar integration is not complete. No broad gates, timing, heap, cleanup or activation claims. Candidate and predecessor manifest entries were reverified unchanged in VERIFICATION.json. See SCALAR-HANDOFF.md for the bounded interface handoff; frozen runtime must not be patched in place.
