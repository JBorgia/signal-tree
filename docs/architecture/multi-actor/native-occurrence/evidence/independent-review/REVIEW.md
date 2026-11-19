# Independent occurrence-successor review

Frozen runtime patch: `6c8e8c943da9a06499c55711e4b90724af9f1f12505439bbd34a8b58dc6655d8`.
Candidate: `/private/tmp/st-occurrence-successor`. No runtime or frozen fixture edits.
All 2,918 manifest files matched before review and after execution. A separate
replica retains all 2,918 originals byte-for-byte and adds one diagnostic test.

## Restoration premise: the asserted immediate send is not established by existing authority

The unchanged focused replay reproduces 31 passes / one failure. Omission now
publishes `{other:1}`. The failure is the later assertion demanding immediate
publication of restored equal x=7 before q settles. Keep that assertion and its
failure frozen, but do not classify it as proven payload/support incoherence.

The fixture writes x=7 outside any declaration while a foreign q is pending.
Native evidence is **owners=[]**, **possible=[q]**, **unknown=true**. Describing it
as a q-owned field is inaccurate. In the independently observed restoration:

- Equal x=7 emits an ordinary entity edit with `fields: []`; the x requirement
  remains the exact same object. The receipt is conservative/unknown and no new
  value is sent. After q.confirm(), the exact restored ordinary payload publishes
  with basis surviving.
- Different x=11 emits `fields: ["x"]`; x gets a different, clean requirement.
  The restored payload publishes immediately with basis declared while q is pending.
- Both cases assert actual ordinary tree state before settlement. No later valid
  write intervenes, and no stale payload overwrites newer truth in these probes.

Governing implementation evidence (unchanged from the predecessor): marker hydrate
`markers/entity-map.ts:434-451` routes a fresh one-row literal through setAll;
`entity-signal.ts:1323-1332` computes ordinary field footprints via
`publicationFields` (`2037-2042`), which filters unchanged fields unless explicitly
supplied. `experimental-publication/entity.ts:115-125` replaces native field
requirements only for those fields. `internals/entity-egress-projection.ts:205-217`
likewise updates only their contributor slots. Membership selection does not by
itself reauthor every retained descendant. `entity-semantic-transition.spec.ts`
explicitly distinguishes ordinary equality from adoption; all 12 controls replayed.
The existing direct equal-update publication test passes too: updateOne's explicit
field footprint can replace support, unlike this setAll-generated empty footprint.
Do not infer equal setter parity across these two routes.

Therefore the failing frozen assertion assumes an additional reauthorship rule
for restored equal descendants. That rule is not demonstrated by the current
native effects or existing equality contract. If desired, it needs an explicit
policy/coverage decision rather than deleting retained proof to make this test pass.
This is a qualified oracle-premise objection, not candidate acceptance or a claim
that all restoration combinations are correct.

## Mechanism assessment

Full ancestry: `native-occurrence.ts:28-49` traverses actual descriptor values
from a registered root, checks exact anchor identity, and uses source-issued entity
bindings for lifetime identity. `recipient-occurrence.ts:35-43` enrolls each edge
before exposing the target group. Aggregate bindSource traverses retained own
properties before the entity adapter branches. Four first-omission controls
(scalar/empty/collection/mixed, root and subsource) now pass.

Exact slots: `replaceEntry` cancels the prior listener, subtracts its counts, and
callbacks validate `group.entries.get(key)===entry`; dispose cancels every slot.
Shared-requirement replacement and disposal controls pass. The reused entity-key
runtime control passes. This is stronger than connection-only callback identity;
it is not exhaustive runtime replacement/finalization coverage for every writer.

Selected versus consumed: visibility removes a group's summary from its ancestors,
not proof attached to surviving groups. The supplied consumed-y and independent-y
controls pass. The former explicitly declares q, so its pass alone cannot isolate
inferred consumption from declared ownership. An additional reviewer probe declaring
the actual consuming updater independent throws the existing contradiction error;
its failed expectation is preserved and is NOT a candidate failure. This confirms
native consumption is noticed, but does not independently isolate every dependency
role after reduction.

Reduction readiness: ready() reduces completed units before consulting the resulting
index unresolved count. The hidden/unhidden helper control passes; unfinished old
selected support no longer prevents omission from removing it. Cached entry
readiness is distinct from owner settlement (unknown evidence may be finalized yet
still require surviving fallback).

Point work: the 4-versus-128-sibling helper asserts equal positive ancestor-delta
counts and one finalization. Source no longer scans all selected entries to ask
selectedReady. This is an index-helper work result, NOT whole publication CPU or
constant-time proof: proof() enumerates distinct proof keys, ready() restoration
visits collections, maskPayload visits presence slots, and full payload rendering
is additional work. The counter does not measure every inner map visit.

Restoration payload/support are still separate stored parts: membership completion
installs ordinary.after.value, then overlays selected retained collection.payload;
collection units separately replace contributor entries. That shape is a source
hypothesis worth distinguishing from actual failure. The equal/different probes
show matching payload and retained/replaced support for this case. They do not
prove an atomic selection-unit invariant under hidden inspection or callback
interleaving. No such leak is claimed here without a counterexample.

## Evidence and boundaries

- `replay.log`: exact candidate five focused suites, 31 PASS / 1 FAIL unchanged.
- `equality-contract.log`: 12/12 existing semantic-transition controls pass.
- `restoration-native-effects.log`: two diagnostic variants pass; raw native
  packets, requirement identity/proof and before/after receipts in observations.jsonl.
- `consumption-and-restoration.log`: two variants pass, reviewer independent-input
  premise fails with contradiction. Preserve as a rejected probe, not a product bug.
- `replica/packages/kernel/src/lib/independent-restoration-review.spec.ts`: probes.
- Source type log in supplied evidence passes; spec type log retains two errors in
  core-independent-review. Not independently rerun, and not called green.
- Original omission/restoration fixtures are unchanged. The terminal-consumer fixture
  is NOT byte-identical: fake sources were replaced by native tree/collection setup
  and cleanup, preserving assertions. The initial broad identity assertion failure
  is preserved in identity-check.txt; final classification is identity-final.txt.
- Replica Nx discovery emitted an inherited missing absolute tsconfig warning;
  test processes still ran. Logs retain it. No source/config suppression was applied.

No author RESULTS/COVERAGE verdict was used to choose expected results. Governing
root DESIGN includes historical conclusions; raw new logs and exact source were
read before interpreting this successor. No patches, acceptance, broad qualification,
production integration, or policy changes are recommended by these observations alone.
