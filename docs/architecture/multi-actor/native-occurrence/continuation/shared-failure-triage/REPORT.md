# Shared-failure triage — read-only sidecar

The 107 failures are inherited **from experimental predecessor 057c**, not established as inherited from retained production. Do not waive them on that basis. The highest-priority public risks are entity Link construction/settlement, structural-drift atomicity, ordinary-versus-inspection publication, collection omission/re-add payloads, and cross-tree publication liveness. Main owns the separate four newly regressed hidden-source cases; those are excluded here.

No tests were run and no source, fixture, existing evidence, budgets, or assertions were changed. This report recommends eight focused production comparisons, not another broad suite.

## Evidence and identity

- Predecessor manifest: `057c6b8f4933eca5dbb3c0c31c069612264998b66e71c9e49ddd1a933edddad3`.
- Successor manifest: `c47b821c5a805f5b37d6c0f5707098d9871fdf2575d22dcc3e12f4a4c93c81db`.
- Source read: `/private/tmp/st-native-broad-differential/successor/candidate`; both raw messages retained in `TRIAGE-107.json` (identity includes duplicate ordinal).
- Retained production Git object resolved read-only: `87f6831fa60cafe87508f0ace84b7638698ca3b0`. No production runtime execution was done here.
- `PRODUCTION-FIXTURE-INVENTORY.json` records per-file hashes from `git show 87f6831f:<path>` and the successor. Of the 107 failed assertions, 47 have byte-identical production fixtures, 59 are in files absent from production, and one is in a changed benchmark fixture. Fixture absence does **not** make a public-use assertion experimental.
- Input evidence hashes: `INPUT-SHA256.json`. Full commands/results remain under `/private/tmp/st-native-broad-differential/{predecessor,successor}/{kernel,angular,react,vue,solid}`. They used pinned Node 24.15.0, pnpm 10.17.0, Nx 23.1.0 and Vitest 4.1.9, with unique JSON paths and maxWorkers=2. See the original `IDENTITIES.json` for the remaining dependency versions.

Read-only commands used: `git rev-parse 87f6831f`; `git show 87f6831f:<each failing fixture path>`; Python JSON grouping/hash comparison; `rg` and source excerpts. `build-report.py` preserves the family assignment and proposed-command construction. This is source triage, not independent runtime qualification.

## Complete family partition

| Family | Count | Interpretation and next action |
|---|---:|---|
| Native occurrence enrollment | 52 | Concrete runtime exception before downstream assertions. Includes ordinary public field/row Link use, special-property controls, all eight facade native-address cases, and experimental declaration/lifetime controls. Attribute one unchanged bare field control against 87f first; do not independently “fix” all 52 tests. |
| Timeout results | 9 | Seven row-Link/new-descendant settlement cases near 5 seconds; two large workload cases far beyond the timeout. Timeout mechanism identified below; underlying runtime progress versus workload cost remains unresolved. Not dependency/setup errors. |
| Structural refusal absent | 2 | `opaque-leaf-restoration` public `external()` rekey and atomic sibling case is the primary safety blocker; `p0c-divergence` uses private realization context. Both fail because undo does not throw. Later state assertions were not reached, so do not claim observed corruption. |
| Refusal reason mismatch | 3 | `designated-collection-omission` already passes typed rollback-error assertion, then fails `/later-confirmed-dependency/`. Fixture mutates retained rows through a private producer. Confirm/preserved-state assertions after that line did not execute. Lower priority than actual public refusal absence; do not weaken the regex without inspecting semantic cause. |
| Ordinary membership/order payload | 10 | Two structural inspection/order controls, two branch omission controls, five collection reappearance payload controls, one path-notifier membership control. Concrete payload differences; same semantic neighborhood but not proven one cause. Compare unchanged public branch and collection representatives. |
| Experimental input/enrollment | 12 | Six aggregate controls and six enrollment-invariance variants use private `.declare`. Unexpected publication/contradiction is meaningful to the experiment, but cannot run unchanged on production lacking that capability. Keep under native mechanism review, not production compatibility gates. |
| Logical work accounting | 9 | One unexpected owner allocation; one point-update work threshold; six prepared-placement bounds; one scalar counter vector. Deterministic counters, not environment timing. Details below prevent overclaiming asymptotics. |
| Equal row admission | 1 | `entity-egress-footprint`: inspection row replacement/identity updater unexpectedly sends. Public write/Link behavior with private inspection setup. Preserve oracle; group with ordinary-support attribution, not timeout failures. |
| Private membership event | 1 | `prependOne` reports `add` versus expected `add,reorder` to private membership reader. Public physical ordering is not shown wrong by this assertion. Requires event-contract interpretation, not a new public law. |
| Missing ID | 1 | Public dev guard expects warning; new ordinary admission throws `Ordinary entity admission lacks a key`. Invalid-input behavior changed; compare exact production test. Lower priority than valid-input data/liveness blockers. |
| Experimental retention/restoration | 3 | Two negative-publication obligation cases and original native-certificate restored-collection case. Private declarations/source diagnostics. No production run unchanged; preserve original restoration failure and coordinate with native work. |
| Rich committed capture ordering | 1 | Private capture seam observes right 50/60 instead of 11/12 during mixed undo. Both exact focused predecessor/successor replays already fail identically. Real internal completion-order obligation; no need to repeat those runs. Production lacks this fixture; compare only if Main separately scopes a test-only transplant and confirms seam equivalence. |
| Cross-tree liveness | 2 | Public Link while a foreign tree transaction remains open: local value absent/no send. Two unchanged fixtures pin the same scenario. One representative production comparison is sufficient initially. |
| Public handle shape | 1 | Exact three-member Link handle assertion sees extra enumerable `declare`. Source directly explains it. This is intentional experimental surface in scratch, **not** production-compatible acceptance. Resolve activation/export boundary centrally; no speculative production rerun needed. |
| **Total** | **107** | Every failed identity is assigned once in `TRIAGE-107.json`. |

## Concrete source findings and limits

**Enrollment is a kernel failure reached through all four facades, not four framework setup failures.** `link.ts:555` calls `research.bindSource`; `experimental-publication/private.ts:351` enrolls a recipient; `recipient-occurrence.ts:33` calls `captureNativeOccurrence`. `internals/native-occurrence.ts:27–31` chooses the entity collection anchor, then requires its registry/root/address and throws the exact shared error when missing. The collection anchor is held by `internals/entity-publication.ts:142–153`; addresses are stamped in `internals/materialize-markers.ts:983`, roots registered in `signal-tree.ts:1918`. Saved evidence does not distinguish which of registry/root/address is missing in each case. The error masks later lifetime, own-property and retention assertions; those downstream properties are **unqualified**, not separately demonstrated defective. Eight facade native-address tests exercise ordinary APIs; four declared-publication facade tests require the private declaration capability.

**The nine marker failures are actual timeout-path evidence, not missing imports.** Installed Vitest `@vitest/runner/dist/chunk-artifact.js:1784` captures `STACK_TRACE_ERROR` at test registration; `withTimeout:2261` passes it to `makeTimeoutError:2404`, which replaces the timeout error stack with this registration stack. JSON therefore loses the descriptive timeout message in these failureMessages. Seven async Link cases took about 5001–5007ms on both sources and await settlement. The repeated collection-read case took about 24/29 seconds; the 130k-row restoration case about 211/288 seconds. These numbers only identify timeout circumstances, not performance measurements. Synchronous overrun is checked after body completion by the runner. Do not label the large cases event-loop deadlocks, or the seven settlement cases harmless machine load. A single verbose row-settlement production comparison is the cheapest discriminator after enrollment attribution. No missing module, environment initialization, or framework harness error is demonstrated among these 107.

**Structural safety is not an error-wording issue.** `opaque-leaf-restoration.spec.ts:234–259` records atomic bounds plus rekey, applies public `external()` rekey to another key, and expects undo refusal before changing bounds/history. It fails at `toThrow`. `p0c-divergence.spec.ts:68–93` has analogous private realization setup. Conversely `designated-collection-omission.spec.ts:526–550` has already caught the expected typed error before failing reason text. Keep those categories separate.

**Work failures need precise interpretation.** `entity-granular-reactivity.spec.ts:184–229` first passes equal work at 2k/20k rows, then fails the fixed bound: 14400 visits versus <2000. That demonstrates excessive constant work in this workload, not a collection-size slope. `prepared-placement-index.spec.ts:35` observes 3N versus an allowed 2N at 32/128/512: still linear, not quadratic evidence. `audit-entity-projection` sees one eager allocation instead of zero. The changed scalar benchmark at line1133 expects one slot read but observes zero; a stricter internal vector mismatch is not, by itself, a cost regression. Retain all checks without relaxing them; production attribution of the unchanged point-work control is useful, broad benchmarks are not.

**Missing-ID and shape causes are source-explicit.** `entity-signal.ts:1020–1021` rejects an undefined ordinary binding key; the unchanged missing-ID fixture deliberately tests warning-only behavior. `link.ts:1150–1156` constructs a return object with enumerable `declare`, explaining the exact-three-members failure at tree-error-public-contract.spec.ts:238. The latter is an unreleased experiment boundary, not evidence that production already changed public API.

## Minimal retained-production comparison queue

`PROPOSED-87F-COMMANDS.json` contains exact argv, full test-name regex, fixture SHA-256, priority and future cwd requirement for eight comparisons. **None was executed.** Use a fresh verified disposable archive of the full 87f commit with the pinned dependency/tool environment, unique log/observation directory, and `--reporter=verbose --maxWorkers=1`. Do not run against or alter preserved production. Each selected fixture is byte-identical at 87f, so no transplant or oracle edit is needed.

1. **P1:** audit-entity-boundaries — bare field ignores another row, collection, and tree. Valid public Link; discriminates production baseline versus introduced native enrollment. One kernel representative before duplicating all facade cases.
2. **P1:** opaque-leaf-restoration — structural drift before reversing atomic leaf sibling. Valid public safety/atomicity contract; strongest current public blocker independent of Link.
3. **P1:** branch-omission-correctness — unchanged inspection-only sibling must not reach Link. Separates physical/ordinary contamination from lookup exceptions.
4. **P1:** link-absent-locations — bare collection omission/re-add. Separates source payload shape/restoration from branch masking; observed object `{all:[]}` versus expected row array.
5. **P1:** link-commit-boundary-carrier — foreign transaction must not absorb/delay this tree. Covers both shared cross-tree liveness failures initially.
6. **P2:** entity-missing-id-guard — warning versus admission throw. Small, exact invalid-input compatibility control.
7. **P2:** audit-entity-boundaries — row/field ownership, enhanced=false. Verbose timeout attribution; do not increase timeout or remove `settled()` to manufacture acceptance.
8. **P2:** entity-granular-reactivity — single-entity update logical work. Exact counted-work check, not a timing benchmark.

Stop expanding a family once its attribution is decisive; do not treat one family representative as acceptance of every member. A production pass makes the shared experimental failure an introduced regression relative to 87f. A production failure establishes only that specific retained failure. Private declaration cases should not be made runnable on production by adding a shim. New fixes, API dispositions, and any subsequent control promotion remain Main's responsibility.

## Exclusions and handback

The original ten pending large-batch assertions are **not** part of these 107 failed identities and remain unexecuted. The five `.fails` cases reported passed are also excluded; they are expected-failure successes. Duplicate identities remain ordinal-preserved. No results or source manifests were replaced. Sidecar artifacts are limited to this directory; the main differential and frozen sources remain untouched.
