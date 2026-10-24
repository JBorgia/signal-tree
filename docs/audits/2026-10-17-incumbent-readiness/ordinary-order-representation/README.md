# Ordinary placement: finite representation check

October24,2026. Starting evidence/controller commit:
d441aa0ab6ab2b7c461a082cf8ecdd3e444dc8cd. Native source remains frozen/rejected;
production87f6831fa60cafe87508f0ace84b7638698ca3b0 and accepted slice1 are unchanged.
B remains closed. No native patch or later-slice execution followed this check.

## Result

Both concrete representations express the missing ordinary placement facts in the
four preserved failures. Neither is selected as a native implementation. The
snapshot is a useful complete reference with collection-sized divergence costs.
Sparse facts avoid those capture copies for local changes, but the tested sparse
drain still scans every current exception. Thus the finite semantic mechanism is
supported; universally local settlement/cleanup and native integration are not.

The required mechanism has two inseparable parts:

1. Source-owned ordinary placement survives physical inspection changes.
2. The complete authored placement is prepared before capture/installation, not
   reconstructed after a compound operation has already committed its membership.

Storage alone cannot repair early capture of prepend's pre-placement tail. A
consumer filter cannot recover ordinaryABC after capture already borrowed C/X
as B's ordinary neighbors. Snapshot and sparse models use the same prepared
ordinary-before/after facts and inverse/redo consumers; neither receives ABC as
an inverse target from the fixture. The physicalCAB realization is deliberately
supplied separately to both: general native physical-compilation correctness is
outside this experiment, not a new ordering-policy choice.

## Ordinary order lifecycle

| Question | Required rule |
| --- | --- |
| Where established? | Construction and ordinary authored/realized installation establish ordinary order. It can share physical slots only while order agreement is maintained. No current Link relationship or optional history is required. |
| Inspection? | Before changing physical adjacency/presence, retain the ordinary facts it could invalidate. Full physical reorder can change many survivor edges despite identical keys/membership. |
| Ordinary edits? | Read ordinary-before through its representation; apply explicit authored membership/placement/key intents, deriving ordinary-after privately. A rekey/field edit does not implicitly author order. Full reorder is a distinct broader operation. |
| Inverse/redo? | Capture immutable lifetime-addressed ordinary placement facts in operation order, separately from physical realization. Whole operation installs before callbacks; nested operations get later facts. Inverse and redo consume those facts, not current display or a whole saved transaction baseline. |
| Release? | Release an ordinary exception only when its represented presence/key/value/links agree with physical state; retain any live inverse/history evidence independently. No key-equality shortcut. Current divergence remains necessary after pending drain. |

SOURCE-INVENTORY.md identifies exact native lines. EXISTING-ORDER-STORAGE.md shows
why neither physical StructuralStore nor a relationship-local Link projection is
an existing source-owned ordinary-order authority. Link can legitimately adopt
inspection present before its connection; it must not become the source's oracle.
INFORMATION-BOUNDARY.md explains why identical physicalCAB can correspond to
different ordinary histories and therefore needs retained distinguishing facts.

## Concrete alternatives

**Retained snapshot:** while order agrees, share current physical source. Before
first divergence, privately fork the full ordinary sequence/records. Ordinary
operations during divergence update that representation and derive source facts
from it. This implementation copies/scans the retained map/sequence during private
preparation, and scans it for convergence cleanup. No permanent independent write
entry point or second settlement engine is supplied.

**Sparse placement/presence facts:** share physical slots only under a maintained
agreement invariant. Before EVERY physical patch installs, freeze all ordinary
records whose physical slots will change, including reciprocal adjacency and
head/tail. Apply ordinary edits to that staged ordinary view. Normalize touched
facts against the installed physical patch using complete fact agreement. An
inspection-created lifetime has explicit ordinary absence; a removed ordinary
lifetime can remain ordinary-present. No business-key fallback retargets identity.

The sparse mechanism's correctness induction depends on complete physical patch
coverage. One unregistered move/reorder invalidates fallback safety. A full reorder
may require collection-sized exceptions. The tested implementation additionally
scans all current exceptions at drain; local pruning has not been implemented or
qualified here. It must not be credited as an existing optimization.

## Executed evidence

Expected fixtures and design were written before execution. First execution passed
26 fixture runs (13 per representation): the four source failures, ordinary field
preservation, order-neutral rekey, removed/replaced/unavailable anchors, explicit
full reorder/ABA, approved interleaved-order refusal, preparation failure and
stale-plan/reentry. The order refusal is a finite shared harness gate, not a new
ownership engine. Model facts already contain final prepend placement before
installation; callbacks see the complete unit and history is captured before they
run. Redo does not rerun callbacks.

Root replayed the harness on copied frozen sources; its complete RESULTS.json
matches the first execution. Root separately ran25 interleavings per representation
of physical-only reorder, ordinary remove/insert, later independent field and
inverse; ordinary order and foreign fields survive. Independent review replayed
26 fixtures and added two fallback/live-lease controls, retaining one obligation
while another drains. No model assertion was changed after a failing run; there
was no semantic first-red in this finite model execution. Native first failures
remain preserved at the parent evidence, not relabeled as native passes.

Final independent verdict: both express the four missing-information cases within
the declared scope; no hidden ordinary expected-target oracle was found. Model
passes are representability evidence, not qualification of the rejected native
capture, publication, history, lifetime or framework paths.

## Work and retention measured from the outset

Node24.15.0. Selected event counts, not milliseconds, bytes or CPU ratios.
The same fixed local sequence runs among N unrelated current entities:

| Representation | N | Ordinary sequence visits | Ordinary map entries copied | Cleanup records scanned | Ordinary records retained after drain |
| --- | ---: | ---: | ---: | ---: | ---: |
| Snapshot | 16 | 80 | 64 | 16 | 16 |
| Snapshot | 256 | 1,280 | 1,024 | 256 | 256 |
| Snapshot | 1,024 | 5,120 | 4,096 | 1,024 | 1,024 |
| Sparse | 16 | 0 | 0 | 5 | 4 |
| Sparse | 256 | 0 | 0 | 5 | 4 |
| Sparse | 1,024 | 0 | 0 | 5 | 4 |

These are whole fixed-sequence counts, not per-write costs. Initialization,
full-order descriptors, verification walks and retention reads are separately
recorded in model/RESULTS.json. Sparse fixed-local sum of selected work events
is1,283 at each tested N; that sum combines unlike operations and is not a speed
measurement. Explicit full reorder processes its specified members for both.

Negative locality control: after full inspection reversal, a later local point
operation/drain scans16/256/1024 current records in BOTH models. Root's separate
ROOT-COST-BOUNDARY.log reproduces this, separating capture from cleanup. Sparse
capture avoids the snapshot map/sequence copies, but its drain is O(k) where k
is all retained exceptions, potentially N. Do not call that bounded point cleanup.

Churn1/8/32 with one live recovery lease returns internal leases/facts/recovery
identities/ordinary exceptions to0 after drain, with4 current physical members
including the final new member. Held retired identities remain separately counted
and cannot field-write/rekey the replacement. In contrast, current ordinaryABC /
physicalCAB legitimately retains divergence data after drain. These are distinct
retention classes; neither is a process-GC measurement.

MEASUREMENT-NOTES.md qualifies external retained facts/prepared closures, logical
lease counts versus unique objects and a raw external-descriptor label that counts
only3 base descriptors, excluding2 other explicit fixture roots. Those reporting
limits do not change the internal work/scanning results. No favorable resampling
or optimization rerun replaced the negative cleanup result.

## Scope and recommendation

Keep the snapshot as a reference representation. Sparse preservation is the more
promising source-state mechanism for local capture, but the tested implementation
is not a production choice: broad cleanup remains, lifetime admission and key
collision preflight are trusted upstream responsibilities, and the universal
physical-patch seam is modeled rather than integrated. No general transaction
engine, arbitrary foreign-field inversion, backend reconciliation, native GC,
framework timing or physical-placement compiler is proved.

This is more than private inverse-handoff plumbing. Native work would need a
source-owned ordinary-order agreement invariant across all physical installation
paths, plus complete compound placement before admission. It must preserve the
existing sole settlement authority and notification protocol. Current scope
approves this finite check only; it does not lift the recurrence stop or authorize
that native source-state migration. No downstream neighbor/output exception is
justified. Later slices remain gated; no API, ceiling, merge, push, activation or
publication change is made.

## Exact replay and identities

Model SHA256:bdb00609a27f104d3de837c644050741d403e1bf6c5ff138ad8463414af6edff.
Harness SHA256:7e944eb44c3bcf3a668531324716c725e70483029de95ba81778374c6c28032b.
Complete preregistration/source hashes: model/PRE-RUN-FREEZE.sha256.
Extract evidence.tar.gz and run with Node24.15.0:

    node model/run.mjs
    node root-replay.mjs
    node root-cost-boundary.mjs

run.mjs writes model/RESULTS.json; copy the extracted model first if preserving
the original raw output. FIRST-RUN.log, root/independent copies, source/fixture
hashes and independent review are archived. These standalone research models do
not execute native tests. No native or broad suite rerun was warranted by this
representation-only check. Native source manifest remains unchanged at
 d1ff7c33a380d578390879a79e142950d0655920710a818af7d49fe2a017521b.
