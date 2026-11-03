# C28 continuation record

Latest disposition: the private preparation-reader successor `812a3ad5` has
bounded correctness support; memory and complete release qualification remain
open. See [the current controller](../../../../../RELEASE-CURRENT.md) and the
dated continuation entries below. Original rejected experiments remain preserved;
their dispositions do not describe every subsequent successor.

## Original C28 bounded experiment: not accepted

Owner-approved [current-obligation no-write semantics](C28-AUTHORITY.md) remain
in force. The implementation fails the covered fresh-input safety gate and must
not be composed. Retained production and C27 remain unchanged.

## Reproduced failure

A foreign pending transaction q supplies 7 into an equal source field. A NEW
source updater reads that field into a linked target under an independent
declaration. C27 detects the pending dependency, holds publication, and sends
exactly once after q confirms. C28 misses the contradiction and sends 7 before q
confirms. A saved-object contrast is recorded separately; it is not designated a
defect merely because it retains older evidence.

[Independent paired report](c28-cached-input-discriminator/REPORT.md) preserves
source manifests, unchanged public fixture, first logs and observations. Main
independently replayed both variants with matching observations:
[Main result](c28-cached-input-discriminator/MAIN-REPLAY.json).
[Runtime-only replay](c28-current-certificate/STOP-REVIEW.md) removes diagnostic
hooks and reproduces the same premature send.

Runtime-only manifest SHA-256:
`986f7a94c80734070fc51395ca8eee63d808a4fbf949dadc48f5de1e4c48b3b2`.
Working instrumented manifest:
`f367cd3d25ea18715c9192a98ff52c932d73cf4790fe22c71b280bc5c1f25de4`.

## Preserved gains and qualifications

- Approved A/B counterparts fail on unchanged C27 before implementation.
- Initial C28 focused result: 22 passes in seven files, including approved
  counterparts, validation controls and the four independently baseline-proven
  [equal-refresh guards](c28-equal-refresh-review/execution/REPORT.md).
- Corrected diagnostic samples at 0/1/2/4 distinct completed inputs show current
  source, recipient and selected-operation owner counts 1/2/2/2. Both terminal
  confirm/rollback sequences deliver useful exact results. These are finite
  instrumented graph counts, not heap-byte/GC or general retention acceptance.
- First diagnostic graph recursion was a test walker error, preserved with its
  correction. A separate saved-reader assertion had an incorrect identity
  premise and remains red; it is not counted as a successful isolation control.
- Broad suites, new artifacts, performance and release gates did not run after
  the safety failure. Historical costs and budgets are not superseded.

## Remaining private boundary

The [reader mechanism](c28-current-certificate/READER-MECHANISM.md) separates
fresh source acquisition from consumption of saved supplied objects. A new current
NativeView alone is insufficient: nested cached branch objects can still select
old certificates. Ignoring all snapshot certificates would instead lose valid
historical supplied evidence.

Review must establish exact source/value alignment at all three updater entry
points and protect opaque saved objects, inspection divergence, unfinished
validation and retirement. No new public API, callback identity change, sweeping
cleanup or broader owner architecture is selected. This is an implementation
boundary within the approved semantics, not grounds to reverse the approval.

## Reviewed bounded continuation

[Independent adjudication](c28-independent-review/CACHED-INPUT-ADJUDICATION.md)
confirms the public failure and supports a private current-container versus
opaque-payload acquisition distinction. Main selected a separate C28-R1 prototype
within the approved implementation/qualification scope. No new owner/API policy
is required for preserving pending input evidence.

The prototype must collect current container membership/field evidence, while
opaque native leaves conjunctively retain their current own obligations and any
issued payload certificate. Snapshot registration, callback payload identity,
entity dispatch and negative membership evidence remain unchanged. The original
public failure and separate r/s opaque-payload controls precede runtime changes;
review precedes expanded qualification. C28 itself remains rejected.

## R1 focused checkpoint

Separate [R1 source and results](c28-r1-current-capture/REVIEW.md), manifest
`9805ab2fae49202a334ef506c71a3583ff0f8dfebec51e8b27d992b23971653b`,
pass 18 focused cases plus four unchanged independent opaque-payload controls.
Main independently replayed all 22 and verified all 3,090 manifest entries.
[Independent review](c28-independent-review/r1/REVIEW.md) supports bounded next
qualification; it does not establish integration or general retention acceptance.

The readiness narrowing and private traversal preserve the reviewed source
boundary. Existing declaration regression/framework/type checks and separate
current-record/issued-evidence retention controls are now being run. No broad
suite, fresh artifact-cost or release result is claimed at this checkpoint.

## R1 qualification: covered A/B failure

[Expanded qualification](c28-r1-bounded-qualification/REPORT.md) passes 147
existing runtime controls, including 34 framework cases. Source/public types
pass. Its five fixture type errors are preserved; a separate
[test-only correction](c28-r1-test-qualified/REVIEW.md) passes affected 17 cases
and spec-types without runtime/API/ratchet changes. Recursive nested callbacks
are internal runtime controls with negative type assertions, not public typed
coverage.

R1 nevertheless remains unaccepted: both approved A/B cases fail again while
five horizon controls pass. The [causal trace](c28-r1-qualification/REVIEW.md)
shows x compares equal, but y checks readiness of its newly prepared proposal
rather than its already-closed predecessor. The resulting empty relevance mask
leaves only confirmed a as the difference, transferring the receipt. No oracle
or policy is changed. [Independent interpretation](c28-independent-review/r1/ab/REVIEW.md)
confirms the boundary.

The [next bounded design](c28-r1-qualification/CUTOFF-DESIGN.md) separates old
contributor closure, current invocation validation and prospective publication
relevance. It is under independent review; no successor runtime is yet selected.
The recorded bounded graph/reader successes cannot waive this approved-behavior
failure. Retained production remains unchanged.

## Bounded R2 selected after mechanism review

[Independent cutoff review](c28-independent-review/r1/ab/CUTOFF-DESIGN-REVIEW.md)
supports a separate bounded R2 prototype under the existing owner authorization.
The implementation must distinguish prior/selected historical contributors from
the current invocation and its captured lower bounds. It must gate both source
and recipient projection on validation plus activation, preserving raw validation
and exact retirement classification. Original A/B assertions remain unchanged.
R2 has no runtime acceptance yet; R1 and C28 remain preserved failures.

## R2 expanded result: repeated-use recurrence

[Independent R2 qualification](c28-r2-bounded-qualification/REPORT.md) passes
147 runtime controls and source/public/spec type gates. Main independently
replayed the 19-case first gate. Those gains remain valid.

[Expanded retention/lifecycle qualification](c28-r2-qualification/REVIEW.md)
then fails the second successive cleanup declaration in both planned terminal
variants. The fresh receipt is conservative instead of no-write; later terminal
and disposal assertions in those cases are not reached. Three public invalidity
contrasts and ten diagnostic cases pass separately. The first failure and all
source identities are preserved; no runtime repair followed.

R2 is not accepted. The read-only investigation must account for both cleaned
current source evidence and the older selected recipient proof when defining
admission-time relevance. A source-only enumeration is not established as complete
for late-selected comparisons. No policy change, broad qualification, build,
cost measurement or release action follows from the passing subsets.

## R2 second-call trace and mechanism comparison

The [observational continuation](c28-r2-n2-trace/TRACE-REVIEW.md) isolates the
second-call difference: the older recipient proof retains confirmed `a`, while
current source evidence no longer enumerates it. Values, pending ownership and
uncertainty flags are unchanged. The trace reaches useful terminal delivery and
disposal, but those observations do not make the original no-write assertions
pass: the second call still transfers delivery to the wrong receipt.

The [mechanism comparison](c28-r2-n2-trace/ALTERNATIVES.md) considers complete
prospective recipient classification and an immutable local confirmation cutoff.
Both require independent historical-closure and current-validation safeguards.
The cutoff is the next design investigation, not an accepted implementation; it
must not become contribution precedence or distributed authority. Runtime remains
paused while the exact closure witness and lifecycle boundaries are reviewed.

## Narrow R3 experiment selected after premise review

The new [public sibling pair](c28-r3-public-controls/REPORT.md) reproduces the
second-call attribution failure without diagnostic hooks; its meaningful-write
control passes and spec-types passes. Original repeated-use assertions remain.

[Premise adjudication](c28-r3-design-review/COMPARATOR-ONLY.md) supports a smaller
private successor than general proof-version provenance. R2's source transport,
operation projection and dependency cleanup retain their existing safeguards.
Only temporary no-write comparison views may ignore authentic confirmation
history predating admission, with captured-pending protection and every other
role/flag intact. Actual comparison operands must be fully reduced; unresolved
aggregate support cannot be silently treated as complete.

This selects bounded implementation and qualification, not acceptance. Earlier
issued proofs, receipt responsibility and dependencies must remain unchanged.
The [broader design investigation](c28-r3-design/PLAN.md) is preserved as a
comparison, not authority to add a new support-index provenance model. Production,
public APIs, budgets and B's closure remain unchanged.

## R3 bounded result: surviving candidate, broader qualification next

Frozen [R3 implementation](c28-r3-comparator/REVIEW.md), full manifest
`e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3`,
passes the 26-case focused gate. Main independently replayed that gate and
verified all 3,095 source identities. The unchanged original four-iteration
diagnostic passes both confirmation and disposal variants; the old receipt,
proof and dependency identities remain stable and useful delivery occurs once.

[Independent source review](c28-r3-independent-review/REVIEW.md) found no bounded
blocker. [Independent compatibility qualification](c28-r3-bounded-qualification/REPORT.md)
passes 147 separate runtime cases and source/public/spec type gates. A separate
diagnostic checks actual pending descriptor release at disposal; this is reference
release, not a heap/GC result. Repeated executions are not additional coverage.

The [late-confirmation control](c28-r3-late-confirm-review/REPORT.md) observes both
actual comparison operands: a cell confirmed after native admission remains
unfiltered, while the pending destination still holds useful delivery. The
[unresolved-aggregate probe](c28-r3-boundary-controls/REPORT.md) failed to reach
its intended state. That coverage miss remains preserved; the added aggregate
guard has source-review support but no demonstrated reachable-path coverage.

This supports R3 as the next compatibility-qualification candidate. It does not
establish general liveness for every replacement proof, universal retention,
lower cost, integration or release readiness. Full-suite scope is being checked
before execution so research fixtures and their required output environment are
accounted for explicitly. Production remains unchanged.

## Broader characterization: combined candidate is not accepted

The [unchanged suite inventory/run](c28-r3-suite-inventory/FULL-REPORT.md) preserves
all original assertions. Four framework runs complete with 762 ordinary passes,
seven failures and three skips. Four failures are the same dynamic-member scalar
admission error; three are React receipt expectations already adjudicated under
the approved no-write contract. Kernel characterization is partial because large
batch work reaches the owned-process no-progress watchdog; unexecuted cases are
not passes.

The [four-file differential](c28-r3-four-file-differential/REVIEW.md) returns
96 passes and the same six failures on exact R2 and R3: two state failures,
three missing native admissions and one operation-count bound. They predate R3;
this does not waive them or date their original introduction.

Two separate test-only overlays have reviewed bounded success:
[receipt/diagnostic corrections](c28-r3-suite-correction/REVIEW.md) preserve useful
transport assertions and add genuine held-receipt disposal coverage; [refusal
fixtures](c28-r3-refusal-fixtures/REPORT.md) inject reached pre-install failures
instead of bypassed legacy hooks. Neither changes runtime or retroactively makes
the unchanged characterization pass.

Dynamic attachment and realized-write classification require separate runtime
corrections. Their first failures remain preserved. The point-work
[attribution](c28-r3-work-attribution/REPORT.md) reproduces the unchanged 13,000
visit result; no absolute budget was raised. This is not integration acceptance.

## Separate follow-up mechanisms

- [Dynamic admission trace](c28-r3-dynamic-admission-trace/REVIEW.md): initial
  traversal attaches the responsibility producer, later ordinary leaves do not.
  [Independent premise review](c28-r3-dynamic-admission-review/REVIEW.md) permits
  one shared attachment path/provider with explicit ownership and cleanup rules.
  The private implementation is authorized; no repaired result is claimed yet.
- [State repair](c28-r3-state-repair/REPORT.md): traces confirm realized ABA
  evidence loss and early frame authorship. A two-file candidate fixes those two
  failures but changes unrelated reentrant history. [Independent review](c28-r3-state-independent-review/REVIEW.md)
  keeps it unaccepted; exact per-unit metadata is the next design boundary.
- [Disposition index](c28-r3-disposition-index/REPORT.md): a prepared per-owner,
  per-lifetime lookup removes a repeated full-change-list filter in the bounded
  restoration workload. Runtime equivalence, large gates and cost acceptance
  still require review/qualification. The counter's bounded-slice artifact is
  separately corrected only in diagnostic measurements; no original budget or
  production test was weakened.

## Completed unchanged ordinary-file inventory

The [final continuation](c28-r3-kernel-remaining280/REPORT.md) accounts for every
kernel file: 636 completed, two large-workload files incomplete, none unstarted.
The union records 7,040 ordinary passes, 19 ordinary failures, five satisfied
expected failures and 12 skips. Four frameworks retain 762 ordinary passes,
seven failures and three skips. Partial large-file observations are included;
this is not full-suite acceptance. Original failure assertions remain preserved.

The [private realization metadata design](c28-r3-realization-metadata-design/PLAN.md)
classifies exact prepared mutations rather than rebinding callback context. It
requires independent premise review before implementation. The separate indexed
restoration prototype is undergoing unchanged large-workload qualification;
its bounded operation counts establish neither CPU superiority nor release readiness.

Dynamic attachment now has a [frozen bounded candidate](c28-r3-dynamic-admission-repair/REVIEW.md):
28 original/minimal kernel controls, 28 lifecycle controls and three cases in each
unchanged framework file pass, with source/public/spec types. Added-fixture type
errors and their correction remain preserved. Independent implementation review
is pending; these groups are not summed as unique coverage or integration acceptance.

The [realization metadata premise review](c28-r3-realization-metadata-review/REVIEW.md)
requires exact-attempt classification at both admission consumers and all relevant
private frame forwarding paths. A separate bounded implementation is authorized.
It must compose with dynamic attachment without reviving ambient reclassification.

## Follow-up first failures and limits

Independent dynamic-admission implementation review now **holds composition**:
[56 existing controls pass, one injected initialization-cleanup control fails](c28-r3-dynamic-admission-review/implementation/FINAL.md).
The thrown attachment error retains one initializer-owned notifier subscription.
This is an internal fault-boundary reproduction, not a claimed default public-input
failure. The frozen candidate and first failure are preserved; an owned-cleanup
successor is authorized separately.

The indexed prototype completes both unchanged 130,000-row restoration controls.
Its separate entity replacement/undo file records one pass then V8 heap exhaustion
near the default 4 GB heap limit. It does not pass that gate. A [bounded matched
memory plan](c28-r3-large-memory-plan/PLAN.md) compares smaller identical workloads
without changing heap limits, budgets or production test timeouts.

[Point-work attribution](c28-r3-point-work-design/REPORT.md) distinguishes the
13,000-count fixed overhead from collection-size scaling and the separate bulk
quadratic scan. Safe local reductions are hypotheses; none currently establishes
the unchanged absolute point-work bound. No ceiling adjustment is authorized.

The first [matched memory experiment](c28-r3-matched-memory/REPORT.md) completes
all eight preregistered small-size invocations, each passing both selected original
cases. Both arms show substantial shared allocation; boundary samples and observed
GC variation cannot attribute the 130k heap failure to the index. No retained-heap,
peak-memory, speed or universal reclamation claim follows. Heap limits, original
timeouts and assertions are unchanged.

The [initializer-owned cleanup successor](c28-r3-initialization-cleanup-successor/REVIEW.md)
passes [independent 58/58 replay](c28-r3-initialization-cleanup-review/REVIEW.md).
The exact-attempt metadata successor independently passes 117/117 with unchanged
public declaration bundles; [review](c28-r3-realization-metadata-implementation-review/REVIEW.md)
requires forwarding through the dynamic ingress when composed. The isolated
composition now includes that explicit forwarding; its first eight-file combined
selection passes 113 tests. Independent composition review and broader ordinary
compatibility are underway. Production remains unchanged.

The [matched N512 GC diagnostic](c28-r3-matched-memory-retention/REPORT.md) passes
both arms with three verified post-destroy GC calls. Both finish near 38.6 MiB
whole-process heap; much pre-GC memory is transient. This does not identify the
130k failure's cause, quantify retained index objects or establish universal cleanup.

[Independent composition review](c28-r3-composition-independent/REVIEW.md) passes
95/95, including eight new dynamic realization/reentry controls. The final source
manifest remains `2a020da77e263693fbee66973bfba7072cb489a7cbde53bcda4336d686f820cd`.
The review's two staging-path provenance notes were corrected by preserving the
original conflict-stage files and recording the final import resolutions; runtime
bytes did not change. Broad ordinary suites and artifacts remain separate gates.


## Composed qualification and installed-package follow-up

The frozen composed source completes 768 selected test files: 7,849 ordinary
passes, one counted-work failure, five expected failures and 15 skips. The two
explicit large-file exclusions remain unqualified; these figures are not full
release sign-off. All four framework selections pass. The point-work bound,
large entity workload, package/demo budgets and final exact-source checks remain
open.

Actual public entity writes expose a packaging defect despite source tests:
the unchanged eight-case discriminator passes 8/8 from source but only 3/8 from
installed and production-bundled packages. The entity publication factory's
side-effect-only registration is dropped during library packaging. A private
explicit-value registration correction passes those original production cases
and six added lifecycle cases; independent review and composition are pending.
No public API or blanket side-effects setting is changed.

The [bounded lint correction](c28-r3-lint-repair/REPORT.md) passes 296 focused
cases and clears the 23 errors without suppressing rules. Its independent review
is pending; source and artifact results from the previous freeze do not qualify
this later source automatically.

The [sampled allocation pair](c28-r3-sampled-allocation/RESULTS.md) completes both
N2048 workers and six profiles. [Main's independent accounting check](c28-r3-sampled-allocation/MAIN-INTERPRETATION.md)
reconstructs reported sample/orphan totals. Row-projection construction during
preparation is a concrete investigation target, not an established OOM cause.
The entity native participant was absent in the earlier cardinality fixture;
scalar native projection construction was reached. These are different paths.
No timing, peak-memory or retention superiority is established.

Production remains unchanged. Current receipt semantics are approved; final
implementation, package equivalence and cost acceptance remain separate gates.


Both isolated follow-ups now have independent bounded acceptance:
[lint/completion review](c28-r3-lint-independent-review/REVIEW.md) and
[explicit entity registration review](c28-r3-entity-registration-review/IMPLEMENTATION.md).
These are independent source/evidence reviews, not independently rerun workloads.
[Registration results](c28-r3-entity-registration-successor/REVIEW.md) preserve
8 original and 6 lifecycle cases across source, installed and bundled routes;
these are 14 logical cases, not 42 unique tests. Actual late dynamic import runs,
but first factory registration remains early in the shared bundle, so late-first
registration is not established. A new combined successor is being prepared and
must pass its own checks. Original source and first package failures remain frozen.


The [preparation-read premise review](c28-r3-raw-row-premise-review/REVIEW.md)
and [baseline characterization](c28-r3-private-snapshot-baseline/REPORT.md)
identify a concrete allocation target: replacement undo/redo constructs four
`createDerived` projections beneath the snapshot helper for two rows. Six new
baseline cases and twelve selected existing controls pass; fixture setup failures
and corrections remain preserved. This is construction-count evidence, not a
speed, byte-allocation or OOM-cause result. Direct-point/rekey helper reach and
several visibility/reentry/provenance discriminators remain open. No raw-reader
optimization has been implemented or accepted.


## Bounded combined repair accepted; cost gates remain open

The [final combined repair](c28-r3-registration-lint-combined/REPORT.md) is frozen
at manifest `89058c7adf0bf680c3d8ef4778ff31d295ccc40d1911a31ac254484fa24a5c84`
(3,119 files). Main verified every manifest entry and independently replayed the
actual production bundles. [Independent source review](c28-r3-registration-lint-combined-independent/FINAL-REVIEW.md)
finds no bounded blocker. Author freeze is confirmed. This closes the demonstrated
entity factory packaging defect and the affected lint failures within the isolated
candidate; it does not activate production or establish release readiness.

There are 316 unique focused source passes, five fresh package builds, passing
source/public/spec types and graph-backed lint (zero errors, 26 warnings). The same
20 logical entity/lifecycle/receipt cases pass installed and bundled routes; do not
multiply their count across routes. Main's separate bundled replay passes those
20 plus the useful no-Link transaction control. Original fixtures and first
failures remain preserved. Permanent helpers stay within the kernel project and
outside the library build, with no public declarations added.

The fresh final-artifact gate still fails all four unchanged bundle ceilings:
bare production/development 17.91/20.26 KiB; entities 43.71/46.64 KiB. Earlier
point-work and large-workload failures remain open, as does final complete release
qualification. No budgets, production runtime, activation or B disposition changed.

## November 3 diagnostic reduction

[Report](c28-r3-diagnostic-reduction/REPORT.md): manifest `b4d66da3`, 3,121 source
files unchanged after qualification. Production entity gzip falls 811 bytes;
bare production falls 77 bytes. Development reductions are 127 and 97 bytes
respectively. No CPU, heap or general application superiority claim follows.
All four absolute package budgets still fail. Demo initial output is 682.62 kB
against the unchanged 570 kB ceiling; the earlier native-addon crash is distinct.
Installed and production-bundled controls preserve the same 20 logical cases,
plus useful no-Link and facade identity checks. All 25 declarations are identical.
Final independent identity review passes. Automated artifact gating remains
separate ongoing tooling work; production, activation and B closure are unchanged.

## Automated artifact gate qualification

[Tooling handoff](c28-r3-entity-artifact-gate-work/REPORT.md) preserves a separate
five-file successor at manifest `26193d77`. Two empty-cache peer installations,
fresh local tarballs, installed/bundled controls, deliberate registration removal,
clean recovery and classifier-blindness checks pass. Infrastructure failures are
not mutation kills. Independent review found an outer-registry proof-classification defect: setup
failure could count as a caught mutant. The accepted run remains valid behavioral
evidence, but the tooling candidate is not accepted. Correction and composition
qualification are pending;
these results do not qualify the diagnostic successor automatically.

[Private adapter baseline review](c28-r3-private-snapshot-baseline/INTEGRATION-REVIEW.md)
confirms two additional private-route controls. The error-message correction is
fixture calibration, not a runtime fix. No raw-reader optimization is implemented.

## Corrected gate composition accepted for continued work

[Main disposition](c28-r3-entity-artifact-gate-f1/MAIN-DISPOSITION.md) and
[independent follow-up](c28-r3-entity-artifact-gate-review/F1-REVIEW.md) bind source
manifest `8f902607` (3,124 files). Main replayed the validator checks and verified
all source hashes and192 identical diagnostic package files. Full-registry offline
setup now yields0/2proven and2errors; intended blindness yields2/2proven only after
both modes, controls and clean recovery. npm11.12.1 has focused mutation coverage;
npm11.21.1 has a separate ordinary-gate smoke. No all-version claim follows.
The earlier tooling F1 remains preserved. Runtime costs, failed budgets, broader
qualification and activation remain open.

## Next bounded preparation experiment

[Reviewed mechanism](c28-r3-preparation-reader-decision/REVIEW.md) selects a private
collection-owned read capability for testing, preserving primitive native reads,
lifetime/key acquisition, visibility and existing caller cloning. It must also
preserve lazy collection-owner initialization. Field bindings share that owner;
there is no distinct per-field PositionId allocation. Cold-row capture/inspection,
capability fallback/error/window rules and reached clone/reentry discriminators
must qualify before any performance claim. Main authorized an isolated prototype
and focused tests against8f902607; production and all prior checkpoints remain
unchanged. No public API or new authority model is authorized.

## Private preparation reader: bounded review passed

[Candidate report](c28-r3-cold-row-responsibility/REPORT.md) and independent
[review](c28-r3-preparation-reader-review/REVIEW.md) support manifest `812a3ad5`
for continued evaluation. Eleven focused cases pass. Main additionally ran 93
existing kernel cases and 15 framework cases (Angular 4, React 3, Vue 4, Solid 4),
plus source typecheck. The spec-type ratchet passes. Main verified all 3,127
manifest entries after those runs; these are source checks, not artifact proof.

Cold preparation avoids materializing row/field facades in the measured cases;
the retained clone boundaries and lazy collection-owner initialization remain.
This does not establish lower heap, CPU, OOM resolution or bundle cost. A bounded
eight-invocation small memory comparison against `8f902607` is authorized with
the prior workload and conservative stop rules. No 130,000-row run is authorized
by this experiment. The two packet diagnostic specs require output environment
variables and must be wired or separated before ordinary broad-suite composition.
All remaining release blockers and production/B dispositions are unchanged.

The later [test-only composition](c28-r3-reader-test-composition/REPORT.md)
`0af649ba` removes the mandatory diagnostic output sinks and always runs the
capability assertions. Ordinary Nx passes the same 11 cases with no skips and no
special environment variables. Its first PATH failure occurred before tests and
is preserved; the unchanged-source repeat passes. This does not repeat comparative
facade observations or change the memory comparison's frozen source.

[Loading-model review](c28-r3-late-first-link-review/REVIEW.md) confirms preserved
modules and early registration under ordinary unbundled root imports. Genuine late
first registration under a single-runtime split bundle remains unproved. Treat it
as a qualification question, not an established public defect or a completed claim.

The first installed public-root [split-graph discriminator](c28-r3-late-first-link-review/DISCRIMINATOR.md)
places registration in the initial shared chunk. Its 139 installed kernel files
match retained artifacts. The proposed late-registration behavior was not reached
or executed; neither a defect nor a late-enrollment success follows. The separate
selective no-Link graph remains unchanged.

[Point-work threshold review](c28-r3-point-work-threshold-review/REVIEW.md) finds
that the historical guard targeted collection-size scans. Main verified the
`ef1631b0` and `eb259b3a` patches/messages: they motivate deterministic complexity
checks, but do not derive today's separate `<2000` fixed ceiling. The retained
13,000 result remains an active failure; equal sampled counts do not establish
acceptable CPU or heap cost. Resolve the absolute-cost policy explicitly with
representative evidence and mutation controls, without weakening the current test
or treating its missing rationale as a performance waiver. No oracle changed.

## Reader memory campaign: incomplete, mixed small observations

[R1 report](c28-r3-reader-memory/R1/REPORT.md) and independent
[interpretation](c28-r3-preparation-reader-review/MEMORY-INTERPRETATION.md) preserve
four valid invocations at 128/512 rows, followed by a baseline 2,048 startup stop
at the 180-second no-progress limit. No event or memory sample existed for the
fifth run. It is not an assertion failure, observed OOM or measured zero heap.
The larger reader case and both 512 repeats were never invoked.

The valid runs each execute the same two tests and record 30 ordered boundaries.
Their final-drain heaps are 58.68/59.45 MiB (baseline/reader) at 128 and
73.18/60.94 MiB at 512. Starting heaps and GC timing differ; no retained-memory,
peak, allocation-byte, CPU or general superiority conclusion follows. All frozen
and selected source checks are unchanged. Semantic/facade-avoidance evidence stays
separate. C0's administrative zero-data cancellation and the corrected controller
validation defects remain archived. No favorable retry or larger workload ran.

[Startup-separation review](c28-r3-startup-separation-review/REVIEW.md) supports a
future protocol with explicit graph-only preparation, per-arm graph data and
fresh test workers, retaining task-cache bypass and bounded stop rules. Process
births/logs place most of the stopped run before the target-launch chain; they do
not attribute every second to graph construction. No such new campaign ran, and
the old timeout is not reclassified as a pass.
