# Deferred entity publication activation

Owner-authorized follow-up to runtime `7ab6cbcc70bf5abe9c5070e38a51bd0229ed1830`
and controller `aed4775434b843294310c227e27dc6134f027fb7`. The scope is legacy
cleanup and automatic per-collection publication activation within a tree,
with all existing semantic guarantees. No public option, export or package split
is introduced. Ordinary scalar publication remains on its established path.

## Implementation and necessary boundaries

Keep collection interception and identity from construction. Only a positive,
unobserved, ordinary prefix outside owner/input/declaration scopes can defer
participant allocation. Its state is represented by the collection owner's
private current data. A snapshot, input capture, recipient, removal, inspection,
restoration selection, owner/frame or supplied-input obligation activates the full
participant. Activation is monotonic. Transaction-enabled operations may activate
immediately; this is not a promise of savings for every store.

The seed preserves native view identity semantics and the distinction between
virgin initial state and neutral authored state with an empty historical window.
It reads admitted data properties without invoking getters, preserves the original
source revision, and releases the seed closure after successful materialization.
A still-cold destroyed source retains the evidence needed by held late inputs.

Deferred units retain global delete/write/add ordering. A foreign owner opened
by another preparer triggers promotion without replaying a user updater. Promotion
preserves the original neutral owner/input/frame scopes; only the pending-owner
window is sampled at finalization. A capture after sealing can force allocation
but cannot widen that already sealed window. A directed eager/deferred control
first reproduced a late-frame acquisition error; the corrected preparation modes
pass that control. Representation tests demand evidence before asserting its
allocation and still require retirement. The original point-work bound is intact.

## Independent repair and cleanup

`7d51fb13b` fixes a baseline failure at 10,000 rows by 32 fields: root snapshot
collection spread about 340,000 views into a function call and exceeded the
engine's argument limit. Iterative appends retain every view and its order. The
same fix is present in the comparison reference and candidate. The exact public
shape and saved snapshot isolation have a regression test.

`dd0702f69` removes the unreachable audit tracker, its private diff helper, and
obsolete tracker-only checks. The historical verifier now explicitly reports
that it is archived. v16 serialization had already been removed. Supported public
behavior is preserved; this cleanup is not presented as a runtime speedup.

## Cost decision

Retain the automatic mechanism as a targeted cold-population optimization.
The measured complete workflows include first activation, active use, full
replacement histories, transactions, restoration, ordinary-state and module-absent
controls, teardown, separate CPU/explicit-GC heap children, and planted faults.
Cold retained-heap savings are substantial; most disappear after a full snapshot
requires the evidence. First activation costs more. Consumer bundles grow.

The wide, initially linked history workload has adverse A/B CPU observations.
Exact same-artifact controls show still larger variation and profiles show shared
hotspots; the investigation does not establish a candidate-specific cause or
active-path nonregression. Retain those adverse samples and the heap outlier.
The benefit/cost decision does not claim a universal speedup or permanent memory
reduction, and does not reinterpret numerical release ceilings as passes.
A stricter active-wide performance guarantee would require controlled-host
measurements beyond this bounded local investigation.

The complete generating commands, source/build identities, raw observations,
controls, failed attempts and independent interpretation are recorded in the
[central study](https://github.com/JBorgia/signal-tree/blob/codex/publication-activation-study/docs/audits/2026-11-17-publication-activation/README.md).
The corrected development kernel suite passed 686 files with 7,395 passing tests,
five expected failures and twelve skips. Final committed-candidate qualification
is recorded separately. No tag, registry publication or deployment is selected.

## Final qualification and exact costs

Qualified source: `5801008ea4ca591b3be483e8bbb0aa02e15f59ed`. The initial normal
registry at `e48c8fcf2` passed 83/87 gates. Focused corrections resolve three lint
warnings, explicit allocation in the active-evidence GC test, and the emitted
registration mutation anchor. Spec types and the new cold-source pin/release case
pass. Covered normal scope is 86/87; the bundle ceiling remains failed. All 87
mutation checks pass with exact restoration. These are recorded runs plus
corrections, not a fabricated single all-green run.

Fresh five-package construction and canonical packing join all 193 shipped
payloads to the build and archive journal. Strict installed types, Angular AOT
and facade/SSR pass. All 144 final kernel payloads equal the measured candidate's
bytes. Against the corrected eager reference, only five kernel JavaScript files
change (+5,316 raw package bytes); declarations, manifests and four facades are
unchanged. Canonical gzip is bare 18,407 production / 20,785 development bytes
(−2 / 0 versus reference), entities 45,595 / 49,365 (+351 / +351). The broader
loaded neutral-workflow consumer grows 884 gzip bytes; fixture compositions differ.

All 137 demo behavior checks pass without skips or flakes. The strict production
build remains numerically failed at 827.15 kB initial total, and the browser size
assertion fails at 801,461 main-script bytes versus 570,000. A temporary budget-only
override emitted the behavior-review artifact and was restored byte-for-byte.
Both lines' passing/grown/restored fixture controls return 0/1/0; malformed packed
receipt controls are rejected. No gate ceiling or semantic test is weakened.

Retain this artifact with its specific cost exception under the owner's
cost/feasibility instruction. This is completed local qualification with explicit
numerical failures, not an all-green release-gate claim or npm publication.
The central study preserves first failures, source identities, fresh logs and raw
measurements. Documentation-only successors do not replace the artifact identity.
