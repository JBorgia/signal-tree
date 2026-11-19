# Stable source-owned admission experiment R1 — not integration acceptance

Built only in this new directory from frozen `/private/tmp/st-packet-index-successor/candidate`. Verified all 2,968 predecessor manifest files unchanged. Root, combined A/B, predecessor and independent reviewer sources were not edited. Two runtime files change, both private: `internals/entity-publication.ts` and `experimental-publication/entity.ts`. No public export, payload deep-freeze, proof deep-freeze, observer bypass, budget change or certificate redesign.

**The bounded semantic experiment is implemented, but the point-work gate remains red and worse than B.** New controls: 8/8 pass. Exact allocation replay: 10/10 pass on B and candidate, retention identical at every matched checkpoint. Unchanged point visits: **15,800** for 200 updates, equal at 2k/20k rows; B was 14,400 and prior guard candidate 27,600. The ceiling remains <2,000. Independent implementation review is pending; this is not a green optimization or integration recommendation.

## Mechanism and ownership boundary

`AdmissionMetadata` establishes stable metadata before native, responsibility and recipient preparation. Private source-issued membership arrays transfer ownership and are frozen in place; edit identity is preserved. Mutable edit shells receive copied field-name arrays (unless already frozen) and copied structural descriptor shells, then are shallow frozen. Source shared structural objects are not frozen in place. Rows in `before`, `after`, structural value payloads, restoredFields Maps, endpoint/proof objects and lifecycle requirement cells are not deeply frozen or cloned. Fields naming a public row are metadata, not that row's value. Public row/array/nested payload mutability is exercised separately.

Step shells, authored footprint metadata, step-order and order-id arrays are stabilized into owned copies. The packet shell is copied/frozen; metadata such as active inputs/proof references retains its existing lifecycle. This is intentionally not general packet deep immutability. Already frozen *private* edit shells also transfer ownership of their referenced field-list/structural metadata; no public API accepts these packets. This private boundary must be assessed explicitly by the reviewer.

Per-source WeakSets mark stabilized edits, membership arrays and packet shells. They contain no payload, index result or certificate; they do not keep keys alive and confer no source revision authority. Queued point fragments stabilize before later callbacks; final aggregation can append its own containers, then the final source prepare stabilizes that unit. Already owned edit/array fragments are reused. There is no global cache. Finalization/source revision/retirement/recipient/disposal guards remain.

Native preparation builds the ordered sequence once, without four structural rescans. A one-edit unit selects directly from that edit; multi-edit units build one subject-to-last-edit Map. All original edit occurrences and per-edit endpoint precedence remain; step-array order and authoredRemoval dedup are unchanged. Delayed support uses the same stable admitted subject domain. No subject lookup coalesces the processing sequence. Step-local physical `.find` pairing is unchanged; no global linear-work claim follows.

## Preserved failures and honest contract differences

`first-failures/` archives the independent first finalizer red, exact four-case source, independent review and predecessor point failure. The entire original 24-case author spec remains byte-identical, as does the independently added four-case spec copied here. They were executed, not silently corrected.

Final combined selected run: **61 pass / 10 fail**, `focused-final.log`:

- Three inherited structural-sequence failures remain: remove/rekey vacancy, ordinary removal before physical omission, numeric/string keys; same structural-drift mismatch. No waiver.
- Five old author private-mutation expectations differ: append now throws TypeError rather than the bespoke guard error; Reflect.set subject/kind returns false without poisoning the operation; prepare-time recipient append throws immediately instead of at finalize; mutation of a retained membership array is refused instead of permitted before the support assertion.
- Two independent cases differ: the exact finalizer refusal expects the old error string (now TypeError), and its diagnostic expects stale installation after successful append (append now fails). Their unchanged failures are retained as historical contract differences, not reported as passes.

The new eight cases assert escaping preparation/finalization mutation prevents native/responsibility install; a caught temporary mutation cannot diverge recipient/native admission; both recipients see the same packet; edit identity survives; payloads remain mutable; structural/step reassignment is ineffective; held unknown support survives retirement and a refused array mutation. New-spec-only run is 8/8 pass. The unchanged independent source-reentry and duplicate-identity controls pass. A caught failed metadata write can continue with unchanged admission; the design does not invent an attempted-write poison policy.

First copy-based experiment is preserved in `first-copying/`, `first-adversarial.log`, `focused-first.log`, `point-first.log` and `allocation/`: it used copied membership containers and counted 16,600 point visits. Ownership transfer removes those actual copies and reuses already frozen field-name lists; final point visits are 15,800 (`point-owned.log`). No loop-syntax substitution was used to hide counted work.

Strict source typecheck and ratcheted spec-types pass (`source-types-final.log`, `spec-types-final.log`). The latter reports three inherited improvements, with no baseline edits. Node24.15.0, pnpm10.17.0, Vitest4.1.9. No production/demo build or release qualification is claimed for this disposable experiment.

## Allocation/work accounting

`allocation-final/` contains fresh instrumented B and candidate copies, the unchanged allocation spec, raw nine-record JSONLs, exact instrumentation patches, scripts and FINAL-IDENTITY.json. Instrumentation is absent from the actual candidate. Both arms pass 10/10; all eight retained-map counts match at every phase in every workload, including foreign pending exclusion, held receipt, useful edit, completion, disposal and destroy.

Named batch construction sites, bare population:

| N | B array entries | R1 array entries | B / R1 native Map constructors | R1 additional metadata shells/descriptors | R1 seal calls / metadata slots sealed |
|---:|---:|---:|---:|---:|---:|
|32|4,128|64|180 / 181|225|292 / 1,678|
|128|65,664|256|660 / 661|897|1,156 / 6,670|
|1024|4,195,328|2,048|5,140 / 5,141|7,169|9,220 / 53,262|

The counted array entries drop from 4N²+N to 2N, but ownership work is not free: descriptor/shell construction is 7N+1 and sealing 9N+4 calls for this workload. Native Map sets become 30N (B29N); copied Map entries remain6N. COUNTS.json retains every site, including field/footprint/order copies when used, structural copies, property descriptors/definitions, shell construction, own slots sealed, weak ownership membership checks/adds/constructors and proposal lookups. These are distinct counters, not interchangeable units of time or bytes. Do not combine shell counts into the old Map-constructor total.

A separate diagnostic executes the same 200 point updates after 2k/20k population. Both sizes have identical source-site counts: 1,200 array entries across 1,200 arrays; 1,200 new metadata shells/descriptors; 3,000 seal calls covering 10,600 metadata slots; 200 proposal lookups; plus native Map counts retained in raw data. Remaining field-list copies (600), footprint copies (200), step-order copies (200) and ordered helper sequences (200) are concrete transient costs, not retained certificates. The original point gate is separately replayed uninstrumented. Diagnostic own-key reflection is not runtime work and is not used for that gate.

Counters cover new ownership operations and native index/construction sites, not every allocation in the library, engine-internal freeze cost, total heap or CPU. Original instrument.py IDENTITY records the intermediate pre-ownership-instrumentation hashes; FINAL-IDENTITY.json and VERIFICATION.json record final executed instrumented identities. No OOM-resolution inference, 130k replay, timeout/heap raise or performance ranking.

## Handoff

SOURCE-SHA256.json and FREEZE.json identify the candidate; runtime.patch is relative to the prior packet-index candidate. COMMANDS.md supplies exact commands. VERIFICATION.json verifies frozen predecessor, only two runtime edits, unchanged inherited tests, exact allocation spec and retention equality. No eligible local independent-agent tool was available; no external CLI reviewer was invoked. Main's independent reviewer must assess the source-owned metadata boundary and point regression before any integration. The experiment stops at this bounded review handoff, not an assertion that the remaining point failure is acceptable.
