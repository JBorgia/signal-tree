# Performance takeover — October 1, 2026

This is a local verification record, not release approval. Baseline public source:
`f59dba9e`, branch `fix/v15-link-settlement-diagnostics`. Raw execution evidence:
`/private/tmp/st-takeover-2026-10-01/` (machine-local, not a portable CI artifact).

## Independent review and reproduced failures

- Reentrant `setAll` reused pre-callback key/identity associations. An update
  interceptor rekeyed `a` to `b`; the outer operation returned with `has(b)` true
  but empty `ids` and zero count. `reentry-valid-red.log`: three failures across
  this and the two removal tests, fourteen controls passed.
- `removeOne` and `removeMany` sampled observer demand before their interceptors.
  Observers installed before the actual removal therefore received no write.
- A second adversarial review found selector-driven rekey without interceptors
  escaped the initial guard. `selector-red.log`: one failure, eleven controls
  passed. Final staging validation includes those callbacks too.
- The first repro setup omitted a required notifier and was invalid; it was
  corrected before drawing the membership conclusion. Two later test assertions
  incorrectly expected rekey to rewrite row data; existing key-only semantics
  were preserved and those expectations corrected. All intermediate logs remain.

The correction refuses stale outer topology staging before commit, preserves
completed callback writes, and samples removal demand after callbacks while
pre-removal neighbours remain available. The focused final suite passes 22/22.
No public export or transaction policy changes are involved.

## Scaling evidence

The old best-of-three wall-clock ratio was replaced with a deterministic guard
for the historical repeated `findIndex` neighbour search. Both 130,000-row
correctness controls remain. The guard runs plain and restoration-observed
replace/clear paths; undo proves observation is non-vacuous.

`node tools/verify-setall-neighbour-search.mjs` uses isolated source copies:
control nine passed; payload-search mutant four expected failures; staging-search
mutant eight expected failures. At 256/1,024 rows the bad searches visit
32,896/524,800 elements, exceeding the fixed 256/1,024 bounds. This is a proof
against that specific regression, not a universal complexity guarantee.

## Validation checkpoints

- Unchanged inherited source: kernel 3,205 passed; four framework suites, root
  typing/source checks, and package lint passed.
- First repair (before selector extension): kernel 3,219 passed, four framework
  suites passed, root checks and lint passed, packed strict consumer types passed.
- Spec-type gate caught a possibly-undefined reference in a new assertion;
  corrected without weakening the assertion. The corrected gate exits zero.
- Initial sandboxed package build stalled and was interrupted (exit 130).
  Serial build using the shared installed toolchain completed all five packages,
  exit zero. Do not report the interrupted run as green.
- Fresh size gate at the first repair: bare production 9.63/10.26 KB, dev
  11.75/12.45 KB; entities production **23.47/22.60 KB**, dev **26.13/25.25 KB**.
  Generator: `node tools/check-bundle-budget.mjs`. Exit one; ceilings unchanged.
  A fresh measurement after the selector extension is still required.

## Comparison evidence boundaries

The separate benchmark worktree corrects the incompatible heap measurements:
294 B/row was a multi-size net JS-heap slope; the old 120+230 B attribution was
positive-only filtered snapshot growth. They cannot be combined into a store
memory decomposition. Historical candidate-six timings are not measurements of
this optimized source. CPU throttle 4 is not a calibrated device class.

The harness now checks production-mode measured bundle behavior, preserves
artifact hashes, and marks busy/short runs as development evidence. Final packed
candidate build, fresh comparisons, full release gates, private Studio acceptance
and exact release-environment verification remain separate obligations.

## Final source checkpoint

Final selector-inclusive source: 3,220 kernel tests passed (329 files), with
seven expected failures, thirteen skips and one todo reported separately.
Spec-type ratchet and focused lint exit zero. Benchmark harness checkpoint:
`901cd45d`, fourteen selftests including stale-byte and wrong-result falsifiers.
The inherited entity-size failure remains open; this correctness checkpoint is
not an RC freeze and does not authorize release.

## Installed-artifact comparison after oracle correction

Harness `9000919a` adds an independently planned per-edit state/DOM oracle (22
self-tests), replacing reliance on endpoint-only correctness. Generator:
`node scripts/run.mjs --rounds 5 --rows 1000,10000,50000 --footer on` in
`benchmarks/store-comparison`; repeat with `--footer off`, and with
`--footer on --cpu 4`. Default six arms plus released A/A control. Candidate
kernel SHA-256 `86a294cd0f950a5cf74ec05e791b16a85b20422db2ba4b2e873619760cd55f00`;
Angular `5bc624c10e61165d399c14d60a4f068c185d028300c56d0d3aa43a2a70e4412b`.
The source sidecar claims `8fe2664f`; installed and served hashes are checked,
but the generic harness does not independently prove source-to-artifact origin.

Fresh batches in `quiet-browser-results/` under the raw-evidence directory:

- `2026-10-01T18-04-04-787Z.DEVELOPMENT.json`: footer on, busy at end.
- `2026-10-01T18-09-45-953Z.DEVELOPMENT.json`: footer off, busy at start.
- `2026-10-01T18-12-42-660Z.json`: CPU4/footer on; endpoint load checks passed.

All three exit zero with empty correctness failures. Host: Apple M4, darwin
arm64, Node 24.15.0, Angular 22.0.7, Chromium 145.0.7632.6. Defender RTP was off;
EDR and other system services still ran. Two user analysis processes were paused
for these batches and resumed afterward. Endpoint load checks do not prove a
continuously idle machine. Browser contexts are not fresh-process isolation.

At 50k rows, CPU4/footer on, milliseconds (median across five rounds; p95 columns
are the median of each round's p95):

| Arm | Load | Refetch | Move p95 | Visible position edit p95 |
| --- | ---: | ---: | ---: | ---: |
| Angular signals | 58.845 | 47.510 | 1.854 | 9.327 |
| NgRx SignalStore | 49.750 | 31.530 | 9.022 | 37.577 |
| ST 14.1.3 | 110.015 | 111.310 | 93.835 | 4.560 |
| ST 15.3.1 | 506.225 | 237.215 | 183.789 | 13.697 |
| ST candidate plain | 120.090 | 100.085 | 60.361 | 16.206 |
| ST candidate transactions + restoration | 1659.885 | 886.355 | 460.074 | 16.374 |

These are observable application tasks including Angular stabilization, not
semantically identical internal algorithms. Moves use whole-collection setAll
in ST. Enhanced-arm refetch is an ordinary authored setAll, not external ingress;
it does not exercise a complete undo workflow. Memory endpoint growth is about
294 B/row for released and plain candidate; no meaningful improvement established.
That metric is a two-size net heap slope, not dominator-retained library memory.

The candidate improves bulk tasks but regresses at the 50k position-edit tail:
all five visible p95 samples (14.593–17.027 ms) exceed released samples
(13.240–13.957 ms) and released A/A samples (13.671–14.473 ms). Offscreen p95
also regresses. At 10k, candidate p50/p95/p99 improve; at 50k p50 is nearly flat.
A/A variation is descriptive, not a confidence interval. Do not retry until green.
The next experiment is a bounded CPU/GC trace separating synchronous write,
aggregate projection, and stabilization waits, retaining original correctness
checks. Instrumented runs diagnose cause; they do not replace these timings.

## Bundle cleanup in progress

The entity consumer bundle contains a test-only integrity checker and retains
wrong-method diagnostic-table strings even when the warning call itself folds.
The expanded `check-devmode-foldable.mjs` failed on those strings before repair
(`foldable-table-before.log`, exit one). Moving the dev condition before the
computed table lookup fixes folding. The integrity checker moves to its sole
spec caller with its graph assertions preserved; a deliberately damaged chain
must still fail the checker. Independent review found an escaped-Unicode
sentinel gap; the guard now matches ASCII text and self-tests the Unicode input.

Initial slice: full kernel 3,221 passed, seven expected failures, thirteen skips,
one todo. The first extracted helper accidentally shadowed its graph variable;
focused failure is preserved in `bundle-focused.log` and corrected. A sandboxed
build emitted files then stalled at zero CPU; terminated after three minutes,
exit one. Identical uncached host build exited zero; exact sandbox cause remains
unestablished. Initial cleanup measures 22.84/25.75 KiB entity prod/dev, still red
against unchanged 22.60/25.25 ceilings. Further dead internal ordinal/wrapper
cleanup and validation are in progress; these are not final candidate figures.


## Bounded trace and first allocation repairs

`profile-position-edits.mjs` records diagnostic CPU/GC timelines against the
unchanged served bundles, one released/candidate pair, 50k rows, CPU4/footer on,
400 edits per arm. Evidence is `position-diagnostics/profile-tnbjtM/`; receipt
checks served bytes before and after, and correctness/partial digests match.
Browsers and server were closed afterward. Instrumented timings do not replace
the original five-round comparison. Eight major collections overlap candidate
slow edits (5.58–7.68 ms pauses), versus none in released; synchronous writes are
not slower. Both versions build intermediate key/value tuples. The trace does
not establish why the candidate reaches major GC more often.

A direct-values projection now avoids tuples that `all()` immediately discards.
Sorted/unsorted allocation controls first fail with 64 unnecessary tuples, then
pass with zero; asMap's 64 useful tuples provide a positive measurement control.
Held arrays, ordering and subsequent values are checked. The first spy-based
fixture recursively instrumented its own call recording and was invalid; its
failure is preserved before the corrected wrapper produced the meaningful red.
This measures pushed tuples, not total allocation or browser improvement.

The ordinary-confirmed-record path skips construction only when no transaction
is pending, history retention is zero and the confirmed ledger is empty. IDs,
truncation, capture cleanup and restoration designation retain their contracts.
An isolated 32-row control measures effect copies 64 → 32; retain=1 and 0.5
remain 64. Eight focused cases plus neighboring controls pass (84 total).
Removing the shortcut restores one red; dropping IDs or truncation gives three
reds each, ignoring pending obligations one, ignoring retention two. Lifecycle
traces distinguish transaction ID 1 from ledger ID 3 after ordinary writes.
Raw commands, source hashes and isolated mutants: `/private/tmp/st-ordinary-record-proof/`.

Combined checkpoint: kernel 3,231 passed (331 files), seven expected failures,
thirteen skips, one todo; source typecheck, spec-type gate and focused lint exit
zero. All five public package builds exit zero. Experimental tarballs are in
`/private/tmp/st-perf-candidate-2026-10-01/`, including SHA-256 receipts and the
working-tree patch identity. They are explicitly not a frozen RC. Browser
performance confirmation, Studio acceptance and full release verification remain.


## First repaired-artifact browser batch

`node scripts/run.mjs --rounds 5 --rows 10000,50000 --cpu 4 --footer on
--arms st15-released,st15-candidate,st15-undo` in the comparison workspace exited
zero on its first run, ending 19:47:44 UTC. Released A/A is added by the harness.
Raw JSON: `perf-candidate-browser-results/2026-10-01T19-32-58-569Z.json` beneath
this audit's external evidence directory. Full vectors and analysis are retained
in `perf-candidate-bench-ready/first-batch/analysis.json`. All 20 arm-round
executions passed; intermediate grid and editor digests agree. Built/installed
provenance checks match the experimental archives, not a clean RC source claim.

Environment: Node 24.15.0, Chromium 145.0.7632.6, Darwin 25.2.0 arm64, Apple M4,
CPU throttle 4. Start/end load 4.039/3.222, both host busy flags false;
`development=false`, reasons empty, source checkout dirty. These endpoint host
checks do not establish continuous host idleness or calibrate the throttle to a
particular device.

At 50k rows, milliseconds (median across five rounds; edit/move columns are
medians of within-round p95):

| Arm | Load | Refetch | Move p95 | Visible position edit p95 |
| --- | ---: | ---: | ---: | ---: |
| Released 15.3.1 | 544.81 | 249.78 | 187.22 | 14.55 |
| Repaired plain candidate | 119.81 | 97.49 | 60.14 | 11.44 |
| Candidate transactions + restoration | 1718.80 | 919.31 | 513.22 | 11.64 |
| Released A/A | 564.69 | 249.38 | 189.75 | 14.43 |

Candidate visible edit p95 ranges 11.1–12.8 ms, below every released/control
round (released 13.84–14.67; A/A 14.08–17.13). At 10k the medians are 2.38 ms
candidate versus 3.19 released and 3.34 A/A. The previously demonstrated plain
50k tail regression is absent in this batch. This is descriptive separation,
not a statistical confidence claim from an A/A band.

Compared with the earlier 8fe batch, candidate 50k visible edit p95 decreases
16.21 → 11.44 ms. Arm mix/order and size selection differ between batches;
released medians moved too. Do not attribute the difference to one repair in
isolation. Enhanced bulk overhead remains unresolved (50k move p95 is worse
than the earlier 460 ms). This batch includes the tuple and transaction-record
repairs, **not** the later restoration shortcut, two diagnostic wording changes,
or final dead-reset removal.

### Further bundle cleanup

Two internal reset methods have no production caller: StructuralStore.clear
has one adversarial test caller and EntityValueStore.clear has none. The former's
reset fixture moved into its spec, retaining old-handle/reused-ID coverage;
production incarnation checks remain. Three physical-store files pass 22 tests;
scoped lint and an uncached host build pass. After the shorter, current-behavior
ST2018/ST2024/ST2026 guidance, the budget generator measures bare 9.63/11.71 KiB,
entities 22.54/25.37 KiB (prod/dev). **Development entities remain red against
25.25; production passes 22.60.** No ceiling change. Development diagnostics fold
correctly; the distinct folding fixture measures slightly different totals.


## Restoration capture repair and later validation

The restoration shortcut applies only at flush, after same-turn designation can
be known, with no retained history (including redo) and no restoration-manager
pending turn. It clears the ordinary capture bucket without materializing
copies that `appendHistoricalGap` would discard. Pending transaction footprints
and external truth tracking are unchanged.

The original new tests had four incorrect behavioral expectations, reproduced
on the unmodified restoration source: transactions retain a descriptor shell
after ordinary reorder, and delivery-observer writes form a later undo step.
A subsequent standalone control also wrongly expected a designated scalar's
own descriptor to disappear. All fixture versions and initial failures are in
`/private/tmp/st-restoration-drain-proof/fixture-corrections.txt`. No production
change was made to force those expectations. The final 216-case matrix passes;
original restoration fails only three allocation-count guards (213 pass).

On 32 rows, counted discarded copies fall 32 → 0 with restoration alone and
64 → 32 with both enhancers in either order. Designated controls remain 3/4/4.
Seven mutants are caught: ignore manager pending (2 reds), retained history (8),
designation (20), leave effects (10), orders (3), descriptor inputs (3), clear
live transaction footprints (2). Counts describe this concrete copying path,
not total allocation or browser latency. End-to-end remeasurement remains.

The coordinating full run initially recorded 3,252 passed / four new-fixture
failures; after the baseline-confirmed fixture corrections it exits zero with
3,257 passed, seven expected failures, thirteen skips and one todo (332 files).
Current source typechecks, kernel lint, production demo build, 35 examples,
documented imports, semantic discoverability, error codes and numeric-claims
checks pass. A mistaken command name `check-error-catalogue.mjs` did not run a
gate; the actual registered `check-error-codes.mjs` subsequently exits zero.

## Studio acceptance exposed declaration defects

The private scratch validation covers all four observation channels, protocol 4
rejection controls and structured addresses across all five package runtimes.
Its strict all-shipped-declarations fixture finds TS2724: internals imports
unexported ISignalTree from the root declaration. The old public consumer gate
never imported internals. Expanding it also catches separately bundled nominal
types. The first expanded fixture called a nonexistent reader.snapshot; that
fixture error is corrected to readConfirmedTurns, while the actual packaging
failures persist against the unchanged archived tarballs.

Independent review supports bringing the existing shared declaration graph from
the development branch into v15: unchanged runtime configuration, unchanged
public entry names, no private-brand exports, private chunks already covered by
`dist/**/*.d.ts`. No source import rewrites are needed. Its first strict run
removes TS2724 but reveals a separate reader-admission defect: default TreeNode
reconstruction loses opaque leaf boundaries. That type correction is in progress.

The old documentation mutation becomes blind when docs move out of index.d.ts;
its preserved stripped-index control exits zero. The registered mutation now
selects the richest shipped declaration after build, rather than assuming the
barrel owns documentation. Both declaration-docs mutation proofs exit one and
restore correctly; harness result 2/2 proven, zero blind/unproven/errors. Full
registry proofs and a fresh final rebuild remain required.

The final reviewed private Studio tooling patch was applied to its actual private
checkout at base `daa9aec6`, with no manifest/lockfile overrides copied from
scratch. Fourteen focused tooling tests pass there. The patch's AST-based
relative declaration import rewrite preserves literal types; an independent
review reproduced both former regex counterexamples and found no remaining
blocker in that repair. Full browser/native DevTools acceptance remains separate.

Reader admission is being verified across every facade, including Vue's public
ref type over its internally callable lifecycle carrier. The first host build
with new kernel-local framework integration tests failed before compilation:
`kernel:build → vue:build → kernel:build`. This is a test-placement defect, not
an excuse to change the dependency graph. Move the runtime control to Vue and
keep all-facade type admission in the isolated packed consumer. First failed
build: `/private/tmp/st-takeover-2026-10-01/tooling-admission-build.log`.
The focused declaration-proof retry also failed at its prerequisite build; it
is not a newly established gate pass.

The misplaced integration tests are now separated: neutral typing controls in
kernel, runtime carrier/destruction checks in Vue, and all-five-facade reader
calls in the strict packed consumer. The rebuilt five-package set passes;
expanded packed consumers pass Bundler and Node16 with `skipLibCheck: false`.
Source typechecks, all four framework suites (152/7/9/35 passed, three existing
Angular skips), and kernel lint pass. The admission changes erase to identical
JavaScript; they preserve factory topology and carrier types without widening
arbitrary objects into trees. Focused documentation mutation proof: 2/2 proven,
zero unproven/vacuous/blind/errors. A clean post-mutation rebuild follows.

New experimental archive set:
`/private/tmp/st-observer-perf-candidate-2026-10-01`; kernel SHA-256
`8ebed29ce6582be4247fce57ec10d70be35e2b3dc458c931ee71ac44f8e47211`.
All five report 15.4.0. Receipts, tracked source patch and untracked input hashes
are retained; this dirty working-tree build is not a frozen release candidate
or a cryptographic source-to-build attestation. Private Studio acceptance and
next quiet measurement use this archive set. The fresh size gate remains red
only for development entities, and development folding passes.

## Further acceptance findings (not waived)

Complete private Studio acceptance on the new archives passes its initial
preview browser checks, then fails `verify-investigation-tools.mjs` waiting for
`studio-changes .operation summary`. Source inspection shows that selector was
replaced by virtualized operation-header buttons. The first failed run is kept
at `/private/tmp/studio-final-acceptance-ngj624co/evidence/`; native DevTools and
final packed-consumer stages were not reached. A fixture repair must retain the
behavioral assertions and run again before claiming complete acceptance.

The new Vue observer fixture also exposed a separate atomic object-leaf undo
failure. Exact packed controls reproduce `Unsupported scoped undo effect at
structural-drift` for `leaf({min,max})` replacement in both the candidate and
published 15.3.1 kernel. Each tested runtime has five failing object-leaf variants
and ten passing scalar/branch-child controls; candidate Vue behaves the same.
It needs neither observers nor a preceding entity transaction. Evidence lives
at `/private/tmp/st-opaque-undo-packed-proof/`. No published Vue comparison was
available locally. This is not covered by the documented omitted-branch-key
limitation. A bounded correctness repair is under investigation; do not report
full restoration coverage merely because observation snapshots work.

The next quiet performance batch has not started: host inspection found
Defender enterprise using 83.9% CPU despite real-time protection off. Passive
mode is false and tamper protection reports block. No tamper policy was changed.
Functional validation can continue, but a contended run must not be called quiet.

## Terminal replacement repair

The older `undo-nonscalar-leaf` characterization and its introducing history
confirm a known primitive-only regression, not a permanent restriction of the
public atomic-leaf contract. The repair uses the existing registered terminal
position when capturing effects and admitting restoration. It does not add
branch inference, change entity lifetime handling, or promise deep-copy history
for mutable payloads. The original characterization comments remain, with an
adjacent repair disposition. Consumer guidance now explicitly distinguishes
replacement writes from in-place mutation.

Independent review supplied an additional falsifier: external `undefined` was
deleting provenance. It reproduced (one red/fifteen green), and registered
terminal positions now retain that undefined value as external truth. The
omitted-terminal negative control remains distinct and safely refused. Four
source mutations independently remove restoration capture, transaction capture,
terminal admission or undefined provenance; all fail (11/1/19/1 red cases)
against a 23-pass control. Early mutation-runner setup failures and the initial
Object.hasOwn type-library mismatch remain in the proof directory; neither is
counted as a mutation kill.

The first full kernel run after repair is preserved: 3,272 passed / one failed,
plus seven expected failures, thirteen skips and one todo. The failure was the
conforming-collection prototype's old assertion that array undo must refuse.
It now asserts exact undo/redo state and derived member reads while preserving
its original historical finding; its focused run passes. No production code
changed in response. Full types, kernel/Vue lint and all framework suites pass.
Final full kernel, fresh packed reproduction and Studio acceptance remain.


## Post-repair package validation

The corrected full kernel run exits zero: **3,277 passed**, seven expected
failures, thirteen skips and one TODO across 333 files. Framework suites also
exit zero: Angular 152 passed/three skipped, React nine, Solid seven and Vue 44.
The four additional external-undefined redo/rollback controls bring the neutral
terminal boundary fixture to 20 passing cases; no further runtime edit was needed.
Source types, focused spec types, kernel/Vue lint, clean all-five build and
production demo build pass. Live documented examples: 35 across 29 documents.

The final experimental archive directory is
`/private/tmp/st-terminal-perf-candidate-2026-10-01`, with all five manifests
checked as 15.4.0. Kernel SHA-256:
`f29d0d3bcedbe2573879f2c064f54ec96260e1c8652742103659e10cfe3a68a9`.
Its receipts preserve all package hashes; base commit `e189fe36` plus the
recorded dirty patch/inputs is experimental working-tree evidence, not a frozen
RC. The clean build ran after source mutation checks. Strict consumers of these
exact five archives pass Bundler and Node16, including all framework observation
admissions. Complete Studio acceptance and the original packed undo reproduction
are being repeated against these archives.

Fresh generators still measure bare 9.63/11.71 KiB and entities 22.54/25.37 KiB
(prod/dev). `check-bundle-budget.mjs` exits one only for the unchanged 25.25 KiB
entity development ceiling; `check-devmode-foldable.mjs` exits zero. This is not
a waiver. The first repaired benchmark remains the only completed performance
batch for the new optimizations; these latest archives have not yet been timed.

The unchanged packed runtime reproduction now passes all 15 variants for both
the repaired kernel and Vue. The original published 15.3.1 kernel still fails
the five object-leaf variants and passes ten scalar/branch controls in the same
run. Original red evidence is unchanged. Results and receipt verification:
`/private/tmp/st-opaque-undo-terminal-packed-proof-2026-10-01/`.


## Complete Studio acceptance on terminal-repair archives

The isolated complete private `verify:release` exits zero against the exact
five terminal-repair archives above. Private base is
`daa9aec6016e133260d7117f59f3f5cced5c0ef6`; the applied 20-file patch SHA-256 is
`c798c73a254c87a67d7603b0f5afadc14886c8236656741fbbb5b82bdef76a89`.
The runner checks that patch against the actual private working source and
verifies installed archive bytes before building. Evidence:
`/private/tmp/studio-final-acceptance-7u9t5ch4/evidence/run.json`.
Query tests: 51; adapter: 365; app: 522 plus one existing expected failure.
Types, lint, builds, preview/browser checks, native DevTools and final packed
private consumers pass, including all five frameworks' lifecycle, restoration,
entity membership and Link-state channels. This is automated acceptance, not
a completed human-comprehension study or certification of the old 15.3.1 pin.
The actual private manifests/lockfile remain unchanged; the explicit archive
installation is isolated. Nothing is published.

The first broader public default registry run then exposes a separate React
reference-app resolution failure: Vite attempts to execute the kernel's built
`index.d.ts`, following the React package's declaration-build paths. Eight store
controls pass; the app suite cannot load. The source package suites and strict
packed consumers pass. Preserve this first failure in
`terminal-default-gates.log`; inspect runtime aliasing rather than weakening
shared declaration identities or removing the app assertions.

The first default registry completes **69/71 passed, two failed, zero known-red,
exit one**. Failures are React reference runtime resolution and development
entity size. Independent review confirms `vite-tsconfig-paths` follows React's
valid declaration-build mapping when importing its source barrel. The app now
explicitly aliases kernel runtime imports to kernel source, matching its existing
adapter alias and the React package's own test configuration. Package declaration
paths and consumer exports are unchanged. Its unchanged 26 tests and production
build pass after this configuration-only correction. This focused rerun repairs
one failure; it does not retroactively change the 69/71 record or constitute
exact-commit release qualification.


## Final experimental-archive comparison

One unchanged five-round CPU4/footer-on batch completed, exit zero, with no
retries, no correctness failures and no development-mode reasons. Command:
`node scripts/run.mjs --rounds 5 --rows 10000,50000 --cpu 4 --footer on --arms st15-released,st15-candidate,st15-undo --out /private/tmp/st-takeover-2026-10-01/perf-candidate-browser-results`
from the store-comparison workspace. The released A/A control is added by the
harness. Raw file: `2026-10-01T21-09-18-906Z.json`, SHA-256
`ec264167367be0e44cc1aced9d35e2e2a9b60e2433411e351422f4e34f8c5acf`.
Receipts, host samples and first exit are under
`/private/tmp/st-takeover-2026-10-01/terminal-bench-prep-s4i5j3jn/first-batch/`.
All arm/round grid and editor digests match. The archived/served build and
installed candidate identities are checked; source derivation remains a dirty
working-tree claim, not a frozen release attestation.

Mac M4/10 logical CPUs, Darwin 25.2 arm64, Node 24.15.0, Chromium 145.0.7632.6,
Angular 22.0.7, fourfold CPU throttle. Load averages at endpoints are 4.00 and
2.37. Defender had subsided in the preceding parent sample, but the saved launch
process snapshot records enterprise CPU at 82.1%, falling to 13.0% afterward.
Desktop/Codex processes remained. The harness host guards passed; that does not
establish a quiet machine. The record explicitly sets `quietClaim: false`.
Endpoint samples and A/A controls do not prove continuous idleness. This is a
controlled workstation comparison with recorded background contention.

50k rows; milliseconds, median across five rounds (p95 columns are medians of
within-round p95 values):

| Arm | Load | Refetch | Move p95 | Visible edit p95 |
| --- | ---: | ---: | ---: | ---: |
| Released 15.3.1 | 518.24 | 241.35 | 188.24 | 14.25 |
| Candidate plain | 118.23 | 97.89 | 59.88 | 11.28 |
| Candidate with transactions/restoration | 1647.03 | 892.90 | 520.47 | 11.43 |
| Released A/A | 519.05 | 244.23 | 183.75 | 14.18 |

Candidate 50k edit-p95 range is 10.95–13.33ms; released 13.93–14.41ms and A/A
14.01–15.77ms. Every candidate round is faster than either released control's
best round. Median paired A/A variation is 1.8%. Median per-round p99 is
15.36ms candidate versus 16.25ms released and 16.03ms A/A; distributions overlap
with A/A and the maximum candidate edit is 22.88ms. Do not claim all stalls gone.
At 10k rows, candidate edit p95 is 2.38ms versus 3.22ms released (candidate
range 2.25–2.90; released 3.04–3.50).

The installed-enhancer bulk cost remains approximately 13.9× plain load, 9.1×
refetch and 8.7× movement. The latest allocation shortcut does **not** establish
a material end-to-end reduction of that overhead: the earlier enhanced median
load was 1718.80ms, but the released control also became faster between batches.
The source mutation/work-count evidence proves avoided allocation; it does not
prove a proportional application speedup or causally isolate this shortcut.

Candidate startup transfer is 94.7 KiB versus 94.3 KiB released; enhanced is
approximately 131 KiB including the common app/framework. ScriptDuration median
is 14.2ms candidate versus 13.3ms released, with overlapping ranges. Overall
startup TaskDuration remains within the A/A band. Do not describe the candidate
as uniformly faster in every metric. Installed optional machinery still costs
work; unimported capabilities and an enhancer actually installed on a tree are
different cases. No v14 arm ran in this batch: 14.1.4 in environment metadata
identifies an installed library, not a new v14 performance result.

The full per-round analysis additionally retains the 10k offscreen-edit p95
regression in round two (+11.7% versus released); the other four rounds improve.
The 50k candidate visible-edit p95 improves in all five rounds, but paired A/A
variation reaches +9.4% in round one. Ranges and A/A comparisons are descriptive
evidence, not a statistical-significance test. Full distributions and paired
comparisons are in the batch's `analysis.json` and `per-round-metrics.csv`.


## Bounded installed-enhancer attribution

After the fixed comparison finished, one diagnostic 50k load and one refetch
were captured for each of the plain and enhanced arms. No package rebuild, new
benchmark batch or timing retry. All original correctness checks pass; browser
and server resources close afterward. Raw CPU/heap profiles, traces, receipts
and `attribution.json` are preserved in
`/private/tmp/st-takeover-2026-10-01/terminal-bulk-profile-YcMji9/`.
Exact minified chunk offsets were matched to installed functions whose files
match the tarball. This is a single instrumented diagnostic, not a performance
comparison or a source-map-based precision attribution.

Notifier flush accounts for approximately 67% of enhanced load and 76% of
refetch inclusive sampled CPU. Transaction capture is approximately 31%/36%,
restoration capture 13%/24%; these are overlapping ancestry percentages and must
not be added. Descriptor registration alone is approximately 17.5%/13.3% self
CPU. Refetch field diffing is performed separately in restoration (12.3% self
CPU) and transactions (11.3%). Heap sampling covers the whole driver, including
seed generation and validation: it is neither retained heap nor precise total
allocation.

The read-only source review identified a bounded opportunity: ordinary
`recordConfirmedBucket` drains, sorts and clones effects before the authority's
zero-retention/no-pending fast path discards them. Moving that eligibility
decision ahead of drain at flush would need to preserve reserved IDs, truncation
evidence, descriptor cleanup, pending dependencies and same-turn promotion.
However, the measured drain is only approximately 2.6%/0.8% inclusive CPU; its
effect clone is 1.7%/0.4%. That is not an explanation or solution for the large
bulk overhead. No further production change was made on the strength of this
one profile.

The more consequential opportunity is reducing duplicate per-row descriptor
and field-diff work or materializing it only when its correctness obligations
require it. A later designated write can promote the whole turn, so simply
skipping ordinary capture at enqueue is invalid. Establish equivalent
provisional evidence, observation ordering and reentry semantics before any
such refactor; do not weaken those contracts to improve a bulk number. This
work remains open. The already completed allocation reductions and plain-store
regression repair must not be reported as resolving installed-enhancer cost.


## Continuation: source checkpoints and live documentation

Allocation, terminal restoration, tooling declarations, private-code reduction,
diagnostic folding and React reference alias changes were checkpointed separately
as `03deb906`, `2892b650`, `5f6c68ca`, `2051e605`, `14a06051`, and `7cfc864a`.
Independent review found no additional scoped source blocker; avoided copies are
not evidence that installed-enhancer bulk cost is resolved.

A fresh `npm view @signal-tree/kernel dist-tags --json` returned latest 15.3.1.
The documentation index's stale 15.3.0 claim was corrected; package failure-guide
links now use the verified local v15.3.1 tag (`40e668036290b43f9e389e97a35341ea9e5fea7d`)
instead of a mutable fix branch. llms.txt now routes current release work to
RELEASE-CURRENT.md and identifies RELEASE-1.0.md as history. The support policy
identifies 15.3.1 as published. Typing guidance distinguishes TypeScript's node16
resolution mode from the pinned Node 24.15.0 build runtime.

The demo's fallback documentation links previously jumped to main (a different
release line). Five focused cases failed against version-pinned link expectations;
after using the demo's generated version for GitHub and raw-image links, all
13 documentation tests pass. First red and green logs remain under
`/private/tmp/st-takeover-2026-10-01/docs-version-links-{red,green}.log`.
An unreleased preview's tag links and StackBlitz npm dependency only become
available after publication; do not deploy this candidate demo as the released
site before its version and tag exist. Do not substitute 15.3.1 dependencies for
examples of 15.4-only capabilities.


## Approved development ceiling and preserved full-run failures

The owner explicitly approved **25.50 KiB development entities**, keeping
**22.60 KiB production** unchanged. `tools/check-bundle-budget.mjs` measures
22.54 KiB production / 25.37 KiB development after the preceding safe reductions.
The focused budget gate passes under the new policy. This is diagnostic
headroom, not a claimed performance improvement or a production-budget increase.

The preceding full working-tree registry at `7cfc864a` plus recorded changes
finished **84/86 passed, two failed, zero known-red, exit 1**. Its original
25.25 KiB size failure is retained. The other failure was the ownership
benchmark's incomplete staging of committed source dependencies. Adding its
missing deferred-write scope exposed a second omitted dependency (plain branch
membership), so the first focused rerun is also preserved as **1/2, exit 1**.
Neither failed benchmark run provides timing evidence. Logs and source identity:
`/private/tmp/st-takeover-2026-10-01/resume-{candidate.json,release-gates.log}`
and `repaired-gates.log`.

## Unchanged-child capture: bounded work reduction

Restoration now reads each child and its own-property presence once, in the
existing order, and avoids recursive path/segment/presence construction when
the child and presence are unchanged. Both enhancer orders, promotion of the
whole turn by a later undoable write, absent versus present undefined, and
external-write refusal remain covered. Semantic baseline: 12 tests pass; final
focused run: 49 tests across three files pass, with scoped types/lint passing.
Independent review found no additional blocker.

Generator: `node tools/probe-restoration-child-capture.cjs`. It extracts the
actual function and counts source constructions, not heap allocation or GC.
For its declared workload, calls fall from **36 to 3**; path, segment and
presence constructions each fall from **35 to 2**, with the same one emitted
effect. Eight controls cover own-property presence, NaN/signed zero and getter
order/side effects. Reverting the guard fails the construction bound (exit 1);
the candidate passes. Evidence: `/private/tmp/st-unchanged-child-proof/`.
No end-to-end speedup or elimination of installed-enhancer overhead is claimed.


The completed harness repair stages the complete kernel source archive from one
pinned commit, bundles its real dependency graph, records its identity, and
cleans its unique temporary directory. At `4d3e066b`, the graph has 27 source
inputs and no external runtime imports. The six-arm, three-sample smoke exits
zero with the required INCONCLUSIVE verdict; the wrong-owner mutation exits
one specifically for unstable history ownership. Source restoration is
byte-identical and the restored control passes. See
`/private/tmp/st-history-ownership-repair/results.json`. The previous hand-copied
stubs and new bundled dependency graph are not interchangeable performance
baselines: this run verifies harness operation, not historical timing claims.

The approved bundle policy's oversized-artifact mutation also fails as required:
1/1 proven, zero unproven/vacuous/blind/errored, exit zero. Log:
`/private/tmp/st-takeover-2026-10-01/approved-budget-selftest.log`. All final
package verification still requires a clean post-mutation rebuild.

The approved budget and coherent benchmark staging are local checkpoints
`ccac4ebd` and `d40aaa0f`. The updated demo production build first exited one
inside the sandbox without a compiler diagnostic; the unchanged-source verbose
host build exited zero. The cause of the sandbox exit was not established.
Fresh production browser smoke: **146/146 passed, exit zero**. Logs are under
`/private/tmp/st-takeover-2026-10-01/resume-demo-{build,build-host,smoke}.log`.
These checks do not replace final post-mutation package and demo verification.

`53834fda` checkpoints the reviewed consumer guidance and version-bound demo
links. Six focused documentation checks pass (five registered checks in the
first selection, then the correctly named `documented-examples` check); the
first selection misspelled that name and did not execute it. Both logs are
retained. The unrelated v14 audit edit remains outside these checkpoints.
Next verification covers the complete registry and its release-only mutation
proofs, followed by destruction/rebuild of generated artifacts.
