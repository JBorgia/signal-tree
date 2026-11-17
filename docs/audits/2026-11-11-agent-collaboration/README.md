# Human/agent collaboration and expanded application comparison

Fresh execution November 16–17, 2026; the investigation began November 11.
The [protocol](PROTOCOL.md) preserves the previous study and distinguishes native
guarantees, application integration, equivalent observable work and external services.

The selected v16 collector substantially reduces whole-history capture work.
The supported public agent/user workflow passes on both baseline and successor,
including an explicit repair to application recovery after entity replacement.
Ordinary application startup remains considerably more expensive than v15. The
expanded comparison finds much smaller differences in the measured user-response
path, and exposes first-context and pending-memory costs that startup alone misses.

Keep the collector and the existing v15 maintenance improvements. Keep the
operation/backend layer optional. Do not introduce a new public configuration
matrix or weaken late-reader, ownership or restoration guarantees to manufacture
a faster ordinary-store result. The [AI readiness assessment](AI-READINESS.md)
defines the demonstrated capabilities and unproven product obligations.

## Exact candidates and fresh evidence

| Role | Identity |
| --- | --- |
| Previous completed study | `8dd709401a9dfb038b14a6c12394b4d4fc248a0f` |
| v16 matched baseline | `5d04ff65d2eaab1986ed1b420cbc013edc01542b` |
| Selected v16 runtime | `2c439198b13a93ede29e7bece69a07a534f30797` |
| v16 branch checkpoint including evidence tools | `2810528ef760c5c5a8ecda788f32c168f59d0470` |
| Prepared v15.4.9 source | `da2e92ccab46747471cae810fb9221f563d0a906`; runtime `0d2b9619206ab9e7a7af998944e744f6d2b6e492` |

Installed consumers bind actual archives and payload inventories, not only commit
labels. The v15 clean rebuild reproduces all five preserved candidate archives
byte for byte. The new application packet binds the prepared artifacts and all
197 freshly built v16 package payloads. Its Angular facade's sixteen packaged
payloads match the baseline; the additional built-only declaration stub is not a
new exported capability.

Temporary-directory cleanup during the pause removed this phase's earlier raw
measurements. They are not used as fresh evidence. The predecessor's committed
archive survived and was verified; selected inputs were restored by exact hash.
Fresh toolchain installation verifies the pinned manifest, lockfile and required
dependency bytes. New results, original failures and installed consumers are
preserved in persistent storage and the accompanying evidence archive.

## Selected native capture improvement

The old whole-input path expanded packed historical subjects before deduplicating
their requirements. The new path collects ordered unique requirements directly
from exact packed runs. It preserves first occurrence order, reference identity,
fresh capture objects and fresh owner sampling. Snapshot/exclusion, physical
views, addressed capture and public captureViews paths are unchanged.

| Twenty whole-input captures | Baseline CPU median | Successor CPU median | Interpretation |
| --- | ---: | ---: | --- |
| Homogeneous history | 21.103 ms | 3.251 ms | All five matched pairs improve; executed fact visits fall from 400,000 to 400 with unchanged logical coverage |
| Mixed history | 6.469 ms | 4.399 ms | All five matched pairs improve |
| No history | 10.251 ms | 10.648 ms | No dependable improvement; paired median difference −0.246 ms |
| Tiny calibration | 10.400 ms | 9.797 ms | Paired CPU difference is inside the observed A/A variation |

Mixed-history paired CPU saving is 1.998 ms versus an observed A/A difference of
2.188 ms. All five matched wins support the direction but do not establish an
improvement beyond that same-build variation. The large homogeneous saving is
the strongest capture result.

The no-history run retains one adverse successor sample: elapsed 63.052 ms and
CPU 23.885 ms. Its cause is not established; it is not discarded or labelled GC
noise. Homogeneous post-GC heap with captures held has a positive paired median
of 473,560 bytes, range 202,968–706,968. This is a whole-process checkpoint, not
identified retained library state. The change is not a demonstrated heap win.

A separate three-child GC diagnostic observes allocated-field totals of
27,040,896 bytes for baseline and 15,190,560 for the successor, with one versus
zero automatic GC events. The planted retained-array control adds 3,967,032 bytes.
These instrumented fields are not exact total allocation or an explanation of
the uninstrumented outlier. Immediate heap cannot substitute for allocation.

The unchanged original point witness remains at 1,800 visits for both 2,000 and
20,000 rows, under its original 2,000 bound; all sensitivity controls fire.
Canonical bare/entity production/development gzip fixtures are exactly unchanged
between baseline and successor. This does not imply every generated file or
consumer bundle is unchanged.

## Six-way production application comparison

The fresh cohort contains 136 complete children: 120 main and sixteen v15 A/A
children. There are five rotated rounds per arm, row count and measurement kind.
Timing and forced-GC memory use separate fresh Chromium processes. Twelve
calibration children are excluded. Nine metric controls and twelve analyzer
admission cases pass, including rejection of omitted measurements, wrong A/A
classification, changed payloads and false source identity. All 36 inventory
and 66 dispatch conformance cases pass before measurement.

Pinned peers remain Angular 22.0.7, NgRx SignalStore 22.0.1 and the exact TanStack
versions from the predecessor packet. The private TanStack arm is an application
strategy variant, not an upstream library release. These are controlled pinned
comparisons, not a survey of the latest releases or every implementation.

These common dispatch applications implement review and remote outcomes through
an explicit application protocol. Their production maps omit Link's runtime and
native entity factory; v16 still includes ordinary publication admission work.
The full native Link guarantees are qualified and costed in separate native
experiments, and exercised functionally in the installed public workflow. The
table below is not a performance comparison of six complete implementations of
every stronger native guarantee.

At 10,000 dispatch rows, forty rendered, medians across five children:

| Implementation | Navigation to layout | User enqueue-to-layout p95¹ | First full context² | Repeated full-context p95² | Populated heap above blank³ |
| --- | ---: | ---: | ---: | ---: | ---: |
| Native Angular | 35.4 ms | 10.6 ms | 4.6 ms | 3.3 ms | 10.335 MiB |
| NgRx SignalStore | 31.8 ms | 10.0 ms | 5.7 ms | 2.9 ms | 4.946 MiB |
| v15.4.9 candidate | 44.4 ms | 10.5 ms | 35.2 ms | 8.8 ms | 6.935 MiB |
| v16 successor | 197.6 ms | 11.5 ms | 26.6 ms | 8.0 ms | 7.576 MiB |
| TanStack original | 75.0 ms | 11.1 ms | 3.5 ms | 3.1 ms | 7.273 MiB |
| TanStack private variant | 70.0 ms | 10.5 ms | 3.5 ms | 2.9 ms | 7.273 MiB |

¹ Median of each child's p95 over twenty scripted user actions during 180 checked
interleaved commands. It is not pooled latency, real-user INP or a general input
responsiveness guarantee. The v15 A/A user p95 differs by 9.7 ms in one 1,000-row
pair, larger than many cross-arm differences. Small rankings are not dependable.

² Materialization plus serialization. UI has already read forty rows. Full
context follows twenty-one selected-context reads in timing children; memory
children perform one selected and one full read. v16's apparent first-full win
over v15 is sensitive to that ordering and variation: memory-child medians are
near equal and a timing A/A difference reaches 11 ms. No intrinsic v16 context
advantage is established. Sub-millisecond selected-context observations encounter
browser timer resolution.

³ Whole app/framework/library heap after three collections with host-task
boundaries, minus a blank page. This is not per-library retained size, peak
allocation or proof of leak freedom.

The startup premium is robust within this cohort: matched v16 minus v15
navigation differences are +140.1 to +159.8 ms. Store-factory medians alone are
10.6 ms for v15 and 159.5 ms for v16; the intervals overlap navigation and must
not be added. At 1,000 rows, navigation medians are 26.4 and 47.3 ms respectively.
The common workload does not demonstrate v16 amortizing its startup premium.

Full context contains the same checked 1,628,337 bytes in every 10,000-row arm;
fifty-row context contains 7,829 bytes. Selecting relevant rows is a meaningful
application optimization. Local bytes are not model tokens or model-quality
evidence. After dropping both contexts, observed heap deltas are +2.376 MiB for
v15 and +2.745 MiB for v16; demand-created readers/caches belong in the cost model.
The negative TanStack delta is a signed checkpoint observation, not negative
allocation or a ratio denominator.

| 128 pending independent commands, 10,000 rows | Stage elapsed | Settle elapsed | Pending heap above fresh populated checkpoint |
| --- | ---: | ---: | ---: |
| Native Angular | 205.7 ms | 215.6 ms | 0.498 MiB |
| NgRx SignalStore | 207.3 ms | 265.0 ms | 0.527 MiB |
| v15 | 217.9 ms | 215.7 ms | 1.177 MiB |
| v16 | 220.3 ms | 225.3 ms | 1.503 MiB |
| TanStack original | 213.9 ms | 218.3 ms | 1.044 MiB |
| TanStack private variant | 211.6 ms | 231.2 ms | 1.043 MiB |

Each pressure level starts a fresh document. Every optimistic value, pending
record, server decision and accepted effect is checked. Unresolved dismissal
must preserve work; settled records are dismissed. Heap includes retained test
service logs/receipts. Settlement is not expected to return the whole process to
its pre-operation level; those deltas alone cannot establish a kernel leak.

Whole-trace throughput medians range roughly 233–249 checked commands/second at
10,000 rows. This includes driver, validation, service work and deliberate event
loop scheduling; it is not isolated state-library throughput. Active frame-gap
p95s remain around 16.7–16.8 ms in this workload. They are callback observations,
not a dropped-frame count. CDP task/script/layout/style durations overlap and
are reported separately rather than summed as CPU.

All twelve fresh inventory/dispatch executed JavaScript bundles are byte-identical
to the predecessor study's corresponding bundles. Generated filenames and source
maps differ; HTML matches after the filename substitution. Thus this collector's
native history benefit does not become an ordinary-application speedup. Earlier
inventory timings remain explicitly historical evidence for the same executed
code; they are not relabelled as a fresh timing cohort.

## Implementation burden and optimization judgment

The source inventory counts dispatch arm code at 492 physical lines for native,
590 for NgRx, 551 shared by v15/v16, 606 for TanStack and 621 for its private
variant. Common UI/backend/model code, dependencies, tests and drivers are
excluded equally. SignalTree is not shortest in this fixture. These counts
describe implementation shape, not developer productivity or correctness cost.

The public HTTP reference adds real recovery and authority integration; it is
not part of the six-way timing application. No competitor is credited with
v16's complete native guarantees merely because common outcomes pass, and no
competitor is declared deficient for using an explicit application protocol.

Separate source-mapped startup profiles are attribution evidence, not comparative
timing samples. They retain raw stacks, mapping coverage, idle/GC/unmapped samples
and browser telemetry. In the v16 inventory/dispatch profiles, `setAll` appears
in the ancestry of 129/187 and 138/200 samples; frame preparation appears in
104/187 and 113/200. These overlapping stack counts are not CPU percentages.
The remaining work includes ordinary topology, structural records, cloning and
immutable metadata. Both apps omit Link's native factory: per-tree Link selection
alone would not remove this observed ordinary startup gap.

History inspection found v15's delivered-notification gate deferred in v16. A
blind fresh-add port is rejected after concrete falsification. Four installed C1
baseline witnesses pass; all four isolated mutant cases fail their expected
assertions. The raw outcomes show lost enqueue-only evidence, observer enrollment by a
post-install getter, that getter's completed nested write, and delivery to a listener enrolled
by publication completion. The getter checks whether the row is installed; the
test does not demand an arbitrary number of reads. No measured C1 source or
artifact was changed.

This rejects that shortcut, not every possible demand-aware implementation. A
future narrower design must preserve enqueue demand and all relevant callback
boundaries, then demonstrate savings after its routing/storage costs. The source
profiles do not prove that all remaining preparation is unavoidable, nor that a
metadata-only gate is worthwhile. No new option or unsafe gate is adopted, and
the completed C1 application cohort remains the final measured runtime here.

## Validation and publication boundary

The v16 affected qualification passes 7,287 kernel tests, all framework projects,
types, four built witnesses, the original point bound and 175 demo tests. Eighteen
of nineteen affected gates pass. The numerical bundle gate remains red; the
strict production demo is 822.69 kB against its unchanged 570 kB ceiling. These
costs are explicit, and affected checks are not a new full release-registry run.

The v15.4.9 maintenance candidate completes fresh 90/91 normal release gates,
91 mutation proofs, exact source restoration, clean rebuilding, strict installed
consumers/AOT, production demo and 146 browser checks. All five canonical archives
match the compared artifacts. The specific 40.2-byte production and 113-byte
development entity-gzip excess remains numerically failed and economically
accepted under the owner's cost/feasibility instruction. The
[v15 preparation record](https://github.com/JBorgia/signal-tree/blob/codex/v15-maintenance-release-prep/docs/audits/2026-11-11-v15-maintenance-successor/README.md)
keeps the source seal, fresh registry inspection and exact-artifact limits.
This investigation does not publish a version, tag, merge or deploy
a site. Review branches remain separate. The prior qualified v16 release baseline
is preserved; publication still requires the selected release procedure on exact
artifacts.

The demo/Vercel request is recorded in TODO: every future demo-site update must
review every demo for clarity and verify successful relevant deployments and the
intended live site. This phase changes evaluation consumers, not the production
demo site, and does not claim a new Vercel deployment check.

## Evidence and reproducibility boundary

The [evidence index](EVIDENCE.json) identifies the archived raw commands, exact
packages, source/build bindings, all comparative children, controls, failures,
profiles and independent reviews. The archive verifier checks supplied payload
integrity and declared reference closure. Opaque records remain hash-verified
bytes: their logical-content digests, deliberately corrupted labels or historical
unavailable references are not represented as fresh file-payload dependencies.

The four ordered archive parts total 291,574,237 bytes. Reassembly and standalone
extraction verify 50,567 original/version mappings and 21,119 unique payloads.
Corrupted and missing payloads are rejected, and the restored archive verifies.
The [verification receipt](evidence-verification/result.json) retains an initial
control-driver error-message mismatch; the archive and verifier were unchanged.

The complete predecessor archive stays separate and unchanged. A verified copy
of its manifest is provenance; the new archive follows the exact historical
inputs actually needed by fresh schedules. It does not silently import every
old measurement or claim complete Git history and a reproducible installed
environment. Original paths are identities, not extraction destinations.

Exact source fragments and original AppleDouble archive-member bytes were
materialized from their identified sources to close supporting digest references;
that is byte derivation, not a new timing run. Failed packaging attempts remain
recorded. The final report, evidence index, archive verification and final
documentation checks are versioned outside the archive's self-hash cycle.

Readable companions are [complete metric summaries](metrics-summary.json),
[source inventory](source-inventory.json), [capture analysis](capture-main-analysis.json)
and [tiny calibration](capture-tiny-analysis.json). Their original bindings remain
intact. Use the evidence index's commands to verify or extract the archive.
