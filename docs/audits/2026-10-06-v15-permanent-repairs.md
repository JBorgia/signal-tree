# v15.4.4 permanent repairs

Implementation baseline: `8e5be3dd02c2398e1c68542883b4e3ea68d2c595`.
Owner authorization: October 6, choose the audit's recommended long-term repairs.
This is implementation evidence, not a release qualification or timing report.
The isolated integration branch is `fix/v15-permanent-repairs`.

## Contracts preserved

Stable v15 rollback refusal, automatic-abort outcomes, structured identity,
framework-native ownership, and grouped coherent publication remain binding.
The concrete counterexample reopening the held-projection limitation was a
warmed `all()`/`count()` returning pre-transaction values after `addOne()` while
`byId()` already returned the new row. Reads must follow current truth;
notification delivery can remain grouped. The old tap-only workaround and its
explicit stale-held-cell test are superseded by that requirement, not silently
removed. Native framework realizations must prove the same behavior.

The owner explicitly chose fresh SignalTree-provided readers while preserving
native computed/effect timing. A warmed external framework computed need not
refresh inside the callback; a held SignalTree projection must. This does not
authorize early synchronous observer delivery or replacing native framework
carriers with a second reactive engine.

## Mechanisms and evidence

| Area | Root cause | Repair and boundary |
| --- | --- | --- |
| Membership reads/writes | Ancestor descriptor walk on every access after an omission | Cache descriptor-derived absence under a tree-owned revision; invalidate on both presence transitions. Descriptors remain authority. Unowned internal nodes keep direct lookup. |
| Partial capture | Whole branch scanned although only supplied keys can reappear | Visit supplied keys for partial writes; whole-value omission still examines all members. |
| Observer demand | Any process-wide observer enables capture in every tree | Explicit internal owner scope for capture demand; unscoped consumers remain global. Notification delivery semantics remain unchanged. |
| History rows | For every ordered subject, linearly search all subjects | Per-materialization lookup; no persistent snapshot cache or new history retention. |
| History locations | Search unrelated branches to rediscover a retained member | Validate and follow the registry's structured address, including dormant descriptors and literal-dot keys. |
| Leaf address retention | Leaf address seeds retained without a reader | Remove only leaf WeakMap seeds; preserve branch seeds and registered position addresses. |
| Instrumentation removal | Delete the entire expression statement, changing unbraced control flow | Replace bound instrumentation calls with empty statements; use lexical import identity and execute transformed fixtures. |

The instrumentation counterexample changed the program result from 7 to 0.
The original transform failed 23/33 initial cases. The repaired transform passed
37/37 cases, including aliases and shadows. `production-stats-transform` now
runs these fixtures in the gate registry; deleting the empty statement is killed
by its own mutation proof. This does not assert that a published runtime already
contained the dangerous syntactic shape.

Membership work tests first failed 3/4; the corrected implementation passed 4/4.
A further structured-history test counted 718 enumerated property names before
repair and zero afterward, while asserting the restored snapshot. Four
membership/omission suites then passed 162/162. These are deterministic work
counts, not application speedup percentages.

History assembly tests exposed 36/136/528 indexed subject reads for 8/16/32 rows;
the bound after repair is one indexed read per row for each output assembly.
The same tests assert returned history, live state, and undo/redo behavior.

## Validation commands and remaining qualification

Use the checkout's Node and pnpm versions. Focused commands run through Nx:

```sh
pnpm nx test kernel --testFile=membership-work-boundaries.spec.ts --maxWorkers=1
pnpm nx test kernel --testFile=history-materialization-work.spec.ts --maxWorkers=1
pnpm nx test kernel --testFile=projection-transaction-current.spec.ts --maxWorkers=1
pnpm nx test kernel --testFile=path-observation-demand.spec.ts --maxWorkers=1
pnpm nx test kernel --testFile=leaf-address-seeds.spec.ts --maxWorkers=1
node tools/verify-gates.mjs --only=production-stats-transform --self-test
```

First reds, follow-up results, commands and probe sources are preserved under
`/private/tmp/st-permanent-repairs/`. This record must be updated with the final
integrated results before a release candidate is frozen. Full kernel/framework
suites, types/spec types, independent review, fresh build/size/demo/docs checks,
artifact consumers, exact candidate gates/proofs and Linux verification remain
required. Budget changes are not authorized by this implementation decision.

Do not transfer earlier exploratory performance ratios to this candidate.
Comparisons need identified artifacts, valid workload outputs, teardown of each
tree, independent process control and measured variation. Authored effect
ordering remains correctness state; do not remove it to improve a microbenchmark.

## Integrated progress and limits

The six focused repair suites passed 62/62 after the final scoped-disposal
corrections. The new unrelated-tree work test initially required zero property
enumeration for a whole-value write and failed with 202. That assertion also
forbade necessary omission reconciliation. It now compares the exact same
whole-write workload with and without a foreign observer, and positively checks
the foreign tree's history and undo. The first failure remains in
`membership/scoped-final.log`; the corrected selection is `integrated-focused.log`.

A source-bundled diagnostic on October 6 counted metadata operations for 1, 10,
100 and 1,000 sequential two-field transactions, each confirmed, without retained
history. Every tree was destroyed and final field values were asserted. Counts
were exactly 16 effect-stamp writes and 14 effect-metadata reads per turn. This
is linear local work, not evidence of a runtime percentage or a reason to remove
ordering. The temporary probe wraps WeakMap methods only in its isolated process.

Generator: `/private/tmp/st-permanent-repairs/transaction-work.mjs`
(SHA-256 `9576abcf6690cf672dc64217b610913ca554231ba343e753bf02efe1502f5f51`).
Bundle: `transaction-work-bundled.mjs` beside it
(SHA-256 `5a04bca18870da9c2fa340cada103b62ef6c375ad62c25bcb5c2a3c8d400b536`).
Command: `pnpm exec esbuild <generator> --bundle --platform=node --format=esm
--outfile=<bundle>`, then Node 24.15.0 executes the bundle; output is
`transaction-work.jsonl`. This measures the dirty implementation checkout, not a
released package. Full performance qualification still requires fresh artifacts.

Independent review found cross-runtime derived dependencies can observe a
second tree's publication while the first tree has an open group, both before
and after the neutral repair. Grouping does not promise cross-tree atomicity.
Unrelated second-tree writes leave first-tree-only subscribers deferred.


The first full kernel run passed 427 files: 7,801 tests passed, seven expected
failures, thirteen skips and one todo (7,822 total), exit 0. This preceded the
final Link demand and native-framework changes, so it is a checkpoint rather
than exact-candidate qualification. Command: `pnpm nx test kernel --maxWorkers=2`;
log: `kernel-full-first.log` in the evidence directory.

A subsequent Link demand regression failed both before the owner-scoped
subscription and after scoping only that subscription: Link also has a permanent
flush listener. Both permanent registrations belong to the relationship's tree.
Their owner scope affects capture demand only; flush delivery remains global.
The temporary `settled()` flush listener remains unscoped because its wait spans
reactive hops through other trees. First runs: `link-demand-red.log` and
`link-demand-green.log` (the latter name was chosen before execution; it is red).


Independent build review also found the existing stub resolver matched unrelated
modules ending in `/production-substrate-stats`. Two new resolver controls failed
before repair (`build/resolver-red.tap`); exact resolved-module matching then
passed all 40 transform/resolver cases (`build/resolver-green.tap`). The original
statement-deletion mutation is still killed, 1/1 proof, no blind/unproven/errors
(`build/resolver-gate-proof.log`). Current instrumentation arguments are literals
or internal lengths; this stripping contract does not support application side
effects in instrumentation arguments.

The native held-reader probes passed in Angular, Vue and Solid (four cases each)
under the approved boundary. Removing the tap-only fallback then exposed five
absent-collection reversal failures in existing neutral tests. Those assertions
remain unchanged while the generalized mechanism is repaired; the earlier
focused passes are not final native/composition qualification.


The same transaction diagnostic now measures 10 stamp writes and eight metadata
reads per two-field confirmed turn, consistently at 1/10/100/1,000 turns. Three
copy passes were removed: the discarded post-registration materialization and
the two listener payload constructions when no listener exists. Ordering stamps
and the authority/capture/lifecycle isolation copies remain. Fresh diagnostic
bundle SHA-256: `e12b6a1a73d8db0f4b4b6b99842ac3eb2e8dc785ba14f8528a617460ff3cf630`.
`transaction-work-after-evidence.txt` records exact generation/execution and the
initial incorrect invocation. This is reduced copying, not a timing claim.

Production typecheck passed. Separate spec-type checking first found seven new
errors where history assertions read `.all` through the builder-shaped declared
state type. Structural output assertions now require the same row arrays without
casts or public type weakening. The corrected run passed its existing ratchet
(222 known errors across 36 files, no increases); it is not a zero-error claim.
Link owner demand and the corrected ten history tests passed in the combined
`projection/tap-trace-and-main.log` run, whose five tap failures remain recorded
separately. Independent membership/demand source review demonstrated no blocker;
see `membership-review.txt` for reviewed hashes and unrun suggestions.


## Published-artifact baseline and benchmark correction

All five 15.4.3 archives were freshly fetched with `npm pack --ignore-scripts`
and their SHA-512 values match the committed 15.4.3 receipt. Archives, package
metadata and verification output are in `published-15.4.3/` under the evidence
directory. This rechecks the published baseline, not the repaired candidate.

A public Angular probe on that exact artifact found callable `leaf(7)` leaves
zero unchanged, while `leaf.set(7)` produces seven. The old
`tools/bench-build-ab-v3.mjs` scalar-set workload used callable writes. Its scalar
figures cannot substantiate Angular write performance. The generator now uses
`.set()`, asserts the expected scalar value outside each timed window, destroys
its owned trees, and supports selecting a bounded workload. No other workload's
validity is established by this correction.

The selected scalar case passed against two copies of the published artifact:
`--workloads scalar-set --pairs 1 --batches 1`, exit 0. This is a protocol smoke
check, not comparative performance evidence; the busy host's A/A spread was
16.7%, and the harness reported NOT RESOLVABLE. A temporary source mutant that
restored callable writes exited 1 specifically at the new value assertion.
Commands/logs: `scalar-benchmark-smoke.log`, `scalar-benchmark-mutant.log`,
`scalar-benchmark-mutant.mjs`, and `published-15.4.3/angular-write-grammar.mjs`.

## October 7 release takeover

The owner assigned this chat the existing v15 release, including inherited
uncommitted work, and authorized publication after qualification. The original
43 changed/untracked files and hashes were preserved in
`/private/tmp/st-v15-release-takeover/inherited-work.tar.gz` and
`inherited-work.json`. The v16 checkout is outside this task.

Independent source review found no demonstrated blocker in the history indexing,
address removal, transaction copy elision or held-reader/native adapter changes.
The kernel build cache inputs now include the Babel parser and traversal packages
used by the new instrumentation transform. The isolated transform fixtures passed
40/40 (`node --test tools/build/strip-production-stats-calls.spec.mjs`, exit 0;
`transform-tests.log`). This is development evidence, not release qualification.

The first focused replay/current-read run passed 152/153 tests. The remaining
assertion expected all-target replay from a fixture that selected sequential
rollback: removing one row does not produce a surviving-row reorder delta, and
its single compensating addition does not select aggregate installation. Held
and direct readers both returned the physically current `[0, 2]`. Preserve that
failure in `focused-native-cache.log`; the corrected fixture reorders surviving
rows in both collections and still requires both held/direct endpoints and ID
orders to be restored before the first tap. The separate sequential test asserts
held/direct agreement, and the omitted-row subscriber test requires positive
coherent delivery. No production semantics were changed to accommodate a test.

The adapter reviewer additionally requested conditional dependency switching
checks. Angular, Vue and Solid fixtures now switch a warmed held derived reader
inside a transaction, retain external native timing, and assert that subsequent
old-side writes cause no computation while new-side writes reach both readers.
Trees and native roots are disposed. Results remain to be recorded below.

The shared node_modules symlink was removed without modifying its target. An
independent `pnpm install --frozen-lockfile` completed with Node 24.15.0 and pnpm
10.17.0; `frozen-install.log` records the result. The checkout's SSH signing
configuration passed signed-tag verification in an isolated throwaway repository.
Version metadata is being prepared as 15.4.4; no publication is implied by it.

The isolated focused run passed all 17 neutral tests and seven Vue tests. New
Angular/Solid conditional fixtures initially imposed a stale external scalar
computed value inside the transaction. Source review confirmed that native scalar
commit timing permits a refresh (the Angular scalar adapter directly commits to
its native signal); the existing collection probe does not generalize to a
scalar freeze. Only that new timing assumption was removed. The fixtures still
read the external computation in the group and assert held freshness, stable
identity, and postcommit dependency/computation behavior. The corrected Angular
six-test and Solid seven-test suites passed, exit 0, through Nx. Logs:
`focused-isolated.log` (first red) and `native-conditional-corrected.log` (green).
The full registry will rerun every package from the committed candidate.

Version claims, release state and the 15.4.4 changelog heading checks passed.
The normal Nx plugin-isolation mode exited cleanly and will be used for complete
qualification. One earlier run reported its results but retained an idle esbuild
service; only that owned runner/service was terminated, with status recorded in
`focused-isolated-process-status.txt`. No interrupted run is release sign-off.

Candidate metadata is 15.4.4. Full gate, mutation, artifact, browser, Linux and
registry results belong in the external evidence directory keyed by the exact
candidate SHA. Do not edit this source record merely to append qualification
results after freezing that candidate.

## First complete candidate and gate repairs

Candidate `851542c56c95fad23e8b26153fad1de904ff493e` completed
`node tools/verify-gates.mjs --release`: 86/91 gates passed. The full kernel
suite passed 7,814 tests, with seven expected failures, thirteen skips and one
todo. Five first failures are preserved in `851542c5-gates-release.log` under
the takeover evidence directory:

- Vue's existing unrelated-carrier assertion counted 200 rather than 100
  evaluations. Tracing found membership capture unwrapped readonly recipes that
  it cannot record or reverse. Capture now uses its existing `isRecordedMember`
  predicate after the unchanged-presence shortcut. No native adapter contract
  changed and the existing assertion remains. A cold-recipe regression first
  failed, then passed with real optional-leaf omission and rollback asserted.
  Full Vue passed 108 tests; four kernel membership/history suites passed 62.
- The token-delivery test's intentional empty observe method needed its purpose
  documented for lint. No warning budget changed.
- The omitted-branch fixture declared its omitted property required. It now
  seeds one branch in an accurately typed record and replaces it with `{}`;
  no casts, new mounting capability or weakened assertion. Three replay tests
  passed, and spec types did not exceed their unchanged per-file baseline.
- The direct restoration benchmark called an internal DirectedTurnApplication
  without its frontier steps. It now derives undo-oriented steps using the
  same `frontierStepOf` as the runtime. The production workload passes its
  unchanged identity/value/history assertions (20 turns, three samples, four
  profiled arms). These results validate the harness, not a speed claim.
- Fresh package gzip sizes exceeded existing ceilings. Exact fixture attribution
  measured bare 10,989/13,138 bytes and entities 25,107/28,040 bytes
  (production/development). No optional enhancer or native-adapter leakage was
  demonstrated. Additional mandatory membership/current-read repairs account
  for the cost. A temporary single-use-wrapper simplification saved only 18/25
  entity bytes; it was not applied as a distracting size-only change.

The owner explicitly approved bare 10.80/12.90 KB and entities 24.60/27.50 KB
ceilings on October 7, then authorized further measured tolerance if necessary
to retain the repairs and publish. This supersedes the earlier no-budget-change
limitation for these release measurements, not correctness checks. Package
fixtures use bytes/1024; see `bundle-attribution.{mjs,json}` for the generator,
artifact hashes and exact options.

Linux Validate run 37680581218 (the same candidate SHA) additionally found the
production demo's initial raw bundle at 595.67 kB, above its 550 kB ceiling.
Routes, bootstrap, application store and dependency lockfile were unchanged from
15.4.3; feature routes remain lazy. The 525/550 kB limits dated to September 5.
Under the owner's tolerance instruction, initial warning/error ceilings are now
600/625 kB. This demo imports library source through TypeScript paths; its raw
Angular size is a separate workload from neutral packaged gzip. No exact
per-module Angular attribution is claimed. Final production build and browser
verification remain required. Evidence: `linux-first-demo.log`.

Before the revised release freeze, all 20 unpaginated review threads and general
review comments on TruckTrax v3 drafts 780, 781 and 782 were checked against
heads bf68c8479e66015c109bff83f27456891bf0ccec,
dea255b0bbfd9bd88079cc79f9ad4ce7e6ff0cfa and
97c77df2d4ca9d7282a57d47d6c67a59171d8142. Independent responsibility review
found no additional SignalTree counterexample. Acquisition/reentry and promise
policies are v3 helper code; form history fails with an ordinary Angular signal;
CRUD result-set ownership, ScaleTrax save/recall/PDF/autofill behavior and
redaction/localization belong to applications. They remain required follow-up
work on those three drafts after the library release, including the general
review request to assess unrelated-change separation. This classification does
not dismiss or resolve the v3 findings.
