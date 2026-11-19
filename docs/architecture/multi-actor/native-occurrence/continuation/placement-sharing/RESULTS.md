# Executed allocation-site and traversal accounting

Original52-pass variant is preserved byte-for-byte (VERIFICATION.json in sharing successor). It is not established as an allocation optimization: versus frozen B it adds N row clones and preserves tuple count, while removing one array and N visits.

Separate `/private/tmp/st-placement-sharing-successor` reuses the Map iterator's fresh entry tuple and the exact frozen captured after-row in interval pairs. The Map's live row is copied, not frozen/mutated. Default and explicitly mutable interval inputs retain defensive after copies. No original test changed; one new test asserts these ownership/identity conditions. 53 focused tests pass, source types pass, spec errors remain the same202 after root normalization. No broader gates.

## Measured counts

Each row below is an executed workload. Entries in each cell are **B / initial52 / sharing53**.

| Operation | N | Row clones | Entry tuples | Arrays excluding tuples | Visits | Freeze calls |
|---|---:|---|---|---|---|---|
| setAll |32|128 /160 /128|128 /128 /96|70 /69 /69|320 /288 /288|196 /261 /229|
| prependMany |32|128 /160 /128|128 /128 /96|70 /69 /69|320 /288 /288|196 /261 /229|
| setAll |128|512 /640 /512|512 /512 /384|262 /261 /261|1280 /1152 /1152|772 /1029 /901|
| prependMany |128|512 /640 /512|512 /512 /384|262 /261 /261|1280 /1152 /1152|772 /1029 /901|
| setAll |512|2048 /2560 /2048|2048 /2048 /1536|1030 /1029 /1029|5120 /4608 /4608|3076 /4101 /3589|
| prependMany |512|2048 /2560 /2048|2048 /2048 /1536|1030 /1029 /1029|5120 /4608 /4608|3076 /4101 /3589|

Each variant also creates one visibility seed Map and 2N+4 interval/pair/continuity objects in this counted region. Those counts are unchanged. Sharing performs N additional Object.isFrozen checks, recorded separately. Compared with B, sharing removes N tuple arrays, one non-tuple array and N counted visits, preserves row clone count, and adds N+1 freezes. This is a concrete allocation/traversal tradeoff, **not proof of faster CPU or smaller retained heap**. Do not accept a general performance claim from it.

## Measurement boundary and fidelity

These are executed source-site counts, not engine heap allocations. Instrumented copies of B, initial52 and sharing53 are under baseline/, initial/, sharing/. Each has an instrumentation.patch against its exact uninstrumented source, and commands/first logs/results/JSON under runs/. The six workloads assert complete public ids and payloads before writing their counters. All18 instrumented workloads pass; sharing's extra run records actual frozen-check executions too. Instrumentation never runs in the frozen production candidates.

Counted region: earlier staged-key scan; final capture; physical AND ordinary interval construction; visibility seed construction. Map iterator wrappers count each actually yielded native entry tuple, including the ordinary stage omitted by the old Map-only gate. Explicit capture tuples are separate. Array/container counters are at evaluated allocation sites; row clone counters at actual clone branches; flatMap callback-array and output allocations, pair/interval/continuity records, filter output and seed Map are included. Visits cover Map entries, flatMap/filter inputs, flattened emitted elements, and Map constructor consumption. This avoids treating a moved Map walk as disappearing work.

Excluded: instrumentation's own objects; iterator protocol result records, VM optimizer/elision, bytes, allocator internals, array backing growth, unmodified downstream visibility tree/run/position building, other entity-publication allocations, CPU, GC and retained heap. Thus 'actual' means source allocation expressions and native Map entry yields exercised, not a universal object census. Baseline and sharing do not have identical engine iterator overhead; no heap inference is drawn. COUNTS.json includes per-workload totals; raw counts retain per-phase counters.

## Frozen source and minimal handoff

Sharing manifest `968c8bdeb6a2496bc273a252923214abb4383b971608ed54300d39e201739dbc`.
From-initial runtime patch `e8b1e79f999c29aff20987c590e74159cb5c35abfb2f07fc6869e7e1405ecd66`.
From-B runtime patch `7341bf88da35302ca5e5d167d451f870aab0415662332f7c5eb37c3b9dbe4d51`.

Only two runtime methods differ from initial52: EntityPlacementStage.capturePatch and EntityOrdinaryTopology.prepareInterval. Entity-signal hunks remain the original minimal final-stage wiring for Main to combine. Runtime and tests patches from both initial and B are in sharing successor. Frozen B, initial52 and other authors' sources remain untouched. No activation or independent acceptance claimed.
