# Automated application comparison

November 11, 2026. Execution record for the [registered protocol](PROTOCOL.md).
The study compares production Angular applications using native signals, NgRx
SignalStore, TanStack Angular DB, published SignalTree v15.4.8 and the qualified
unreleased v16 build. It does not authorize v16 publication or change runtime
semantics. All 261 baseline children passed: 87 inventory and 174 dispatch.
The offline analyzer verified complete schedules, raw receipts, conformance and
file bindings. [Full baseline results](baseline-results.md) preserve every
profile and range; [JSON](baseline-results.json) contains exact values and pairs.
The two private application improvements also completed their paired cohorts:
42 inventory and 84 dispatch children, bringing the comparative total to 387.
Conformance controls, profiles and supplemental diagnostics are counted separately.
All 36 supplemental lifecycle children also pass. The application study and
independent review are complete; v16 remains qualified and unpublished.

## Release completed first

[v15.4.8](https://github.com/JBorgia/signal-tree/releases/tag/v15.4.8) was published
from signed `37ef1788f6bac61678fc312f391b180bd7a6bbd7`. All five downloaded npm
archives match the qualified candidate; registry signatures, provenance and fresh
runtime/type/AOT consumers pass. The exact source now serves
[signaltree.io](https://signaltree.io), whose version and visible
edit/server-update/undo trace were checked after production deployment.
The release branch owns its separate
[publication receipt](https://github.com/JBorgia/signal-tree/blob/codex/v15-release-owned-checkout/docs/audits/2026-11-11-v15-maintenance-release/v15.4.8-receipt.json).

The v16 arm uses source checkpoint `1ce1a501383a2570245b68c9ace913ee3e7afc12`,
runtime `2826cc94185b4cccc3717ea1e6370d7bc27cbf27`, and the five-package seal
`sha256-ba5c01b75cd74e50293262f2a324cfe4072353dc845211e5c95e19948b126e05`.
Preparation verifies the v15 registry closure and recomputes the v16 seal before
creating isolated consumers. This study has made no library runtime changes.

## What is automated

The [application lab](../../../tools/application-lab/README.md) supplies production
AOT builds, deterministic inputs, separate application implementations, a test
service, browser drivers, planted faults, calibration, serial comparison,
profiling and offline analysis. Each browser receives the same Angular screen,
viewport and observable task. The common code supplies no rollback or publication
coordinator. Each implementation pays for its own application coordination.

Inventory exercises creation, filtering, selection, editing, validation,
membership changes, retained editors and session teardown. Coordinated dispatch
adds independent optimistic edits, every accept/reject ordering, late previews,
dependent publication, unrelated progress, reentry, entity replacement,
compare-and-set conflicts, delayed success, unknown outcomes, idempotent retry,
payload dismissal and responses after teardown.

| Measurement          | Reported quantity                                                                                                    | Interpretation limit                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Correctness          | Exact intermediate state, rendered state, backend calls and payloads; detected planted faults                        | Bounded registered traces, not complete application semantics                              |
| Startup              | Seed, store factory, bootstrap-to-layout, navigation-to-layout                                                       | Local production browser fixture, not a device-class startup guarantee                     |
| Interaction          | Per-child p95 of synthetic event-to-stable-layout time                                                               | Not INP, paint completion or a pooled population tail                                      |
| Response processing  | Deterministic backend processing, reply delivery, application work and layout; local acknowledgement work separately | Artificial network delay excluded; not client-only response processing                     |
| Memory               | Forced-GC heap checkpoints, pending state, finite aging, teardown before/after late reply                            | Whole app/framework/test-service heap; not library-only retention or unlimited boundedness |
| Attribution          | Separate sampled profiles and overlapping browser duration metrics                                                   | Diagnostic sample weights; not exact function CPU or comparative latency                   |
| Delivered JavaScript | Actual served raw/gzip bytes and build dependency closure                                                            | Includes the common UI and fixture controls; excludes hidden source maps                   |
| Maintenance surface  | Source bytes/lines and explicitly owned responsibilities                                                             | Not measured developer productivity or financial ROI                                       |

The full schedule is written before launching browsers. Five balanced rounds
cover each arm at 1,000 rows with 1x and 4x CDP throttling, and 10,000 rows at 1x.
Separate same-arm v15 duplicate controls characterize repeatability. Timing and
memory dispatch children are separate. Throttling is not a calibrated device.
The host is shared with other development work; raw receipts retain load and
memory observations. No performance SLO is fitted to these results.
Interaction samples retain their initial iterations; no discarded warm-up phase
establishes a steady-state-only claim. Independent source/receipt review found no
invalidating measurement error within these bounded development-study claims.

## Inventory baseline

All 87 scheduled children passed and recorded distinct Chromium browser PIDs.
The table reports the 10,000-row, unthrottled profile. Each cell is the median
across five independent browser samples; an interaction p95 is calculated within
each child before taking that median. Heap uses decimal MB and includes the
whole application. These are development measurements on a shared Apple M4
host, Node 24.15.0 and Chromium 141.0.7390.37.

| Arm                      | Factory ms | Navigation to layout ms | Filter p95 ms | Toggle p95 ms | Populated heap MB | Served JS gzip bytes |
| ------------------------ | ---------: | ----------------------: | ------------: | ------------: | ----------------: | -------------------: |
| Native Angular           |        8.4 |                    57.1 |           6.9 |           3.2 |             6.628 |               38,359 |
| NgRx SignalStore         |        7.1 |                    40.6 |           4.4 |           4.7 |             4.366 |               40,117 |
| TanStack Angular DB      |       45.0 |                   201.7 |          71.2 |           2.9 |            11.000 |              126,564 |
| SignalTree v15.4.8       |       12.5 |                    45.5 |           4.5 |           3.0 |             6.340 |               65,391 |
| Qualified SignalTree v16 |      248.8 |                   285.0 |           4.9 |           4.9 |             7.336 |               86,549 |

The strongest attribution targets are v16 population and this TanStack query
shape's recurring filtering cost. The v16 factory samples span 234.7–254.3 ms;
v15 spans 11.1–18.6 ms using identical consumer source. TanStack filter p95
spans 62.6–97.1 ms. These differences justify investigation; this table alone
does not isolate library functions or select a remedy.

Small interaction differences do not support a fine ranking. Across six v15
A/A pairs, repeat-1/repeat-0 filter-p95 ratios span 0.625–1.344, and factory
ratios span 0.361–1.064. Load-1 snapshots span 21.74–38.14. Those controls are
neither confidence intervals nor a universal noise bound. Post-destruction
heap is nearly unchanged within each arm between 1,000 and 10,000 input rows,
consistent with releasing the larger dataset; finite samples do not prove
unlimited boundedness or identify retaining paths.

Generator: `node tools/application-lab/measure.mjs compare APPLICATION_BASELINE_4 INVENTORY_COMPARISON_1`.
The immutable aggregate `inventory-comparison-1/results.json` has SHA-256
`2b0335f87039624d674e0a5f74818f4fa46daeb36566e4722322e4259e778456`.
Its raw child receipts, schedule, preflight and exact source/build/package
bindings supply the workload and artifact identities. Independent inspection
matched all 87 children against that aggregate and schedule. Offline full-study
analysis passed after completion of dispatch.

## Coordinated dispatch baseline

The 10,000-row, unthrottled profile gives the following medians across five
independent children. Preview is one opening per child. Response columns are
medians of child p95s and include deterministic backend processing, delivery,
application work and layout. Memory uses separate browser children and MiB.

| Arm                      | Factory ms | First preview ms | Accept and publish p95 ms | Ack p95 ms | Populated heap MiB | Pending preview heap MiB |
| ------------------------ | ---------: | ---------------: | ------------------------: | ---------: | -----------------: | -----------------------: |
| Native Angular           |        7.4 |              5.0 |                      12.3 |        0.4 |             10.856 |                   13.546 |
| NgRx SignalStore         |        5.9 |              8.8 |                      15.6 |        0.4 |              5.466 |                    9.805 |
| TanStack Angular DB      |       43.1 |            101.7 |                      25.5 |       22.1 |              7.797 |                   14.366 |
| SignalTree v15.4.8       |       12.6 |              3.0 |                      12.8 |        0.5 |              7.451 |                    9.425 |
| Qualified SignalTree v16 |      230.0 |              4.1 |                      15.2 |        0.6 |              8.092 |                   10.511 |

This workload reveals tradeoffs rather than an overall winner. Native's per-row
signals use more populated heap; SignalTree's full preview adds relatively little
heap, while its pending transactions cost more. At 1,000 rows, v16's 128 pending
commands add about 2.14 MiB against about 1.81 MiB for v15, including the common
test service and command data. Smaller response-time differences need restraint;
v16 construction and TanStack preview/acknowledgement are clearer targets.

All 174 raw dispatch children matched the schedule and aggregate in independent
review. The review also recomputed all 87 timing children's p95s, all summary
sample values and matched ratios. Final post-teardown heap is approximately
constant within each arm across 1,000 and 10,000 initial rows. This supports
release of the larger initial dataset in these traces, not a universal no-leak
claim. Backend logs and reserved IDs make finite in-session growth legitimate;
signed heap deltas alone do not identify a leak or its retaining path.

## Attribution and first remedy

Separate 10,000-row profiles bind the same production builds for inventory and
dispatch on v15, v16 and TanStack. v16 startup samples include frame preparation,
ordinary topology, publication preparation and cloning. TanStack filtering
samples include native query hashing, grouping, sorting and evaluation; its
acknowledgement samples include native proxy deep cloning. Unmapped, GC and idle
samples are retained. These are causal leads, not exact partitions of function
CPU or additional comparative timing samples.

The supported `addMany` initialization alternative was tested on both exact
kernel artifacts before changing an application. Forty fresh Node children
covered two row counts, two release lines, two operations and five balanced
rounds. All exact initial-state and copied-input isolation checks passed. This
is a neutral-kernel diagnostic, not Angular timing.

| Neutral population, including row copies | v15 setAll / addMany ms | v16 setAll / addMany ms |
| ---------------------------------------- | ----------------------: | ----------------------: |
| 1,000 rows                               |           1.810 / 2.285 |         22.665 / 22.135 |
| 10,000 rows                              |          7.191 / 12.192 |       177.263 / 173.604 |

Cells are medians of five process samples. At 10,000 rows, paired addMany/setAll
ratios span 1.286–1.910 for v15 and 0.900–1.210 for v16. The proposed substitution
does not demonstrate a useful v16 reduction and is consistently slower for v15
in this diagnostic. **It is not adopted.** Empty tree creation and first whole-row
read are measured separately, locating most of this neutral diagnostic gap in
population. Neither operation is a general substitute for the other.

The [attribution receipts](attribution-receipts.json) record the commands, logs
and exact profile/probe inputs. The neutral generator is
`node tools/application-lab/population-probe.mjs compare APPLICATION_BASELINE_4 POPULATION_PROBE_1`.
Its forty child results and original sources are preserved with the evidence.

## Improvements tested against the same baseline

The [registered experiments](IMPROVEMENTS.md) change only private TanStack
application code. Original source and artifacts remain frozen. Runtime packages
and SignalTree consumer code remain unchanged. Each new production build passes
the same conformance controls before comparative execution.

Inventory keeps one ordered native query and filters its results in an Angular
computed value, instead of constructing a new query for each search value.
This removes recurring query setup but makes edits invalidate a full local view.
[All paired inventory results](inventory-improvement-results.md) retain the raw
ranges and matched differences. The table reports medians of five child p95s;
the rename changes filter membership. It is part of both arms of this new cohort.

| Profile         | Filter before / after ms | Toggle before / after ms | Membership rename before / after ms |
| --------------- | -----------------------: | -----------------------: | ----------------------------------: |
| 1,000 rows, 1x  |               10.0 / 1.8 |                1.3 / 1.6 |                           1.1 / 1.2 |
| 1,000 rows, 4x  |               37.0 / 7.7 |                5.6 / 5.9 |                           3.8 / 5.2 |
| 10,000 rows, 1x |               51.9 / 2.0 |                1.5 / 5.1 |                           1.0 / 4.1 |

Every matched filter pair improves; every 10,000-row edit pair worsens. At
10,000 rows, the paired median populated heap increases by 958,720 bytes, while
heap after 400 edits decreases by 946,284 bytes. The later 200-to-400 edit
increment is larger in the variant, which required the longer lifecycle follow-up
below. This is a search/edit tradeoff, not an unconditional optimization.

Dispatch moves immutable publication payloads into an application-owned map keyed
by intent ID. Native collections continue to own mutable acknowledgement metadata.
Previously, updating metadata copied the full stored payload through collection
draft machinery. The new map is populated before publication notification and
cleared on dismissal or destruction. Public payloads and transport data remain
equal and detached from later accepted edits.

[All paired dispatch results](dispatch-improvement-results.md) use the original
dispatch child workflow unchanged, with separate timing and memory processes.
These results belong to their own cohort; the baseline table above is not the
denominator for the improvement.

| Profile         | Accept and publish p95 before / after ms | Acknowledgement p95 before / after ms |
| --------------- | ---------------------------------------: | ------------------------------------: |
| 1,000 rows, 1x  |                                2.7 / 2.1 |                             1.8 / 0.5 |
| 1,000 rows, 4x  |                              11.3 / 11.0 |                             7.4 / 2.1 |
| 10,000 rows, 1x |                              22.3 / 16.0 |                            16.2 / 0.6 |

At 10,000 rows, all five paired acknowledgement ratios are 0.0273–0.0397 and
accept/publish ratios are 0.658–0.740. Startup has no demonstrated improvement.
The original memory child never starts a publication; its heap measurements
cannot establish savings from the populated payload map. The supplemental
public-payload checker passes both normal builds and detects its planted missing
payload fault in each. It checks started and acknowledged values, reentrant
progress, later accepted writes, dismissal and late delivery after teardown.

Generators: `measure-variants.mjs`, `dispatch-measure-variants.mjs` and
`analyze-variants.mjs` under `tools/application-lab`; exact invocations and input
hashes are in the linked result JSON and analysis receipts. Same-arm controls
remain separate. Neither cohort pools operation samples across browser children.

## Longer-lived application checks

The [supplemental protocol](LIFECYCLE-FOLLOWUP.md) runs three fresh before/after
pairs at each of 1,000 and 10,000 rows. Both modes pass all twelve children.
These are finite memory/lifetime diagnostics, without A/A or latency claims.
[Full lifecycle results](lifecycle-results.md) and [all matched values](lifecycle-results.json)
retain each checkpoint and every pair; the offline analyzer validates raw stages,
state assertions, schedule/PID completeness and artifact bindings.

Inventory uses an empty filter and edits the same hundred IDs through 400,
1,200, 2,400 and 4,800 accepted renames. Each write and visible title is checked.
At every post-edit live checkpoint, each arm retains the hundred original public row values
sampled before those IDs' first edits; that count does not grow with the number of
edits. The later sampled values collect. All 4,800
sampled values per child are collected after destruction. This is observed weak
liveness, not an internal retaining-path attribution or a universal memory bound.
The pinned DB 0.15.2 local-only sync function closes over its `initialData` in
both arms, providing a source-level explanation for the surviving original
objects. No heap retaining path was captured for them, and this shared behavior
does not explain the variant's additional live-view heap.

At 10,000 rows, median whole-app heap after 4,800 edits is 11.962 MiB before and
12.793 MiB after the inventory change; post-destruction medians are 4.257 and
3.983 MiB. Probe bookkeeping is included. Unlike the earlier filtered cohort,
this empty-filter workload retains the full ordered view. Its higher live heap
reinforces the recommendation to treat faster search as a deliberate tradeoff
for heavier live-view storage and edit work. The change is unsuitable as a blanket
replacement for a frequently edited large inventory.

The publication diagnostic actually starts eight full plans, holds their replies,
acknowledges and dismisses them, then repeats for sixteen total. It checks full
public/transport payload equality, exact starts and attempts, detached history
after accepted edits, and late command delivery after store teardown. At 10,000
rows, median held-eight heap falls from 32.150 to 27.258 MiB. After acknowledgement
it is 27.288 versus 27.286 MiB; after dismissal, 22.448 versus 22.443 MiB. These
include the deterministic backend's retained full-plan copies, so they do not
partition library and backend storage.

The original representation produces two sampled public payload identities per
plan across acknowledgement; the new map preserves one. All sampled public
payloads collect after dismissal in both arms, and remain collected through final
teardown. No final survivor snapshot is required in these completed traces.
The substantial held-state reduction and near-equal settled-state heap support
the payload separation for this application; they do not establish a general
memory-neutral claim for other workflows or unlimited publication history.

Generator: `node tools/application-lab/lifecycle-followup.mjs BASE VARIANT OUT MODE [PAYLOAD_CHECK_DIR]`.
Analysis: `python3 tools/application-lab/analyze-lifecycle.py INVENTORY_OUT PUBLICATION_OUT SUMMARY_OUT`.
The original dispatch-memory cohort remains unchanged and separate.

Independent review identified one remaining boundary: those traces dismissed
payloads before destroying the store. The [additional protocol](STARTED-TEARDOWN.md)
therefore destroys with eight actual started plans still awaiting acknowledgement,
plus one unresolved owner command and a ninth waiting plan. All twelve fresh
children pass. The new representation releases all eight sampled public payload
objects while the old backend is still held; the original representation keeps
them until that backend is released. Both release every sampled object after
the late owner response. There is exactly one backend application, eight starts
and eight attempts, with no ninth publication or restored UI.

[Results and every paired checkpoint](started-teardown-results.json) bind the raw
aggregate. Generator: `node tools/application-lab/started-payload-teardown.mjs BASE VARIANT OUT PUBLICATION_LIFECYCLE_DIR`.
This closes the nonempty-map destruction question for these traces. It exercises
a late command response with acknowledgements outstanding, not delivery of a
late acknowledgement. No final sampled survivor requires a heap snapshot.

## Runtime and tooling verification

Fresh witnesses run against the actual installed SignalTree artifacts used by
the lab. The original point-work counter remains 1,800 visits at both 2,000 and
20,000 rows, below its unchanged 2,000-visit bound; width controls report 4,000
and 40,000 visits. Its planted charge and thrown-`undefined` restoration controls
also pass. Built late-reader/lifetime, frame-packet and clone/publication reentry
witnesses pass. The [receipt](runtime-witnesses-receipt.json) binds all six
commands, their logs, witness sources and installed artifact inputs. These are
fresh focused checks of unchanged packages, not a new full release qualification.

The full repository lint ratchet passes with eleven existing warnings and zero
errors. Scoped application tooling lint adds none. The fresh production demo
command runs successfully through compilation but exits 1 for the existing
initial-size ceiling: 815.62 kB against 570 kB. The prior v16 owner disposition
accepts that cost; this study neither changes the ceiling nor reports it as a
numerical pass. The separately released v15 production build passes its ceiling.
Generator: `pnpm nx build demo --configuration=production --skip-nx-cache`.

## First failures and corrections

All attempts are preserved. A corrected packet is rebuilt and requalified;
failed or incomplete cohorts are not admitted to comparison.

1. The first inventory oracle compared template whitespace literally. Trimming
   surrounding rendered text repaired the assertion; served inventory JavaScript
   stayed byte-identical between those two packets.
2. The dispatch build emitted `dispatch.html` while its server requested
   `index.html`. The builder now names the index explicitly. Those 404s were
   fixture failures, not library failures.
3. TanStack session reset attempted source collection cleanup while live query
   observers still existed. The host now destroys the session injector before
   explicit arm cleanup; the TanStack arm retires dependent queries before their
   source collections and tracks outgoing inventory query generations.
4. The first dispatch calibration found TanStack virtual collection properties
   in a capacity publication payload. The fixture now projects the three domain
   capacity fields explicitly and caches an explicit operation presentation.
   The correctness driver also checks exact transport envelopes and complete
   capacity payloads. Matching visible values alone no longer hides that defect.

These corrections concern this application's integration and measurement code.
They do not establish a general defect in a competing library. Native capability
probes and full application conformance remain distinct evidence.

## Native capability controls

`signaltree-overlap.mjs` passes its eleven traces against the actual v15.4.8
registry kernel and qualified v16 kernel: two single-operation controls, eight
independent-field decision/order cases, and the supported same-field rollback
refusal/retry case. `signaltree-proposals.mjs` separately passes all eight
confirm/rollback combinations for uniquely keyed immutable proposals on each
release line. Each receipt binds the loaded package files and runner hash.

The narrow TanStack local-collection probe passes its single-operation control
on DB 0.15.2 and the separately labeled 1.0.0-rc.1.4 probe. Its overlapping
whole-row optimistic transactions do not implement the requested independent
field rejection: rejecting the older status edit leaves that status in the newer
overlay; rolling back one uncommitted same-key draft also fails the other draft.
These observed wrapper traces motivated separate accepted/proposal state in the
full application. They do not establish how a QueryCollection server refetch
would reconcile, nor do they disqualify the conforming normalized application.

Commands and exact package directories belong to the receipts; these neutral
kernel/collection probes are not Angular application timing results.

## Application responsibilities

Native Angular owns per-row signals and ordered membership. NgRx uses scoped
SignalStore entities. TanStack uses native local collections and live queries,
with explicit query ownership and domain serialization. SignalTree uses EntityMap
and retained native row references; dispatch transactions own immutable proposals
in a separate tree, while accepted values and application outcomes stay separate.

Every dispatch arm still implements server revision/instance arbitration,
optimistic projection eligibility, unknown outcomes and retry, command/intent
reservations, captured publication inputs, detached payloads, acknowledgements,
reentry, pruning and teardown. Native, NgRx and SignalTree serialize started
publications; TanStack can start distinct ready intents concurrently. Both are
valid under the registered traces.

The SignalTree fixture does not use Link as a request outbox. The TanStack fixture
uses local collections and explicit command decisions rather than QueryCollection
refetch or persistence. Results cannot rank capabilities omitted by those choices.
Human maintenance cost, backend durability and production network behavior remain
unmeasured.

The packet source inventory is generated with
`node tools/application-lab/source-inventory.mjs PACKET NEW_OUTPUT_JSON`.
It checks counted source bytes against the prepared packet and verifies shared
files rather than assuming they match. The following counts include imports,
types and comments; they exclude common UI/model/backend code, dependencies,
drivers, tests, forwarding exports, HTML and notes.

| Arm implementation        | Inventory lines / bytes | Dispatch lines / bytes | Combined bytes |
| ------------------------- | ----------------------: | ---------------------: | -------------: |
| Native Angular            |             140 / 3,913 |           492 / 15,421 |         19,334 |
| NgRx SignalStore          |             196 / 5,436 |           590 / 18,118 |         23,554 |
| TanStack Angular DB       |             220 / 6,643 |           606 / 18,991 |         25,634 |
| Shared SignalTree v15/v16 |             103 / 3,277 |           551 / 17,314 |         20,591 |

SignalTree's source is counted once. Its generated two-line public transaction
shim adds 219 bytes for v15 or 213 for v16. The five excluded common
UI/model/backend files contain 1,263 physical lines and 37,646 bytes. These figures
inventory this implementation's maintenance surface; they do not establish which
library makes teams faster or saves more money.

## Application and business interpretation

For ordinary Angular inventory screens, native signals and NgRx offer credible
low-cost implementations; v15.4.8 also performs well in these tested interactions
while preserving the existing SignalTree contract. Staying on the maintained v15
line is a reasonable choice when that contract meets the application need.
The study does not establish a migration payoff merely from choosing a newer
major version.

The v16 ordinary construction premium remains substantial at 10,000 rows. Its
earlier release qualification and accepted cost disposition remain in force;
this application study neither erases that premium nor proves it unavoidable.
The cheap `addMany` alternative failed to provide a dependable reduction, so it
was rejected without changing the runtime. Further population work should target
the profiled frame/topology/publication preparation and must preserve the
[qualified behavior](../2026-11-10-v15-v16-followthrough/README.md), including late
readers, reentry, entity lifetime and the original point-work bound. It would be
a new runtime experiment, not a conclusion supported by these consumer changes.

The coordinated application demonstrates that each arm can implement the stated
business workflow. It does not compare every native guarantee: SignalTree uses
application-owned immutable proposals and an outbox rather than Link, and
TanStack uses local collections rather than server-refetched query collections.
Accordingly, it cannot price the entire v16 contract or rank synchronization
products from these results alone.

The concrete business benefit of this lab is making tradeoffs inspectable before
deployment. A search-heavy inventory may tolerate more expensive edits; a dispatch
screen may benefit from cheap acknowledgement transitions while retaining its
publication data until dismissal. Small ordinary stores may never notice the
large-population cost. Actual device latency targets, network behavior and the
team's implementation/incident cost decide whether those differences matter.
No revenue, labor savings, developer productivity or production incident reduction
was measured here.

The automation can be repeated on an application's real data shapes and supported
devices: keep its observable success criteria, pin each dependency and artifact,
record startup and interaction distributions, separate pending/settled/destroyed
memory, then profile the largest cost and test one matched change. Keep unfavorable
results and prove the checker detects a deliberate defect before trusting a green
comparison. The lab supplies that execution path; a scheduled CI service has not
been installed by this task.

## Evidence and disposition

The [evidence archive](application-evidence.tar.gz) contains 3,210 distinct file
payloads, preserving raw results, schedules, source versions, exact dependencies
used by the builds, served applications, profiles, package archives, controls and
first failures. Its [checksum](application-evidence.tar.gz.sha256) and
[verification receipt](verification-receipt.json) bind the final artifact and
actual checks. The standalone verifier succeeds after extraction; deliberate
payload corruption and removal both fail. The [independent review record](REVIEW.md)
describes the questions, corrections and bounded dispositions.

```sh
python3 tools/application-lab/archive-evidence.py verify docs/audits/2026-11-11-application-comparison/application-evidence.tar.gz
python3 tools/application-lab/archive-evidence.py extract docs/audits/2026-11-11-application-comparison/application-evidence.tar.gz /tmp/signaltree-application-evidence
python3 /tmp/signaltree-application-evidence/archive-evidence.py verify /tmp/signaltree-application-evidence
```

The manifest maps original paths and historical hashes to content-addressed
payloads. Final narrative/controller documents and this verification wrapper
remain in Git outside the archive to avoid self-referential checksums. Integrity
does not establish signed authenticity, complete Git history or availability of
every dependency and browser binary required to rebuild on a new machine.

**Complete:** v15.4.8 is released and deployed; the five-arm application lab,
registered metrics, full comparisons and evidence-led private improvements are
implemented and verified. The payload representation is retained as the preferred
private dispatch variant. The inventory alternative remains opt-in for its stated
tradeoff. The unhelpful SignalTree population substitution is rejected. No library
runtime, acceptance ceiling or public API is changed by this study. Remaining
limits are stated above; they are not hidden behind a claim of universal coverage
or a newly manufactured release verdict.
