# Composition/context/non-interference evidence

Scope: test-only native public API fixtures, 19 workloads × nine actual combinations = 171 cases. This is not a whole-law, release, or architecture-conformance verdict. No production/prototype changes, mutation runs, commits, network or registry writes. Retention, canonical authority and mutation coverage remain separate open obligations.

## Frozen expectations and implementation

`FROZEN.json` precedes first execution and hashes the original oracle, neutral job interface and unchanged LAWS/MATRIX/MUTATIONS/PREDICTIONS. `FROZEN-v2.json` and `FROZEN-v3.json` preserve correction chronology below. The runner enforces v3. Predictions/laws were never rewritten. Baseline source is immutable `7ade0e3ecb25ff0d06da4355b5f7d67844e147b7`; the same test and adapter source runs both candidates. All bundled input hashes and end-of-run change checks are in the JSON reports. Both selected reports have `changedInputs: []` and exit 1, intentionally: unsupported and violated never become success.

The test-only jobs are `group(direct|batch|coalesce, callback)`, `external(callback)`, `undoable(callback)`, `undo(): void`, `outbound(x|y, receiver)`, and `readEntityState()`. They call actual public `batch`, `coalesce`, `external`, `undoable`, `undo`, callable fields and `link`. `isCompositionRefusal` recognizes only the exact native transaction/coalesce error; unknown exceptions remain errors. The existing fixture supplies native transaction handles, actual pending-ID membership, and actual owner invalidation. Observer registration targets the real tree; snapshots are read only inside real callbacks. No synthetic canonical state, policy, read-dependency tracking, turn algorithm, or terminal classification exists in the adapter.

Separate typed scalar and entity constructors avoid optional marker unions. Entity combinations operate on the held facade's x/y/z fields; occupied-key refusal uses another actual entity lifetime. Native runtime lookup receives the actual inferred tree. No `any`, type casts, widened libs, or fabricated production APIs.

Every Link-labelled combination constructs real x/y Links, including context workloads. Cases needing event evidence install additional real observed endpoints. Constructor errors remain errors even when the case would otherwise require an unavailable capability. Batching/restoration are genuinely absent when not listed; missing capabilities never fall back to direct execution. `external()` is a public classification scope, not an enhancer; C4/C7 therefore have the same installed enhancer tuple but independently execute the frozen scope workloads.

## Workload boundaries

- CCTX1 direct/batch/coalesce external-history: undo reaches an earlier authored y=5 while preserving external x=2. Requires restoration. Separate pending-canonical cases first assert actual pending authority, then explicitly stop unsupported at the missing canonical reader. They do not silently omit the canonical/overlay relation.
- CCTX2 direct/batch/coalesce transaction: deferred x=1/y=2 belong to the transaction; rejection restores both, releases its pending ID. A separate coalesced later constant x=2 must survive acceptance of older x=1.
- CCTX3 direct/batch/coalesce restoration: undo restores x=7/y=0 and real owner callbacks cannot expose a partial state. A void undo return is not a success oracle; state and callbacks are.
- CCTX4/CCTX5 inner transaction within batch/coalesce: either accepted work can reject while preserving prior outer z=5, or actual native refusal must write/publish zero x/y, preserve z=5, and leave no latent x/y after a later z=6. These are safe-refusal assertions only, not a claim that surgery succeeded. No zero-total-writes assertion incorrectly blames the accepted outer work.
- CCTX4 mixed external+undoable inside coalesce: x=2 is external, y=3 authored; undo must preserve x and restore y. None of the nine frozen combinations contains both batching and restoration, so this workload is unsupported throughout. Full mixed-context execution remains open; the adapter does not sneak extra enhancers into a named combination.
- N01/N03/N05: positive outbound controls, then pending x and up to 100 independent literal y writes. No y expression reads x. The first missing delivery fails the row; later loop iterations are **not** claimed exercised. A 250ms watchdog bounds observation of actual endpoint callbacks; it is not a production latency guarantee.
- N02: actual occupied-entity rejection must preserve all scalar and entity state, pending authority and confirmed count; unrelated literal y=2 must still be delivered. Missing occupied-entity or Link capabilities are explicit.
- N04/N05: pending independent x=1/y=2; accepting y must send y=2 while x stays pending; rejecting x must preserve y and never send rejected x. Failure before the final rejection means that suffix was not exercised.

No dependency-bearing `y(x())` workload or owner-pending policy is invented. These controls only establish the independence explicitly present in their constant workloads.

## Selected comparable native results

Use **baseline-combinations.json** and **current-combinations.json**, not the earlier incomplete-fixture snapshots. The complete exact-ID comparison, including every unsupported/error detail, is **comparison.json**.

| Combination | Baseline | Current |
| --- | --- | --- |
| C1-transactions | 18 unsupported, 1 held | 18 unsupported, 1 held |
| C2-transactions-entityMap | 18 unsupported, 1 held | 18 unsupported, 1 held |
| C3-transactions-link | 16 unsupported, 1 held, 2 violated | 16 unsupported, 1 held, 2 violated |
| C4-transactions-batching | 13 unsupported, 5 held, 1 violated | 13 unsupported, 6 held |
| C5-transactions-restoration | 3 held, 16 unsupported | 3 held, 16 unsupported |
| C6-transactions-entityMap-link | 19 error | 15 unsupported, 1 held, 3 violated |
| C7-transactions-batching-external | 13 unsupported, 5 held, 1 violated | 13 unsupported, 6 held |
| C8-transactions-restoration-link | 3 held, 14 unsupported, 2 violated | 3 held, 14 unsupported, 2 violated |
| C9-transactions-entityMap-link-batching | 19 error | 10 unsupported, 6 held, 3 violated |

Baseline: 19 held, 6 violated, 108 unsupported, 38 errors. Current: 28 held, 10 violated, 133 unsupported, 0 errors. **No held-baseline → violated-current case.** Baseline's 38 constructor failures are the two entity+Link combinations × all 19 cases: actual baseline Link rejects the held entity field as not owned. They are not capability passes or unsupported results.

Exact current reds:

| Case ID | Baseline | Current |
| --- | --- | --- |
| C3-transactions-link/N01-N03-N05/pending-x-constant-y | violated | violated |
| C3-transactions-link/N04-N05/independent-pending-links | violated | violated |
| C6-transactions-entityMap-link/N01-N03-N05/pending-x-constant-y | error | violated |
| C6-transactions-entityMap-link/N02/refused-x-constant-y | error | violated |
| C6-transactions-entityMap-link/N04-N05/independent-pending-links | error | violated |
| C8-transactions-restoration-link/N01-N03-N05/pending-x-constant-y | violated | violated |
| C8-transactions-restoration-link/N04-N05/independent-pending-links | violated | violated |
| C9-transactions-entityMap-link-batching/N01-N03-N05/pending-x-constant-y | error | violated |
| C9-transactions-entityMap-link-batching/N02/refused-x-constant-y | error | violated |
| C9-transactions-entityMap-link-batching/N04-N05/independent-pending-links | error | violated |

All ten current reds observe no independent endpoint delivery within the bounded probe. N01/N03 rows have successful real positive controls and then an empty y delivery array for literal 11 on the first independent turn. N02 and N04/N05 have an empty y delivery array for literal 2. Four are baseline-red → current-red; six are baseline-constructor-error → current-red. This is measured non-interference failure, not evidence of a read dependency or permission to hold all unrelated work. Root-cause attribution beyond the public trace remains open; no production repair was attempted.

Two baseline coalesced inner-transaction cases (C4 and C7) leave x=7/y=8 after a purported rollback. Current refuses that inner unit and passes the explicit zero-refused-write/outer-z controls. That closes the measured refusal-safety branch, not successful-composition conformance.

Current unsupported categories (exact IDs and failure locations in comparison.json):

- restoration not installed: 29
- canonical: 15
- batch/coalesce not installed: 72
- Link not installed: 11
- occupied entity setup absent: 6

These are first missing capabilities at execution; additional requirements later in each case may also be missing. All 133 remain unsupported, never counted held. In particular, 15 canonical cases assert actual pending membership but do not prove the canonical/overlay relation.

## Preserve first failures and corrections

1. Original v1 oracle is `oracle-v1.ts.txt`. Both first executions exited 13 with unsettled top-level await, before emitting per-case JSON; `first-execution-failure.json` preserves this. The test incorrectly awaited intentionally held Link work. No counts are inferred.
2. v2 stopped awaiting intentionally pending Links and bounded required completion. `baseline-first.json`, `current-first.json`, and `current-final.json` preserve these first complete reports. Two further instrumentation errors were found: an invented boolean return from public void `undo()`, and entity observation registered against a wrapper instead of the actual owner. Awaiting `Link.settled()` also conflated delivery with completion of held work. These artifacts remain available but are not product-conformance evidence.
3. `oracle-v2-semantics-composition.ts.txt` and the matching domain copy preserve that exact oracle. v3 removes the invented return assertion, keeps full restored-state/real-callback assertions, and checks actual endpoint delivery. The real owner is passed to the adapter. `baseline-v3.json`/`current-v3.json` preserve this execution.
4. Final fixture completeness correction attaches real Links at construction for every Link-labelled combination rather than only in N workloads. No v3 expectation changed. `baseline-combinations.json`/`current-combinations.json` are the selected comparison. Baseline's native constructor errors are deliberately retained. All earlier outputs remain untouched.

## Validation commands

```sh
node tools/run-semantics-supplemental.mjs baseline docs/audits/2026-09-23-semantics-composition/baseline-combinations.json composition
node tools/run-semantics-supplemental.mjs current docs/audits/2026-09-23-semantics-composition/current-combinations.json composition
NX_DAEMON=false NX_TUI=false pnpm nx test kernel --testFile=semantics-composition-selftest.spec.ts --testFile=semantics-current.spec.ts --testFile=semantics-supplemental-selftest.spec.ts --skip-nx-cache
pnpm exec tsc --noEmit -p tsconfig.typecheck-all.json
node tools/check-spec-types.mjs
pnpm exec eslint packages/kernel/src/enhancers/transactions/semantics-current-adapter.ts packages/kernel/src/enhancers/transactions/semantics-composition*.ts packages/kernel/src/enhancers/transactions/semantics-supplemental.ts tools/run-semantics-supplemental.mjs
git diff --check
```

Validation at the stable checkpoint: **23/23 focused tests passed (three files); source tsc, spec-type gate, focused ESLint and diff check all exit 0.** The spec gate reports two unrelated files improved; no baseline update was performed. Selected baseline/current harness hashes are identical; all selected current input hashes still match at checkpoint.

Output paths are immutable; choose new names for reruns. Focused selftests test missing-capability handling, constructor error handling, actual zero-write refusal and in-memory immediate/latent refused-write counterexamples. They do not mutate production source or claim mutation-law coverage.

## Structural comparison carried forward

The requested preserved 48-red structural snapshot is compared separately in `../2026-09-23-semantics-structural/baseline-current-comparison.json`. All 48 were baseline violations; no lost-green ID exists. T06a rekey plus later field is shipped behavior and requires successful rejection, with all eight key variants held in both snapshots. A baseline red does not justify blanket conservative refusal.

Structural exact red set: `T09/rekey/12/{key}` and `T10/reject/{123,132,213,231,312}/{key}`, with key suffixes `"A"`, `"a.b"`, `"a/b"`, `"a::b"`, `"jo.doe@example.com"`, `"1.2.3"`, `1`, `"1"` (48 IDs total, individually listed in the JSON). T10 current native failures are effect-validation-failed/structural-drift. For order312 the baseline instead records later-confirmed-dependency on compensation, so that is a changed cause within red→red, not regression from held. T09's original trace did not record the native error: only required settled versus actual refused is established; no more specific cause is inferred. Since there is no lost green, there is no lost-green minimal repro to report.

All 24 structural unsupported IDs are bounded: T13 × eight keys lacks canonical/pending state; T14 accept/reject × eight keys lacks native terminal disposition (and per-contribution disposition remains unimplemented). Prior partial state/identity/pending/publication assertions are retained but do not make these whole laws pass. Original thirteen-case evidence remains untouched.

## Final reachability checkpoint

A real static import in `semantics-supplemental-selftest.spec.ts` now exercises the native occupied-conflict fixture: refusal preserves whole state, confirmed count and this handle’s pending authority; removing the blocker permits retry, releases pending authority and actually publishes. No dummy importer, gate exemption or baseline change. `node tools/find-dead-exports.mjs --max=0` passes. The three-file focused command above now passes **24/24 tests**. Frozen oracle and every selected baseline/current bundled input hash were rechecked unchanged. Prior 23-test checkpoint remains in validation.json; no known-red expectation was weakened. Publisher owns the separate verify-gates artifact-seal work; no semantics-runner overlap.
