# Architectural alternatives — admission screen

General release remains HOLD. The owner supplied the [architectural review](SOURCE-REVIEW.md)
after the attribution branch was pushed. Its first suggested experiment is
`V16-SPARSE-RESPONSIBILITY-0`, marked PROPOSED. This phase investigates that
contract-preserving family; it does not select a replacement implementation or
change the product contract. The measured candidate3eabc01dd/runtimefe18 and the
pushed attribution baseline9a9770a63 remain unchanged.

## New findings

The original counter now has an actual published-artifact comparator:

| Shared counter workload | Released v15.4.4 | Frozen v16 |
| --- | ---: | ---: |
| 200 distinct updates,2-field rows,2,000 rows | 800 | 13,000 |
| Same writes,20,000 rows | 800 | 13,000 |
| Existing `<2000` assertion | Passes in this comparison | Fails |

Generator: [shared counter harness](../../../tools/runtime-representation-selection/counter-child.mjs),
using the verbatim original counter compiled from TypeScript, Node24.15.0 and
`ngDevMode=false`, one fresh process per arm. Every updated endpoint and an
untouched row are checked outside the counter interval. Known7-charge,
throw-undefined/patch-restoration and collection-width copy controls pass.
[Raw comparison](RELEASED-COUNTER-COMPARISON.json) and [registration](V15-COUNTER-PREREGISTRATION.json)
remain separate from CPU/heap measurements. No CPU ratio follows from visits.

A new source discriminator samples the same counter immediately before each
native participant preparation. Both tested sizes show exactly25 preceding
charges/write: **5,000 before native field/window preparation**, within13,000.
See [raw prefixes](PREFIX-COUNTS-CORRECTED.json), [registration](SCREEN-PREREGISTRATION.json)
and [fixture](../../../tools/runtime-representation-selection/prefix-screen.spec.fixture).
The original55-path ledger's first23 entries reconcile those5,000 charges:
value/equality, topology, footprint/packet construction and admission.

A replacement restricted to native windows/proofs/field maps cannot meet `<2000`
while leaving this prefix unchanged, even if every subsequent charge disappeared.
At least3,001 of those prefix charges would also need to disappear to clear it.
This is a **scope limit for that restricted implementation**, not a5,000-visit
semantic minimum or a rejection of sparse representations. No work may be moved
outside the measured task merely to obtain green. No prototype has been run.

## Fresh ordinary-cost baseline

Published `@signal-tree/kernel@15.4.4` was identified directly from npm metadata,
downloaded and verified against registry SHA512 integrity and SHA1:109 files.
No registry signatures/attestations are claimed independently verified. Frozen
v16's193 artifact files match the existing fe18 build seal. Registry/artifact
manifests and exact tarball are retained in the evidence packet.

A finite24-child campaign uses unchanged prior harness operation bodies:
three profiles, two separate released-v15 A/A controls and three alternating
comparison pairs per profile. All24 children pass their assertions and resource,
source/artifact/dependency checks; no owned survivors or global stop are recorded.
Generator: `baseline-cost/campaign.py` and `analyze.py` in the evidence archive;
[registration](BASELINE-PREREGISTRATION.json), [distributions](BASELINE-DISTRIBUTIONS.json)
and [structured result](RESULT.json) preserve raw values and limits.

| Common workload, per measured child | v15 median | v16 median | Registered direction |
| --- | ---: | ---: | --- |
| 200 create/populate/count-check/destroy fixtures,100 rows: synchronous CPU | 51.680ms | 434.130ms | v16 higher |
| Same fixture lifecycle: wall | 24.792ms | 234.174ms | v16 higher |
| 2,000 repeated point updates/read assertions,1,000-row fixture: synchronous CPU | 7.408ms | 62.643ms | v16 higher |
| Same point workload: wall | 3.029ms | 33.318ms | v16 higher |
| 10 live1,000-row fixtures: heap above process baseline | 4,726,600bytes | 17,756,736bytes | v16 higher |

Timing tables report synchronous wall/process CPU; total process CPU after a
separate two-setImmediate drain is also preserved in the distributions.
Cost fixtures have three-field rows plus16scalar fields. The separate original
counter uses two-field rows and200distinct updates; do not combine their operation
counts. Construction timing includes population, assertions and destruction.
Point timing follows10%warmup and repeatedly updates one row. Heap uses the shared
64KiB/3stable/max40turn quiescence protocol; all8heap children clear their10sampled
WeakRefs. One populated size supplies no slope or per-row overhead estimate.
Three comparison samples per arm are descriptive development-host evidence,
not production confidence intervals. Host load is recorded; no exclusive-core
calibration is claimed. Both artifacts import a deep transaction module outside
timing: this is an artifact-level comparison, not fresh public export-map/type
qualification. No pending-heap, peak-allocation or native multi-actor parity claim.

Independent review found copied **build receipt metadata** in the original binding
record: retained pointed at a v16 build, selected at the old singleton prototype.
The actual arm roots,source/artifact manifests,scheduleargv and measured outputs
were correct and guard-verified. The original registration/bindings/raw results
are preserved unchanged. The [provenance correction](BASELINE-BINDING-CORRECTION.json)
identifies published-v15 provenance, the correct frozen-v16 build receipt and
193-file equivalence; both artifact maps were reverified afterward. The preparation script is corrected for future packets; its originally executed
source remains archived unchanged. No favorable
retry or data rewrite followed. Receipt-bound claims must use that correction.

These common-task results establish a substantial gap worth addressing. They do
not separate unavoidable semantic cost from implementation overhead or attribute
CPU/heap to a particular map, wrapper or proof mechanism.

## Architecture disposition

The governing [product plan](../../architecture/multi-actor/PLAN.md) requires both
practical framework-native state and truthful overlapping settlement/publication.
Optional operation coordination does not make native state truth optional.
See [candidate admission boundaries](DESIGN-ADMISSION.md) and [independent review](INDEPENDENT-REVIEW.md).

| Candidate family | Capability under investigation | Current disposition |
| --- | --- | --- |
| Sparse global windows + versioned paired field facts + integrated producer/admission path | Preserve native contracts while reducing ordinary work and retained support | First investigation; native-only scope insufficient; integrated mechanism not yet admitted |
| Shared immutable history + copy-on-write lookup | Preserve saved-reader/history contracts with structural sharing | Alternative hypothesis; no implementation selected; no historical rejected B reopened |
| Proposal-first operations + conditional backend | Satisfy full business workflows through different speculative visibility/commit boundaries | Product comparison; missing native semantics must stay explicit; no replacement authority |

The first candidate must account for the complete ordinary-write path, including
earlier producer/value/topology/admission work. Deferring specialized installation
until after a native-only redesign would leave a known obstacle to the gate.
A compact epoch alone is insufficient; see the concrete required transitions and
counterexamples in the admission record. No unsupported representation or product
fallback is adopted because a rival remains unproved.

## Executed checks and first failures

The first13-file Nx gate records101passes and2failures: unchanged13,000vs<2000,
and a newly malformed7-charge control. That control constructed its Map inside
the measured interval, correctly adding2charges. The corrected setup constructs
Map/list outside the interval, matching the original planted7-charge workload;
a focused rerun passes both prefix/control tests. [First failure](FIRST-CONTROL-FAILURE.json)
is preserved. Do not relabel the original103-test invocation as green.

Incumbent semantic witnesses cover late consumer confirmation/rollback, preparer
owner opening/settling, fixed cross-tree windows, uncertainty provenance, pairing,
repeated subjects, saved readers, destination handoff, horizons and retirement.
They are baseline oracles, not sparse-runtime conformance. Fresh Nx scanning also
warns about an old audit tsconfig with a missing temporary absolute extends target;
tests still execute. No historical config or semantic oracle was changed.

Python registry access first failed local CA resolution; curl with system trust
and TLS verification succeeded. No certificate verification was disabled.
Four relevant documentation gates and focused replay-script lint pass.
No full84-child optimization campaign or new full release proof ran.

[Evidence manifest](EVIDENCE.json) binds raw runs, original/corrected provenance,
package inputs, scripts, preregistrations, all24children and source manifests.
The packet supplies the exactv15tarball and v16artifact maps; frozenv16bytes remain
in the [prior qualification artifacts](../2026-11-03-progress-and-workflow/improvement/README.md),
not duplicated here. Temporary copied specs are retained as non-shipping fixtures; production packages
are unchanged. Full `V16-SPARSE-RESPONSIBILITY-0` implementation remains **not
admitted by this screen**. The first integrated mechanism must resolve the listed
representation and lifecycle questions before code admission. No architecture is
accepted, no gate is waived and no candidate is activated, merged or published.
