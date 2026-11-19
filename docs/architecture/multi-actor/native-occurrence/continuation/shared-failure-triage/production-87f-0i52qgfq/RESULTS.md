# Eight focused retained-production comparisons — complete

All eight selected assertions pass on exact retained production **87f6831fa60cafe87508f0ace84b7638698ca3b0**. Each fails on both frozen experimental sources 057c and c47b. These eight are introduced regressions relative to production; “inherited from 057c” must not be interpreted as “inherited from production.” No claim is made for untested members of a family.

| # | Exact selected control | Production | 057c / c47b failure | Classification |
|---|---|---|---|---|
| 1 | Bare field Link ignores unrelated row/collection/tree | Pass | Native occurrence has no verified root/address | Public Link enrollment regression; exception occurs in experimental recipient enrollment before the ownership assertions. |
| 2 | Structural drift refuses before reversing atomic leaf sibling | Pass | Expected undo to throw; it did not | Public refusal/atomicity-contract regression. Experimental later state assertions were not reached; no additional corruption claim. |
| 3 | Omission does not publish unchanged inspection-only sibling | Pass | Inspected instead of Ada | Ordinary/inspection payload-separation regression. |
| 4 | Bare collection omission and re-adds | Pass | `{all:[]}` instead of expected row array | Collection reappearance publication payload regression. |
| 5 | Foreign transaction neither absorbs nor delays local write | Pass | Missing local MINE value | Cross-tree publication liveness/isolation regression. |
| 6 | Missing ID warns in dev mode | Pass | Ordinary entity admission lacks a key | Invalid-input warning behavior changed to an admission throw. |
| 7 | Bare row and field Links retain ownership | Pass | Timeout-path STACK_TRACE_ERROR | Experimental settlement regression in this exact case, not an unavoidable timeout in the pinned test environment. Precise stalled obligation remains untraced. |
| 8 | Single-entity update does not rebuild collection | Pass | 14400 logical visits fails <2000 bound | Counted-work contract regression. Experimental size-invariance assertion passes; this is not evidence of a collection-size slope or a timing benchmark. |

## Exact identity and preservation

- Disposable archive: `/private/tmp/st-native-shared-failure-triage/production-87f-0i52qgfq/candidate`.
- Source manifest SHA-256: `da9bb5e49f78eb94c53d936728108334b935a222423ea45c846c5367368ae9d3` (2517 archived files).
- Git archive SHA-256: `f68758a1fda1ccb3198098f97d1f0c4b254ce2def039c602d291b2deb72595ad`.
- `SOURCE-UNCHANGED.json` verifies every archived file after all runs. All eight fixture hashes match both production Git blobs and the frozen experimental fixtures. No source or assertion edits, no timeout increases, no broad runs.
- Node 24.15.0 / pnpm 10.17.0; Nx 23.1.0 / Vitest 4.1.9 / TypeScript 6.0.3. The same shared dependency installation as the broad differential was linked; `IDENTITY.json` records the resolved versions. No install or dependency update was performed.

## Commands and results

Eight commands ran **sequentially**, each through `corepack pnpm nx test kernel --skip-nx-cache <exact fixture> --testNamePattern=<exact full-name regex> --reporter=verbose --maxWorkers=1`. No test/hook timeout option was supplied. `NX_DAEMON=false` and `NX_ISOLATE_PLUGINS=false`; observation outputs were unique per command and timing-report variables unset. Regex literals were normalized to escape regex syntax without unnecessary whitespace escapes; the selected identity was unchanged.

Directories `01` through `08` each contain `COMMAND.json`, `first.log`, and `RESULT.json`. All exits are 0, each log has exactly one passed assertion; other tests in the file were filtered out, not newly declared skips. `RESULTS.json` preserves each exit and runner summary. `COMPARISON.json` joins each passed production assertion to the exact predecessor/successor identity and raw failure messages, with log hashes. No favorable result was substituted for a prior failure.

## Source-grounded interpretation and limits

The source chains documented in the sibling `REPORT.md` now have exact production attribution for these representatives: experimental Link calls native recipient enrollment (`link.ts:555` → `private.ts:351` → `native-occurrence.ts:31`), missing-ID ordinary binding rejects undefined keys (`entity-signal.ts:1021`), and the remaining selected tests pin public outcomes independent of declaration APIs. This comparison does not identify a single causal patch for structural refusal, payload ordering, cross-tree liveness or settlement; Main should use the preserved counterexamples for bounded causal work. No fix is proposed or applied here.

The other 99 shared failed identities remain classified but not production-replayed by this exercise. The separate four c47b-versus-057c hidden-source regressions, ten unexecuted broad assertions, five expected-failure passes, and public scratch `declare` surface remain distinct. Main owns repair, review and final disposition.
