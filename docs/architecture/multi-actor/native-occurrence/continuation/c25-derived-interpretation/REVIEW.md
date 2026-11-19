# Independent interpretation of C25 derived retention

The evidence supports a narrow literal-retention improvement plus a surviving derived-route growth counterexample. It does not support general bounded retention or integration acceptance. The derived diagnostic passes useful semantic assertions, not a retention ceiling. No author final REPORT or other review verdict was read; no tests were run or source/fixtures edited. Raw evidence and identities are preserved under inputs/ and IDENTITY.json.

## What was actually measured

The recorded Nx command is `corepack pnpm nx test kernel equal-owner-derived-roots.spec.ts --skip-nx-cache --maxWorkers=1`, with Node24.15.0 first on PATH. Recorded RESULT: exit 0, timeout false, sourceUnchanged true; log: one test passed. The four preserved instrumented runtime files and the derived fixture independently match that run's SOURCE.json hashes. This verifies the relevant inspected byte correspondence, not all runtime/dependency provenance. No timing/performance conclusion is drawn.

| Completed equal updater invocations | Endpoint same as initial | Requirement same | Source component nodes / depth / traversal visits | Enumerated-root objects / requirements / component edges | Computed role entries |
|---|---|---|---|---|---|
| 0 | yes | yes | 1 / 0 / 1 | 337 / 8 / 2 | 12 |
| 1 | no | no | 3 / 1 / 3 | 384 / 12 / 6 | 49 |
| 2 | no | no | 5 / 2 / 5 | 420 / 16 / 10 | 76 |
| 4 | no | no | 9 / 4 / 9 | 454 / 20 / 14 | 102 |

The measured source shape is 2N+1 nodes and depth N at these four points. Instrumented private.ts keeps branch/derived input on the combineNativeRequirements path; lifecycle.ts:124–127 builds a new composite retaining its component objects and a proof getter over them. This supplies a concrete source explanation for a persistent predecessor chain, not just temporary allocation. Larger derived N was not measured here. Do not extrapolate an exact total-root formula from the nonuniform 0/1/2/4 samples.

Owners remain 2, pending owners 2, active frames 0, operations 1, listeners 1 throughout the samples. The fixture drains after every invocation. Thus growth is not explained by additional pending owners, retained receipts, or an expanding open declaration stack. These scalar counts do not prove all completion state has retired: the fixture does not directly assert every pending-unit set is empty or nativeRequirementReady for the sampled derived requirement.

## Useful semantics and their limits

The fixture genuinely establishes, for this one live neutral branch recipient:

- The callback executes once per invocation; x remains 7 and y 0; x subscription notices remain zero.
- No transport occurs during repetitions; confirming p alone still sends nothing while q remains pending.
- Confirming q produces exactly one `{x:7,y:0}` payload and connection settlement completes.
- Source proof has two distinct owner objects at each sample.

This is useful safety and progress coverage, not a vacuous diagnostic. It does not assert receipt states, owner identity/roles beyond count, transaction inspection invariance, rollback/inverse behavior, a later updater's preservation of newly consumed q, error/reentry cleanup, disposal-root counts, or facade behavior. The `finally` performs teardown but this test does not sample or assert retained structure after it. The recorded zero `frames`/`inputs` metrics refer to arrays in enumerated requirements; they do not mean no native input was consumed or no validation/owner roles survive in proofs/components.

## Fixed obligations versus real new authorship

Setup creates exactly p and q, with p-owned x inheriting q through a dependent declaration. Each subsequent operation is a REAL public branch updater under a declaration naming the same p and q: `current => ({...current})`. There is no new transaction owner, no changed scalar value, no value notification, and no newly emitted output. It is a fixed-owner/fixed-value workload.

It is nevertheless not the same workload as an independently supplied literal. Each updater consumes the actual current branch snapshot; its invocation therefore has input/validation evidence that a literal does not. EXPECTATIONS items 2–3 explicitly require retaining admitted derived/branch evidence and prohibit silently applying the literal shortcut. The count `owners=2` does not prove complete D/I/V/W, readiness, validation and error evidence is interchangeable. Thus these results neither justify discarding derived evidence nor prove every retained historical node is semantically necessary. Resolving that would require a separate representation argument and discriminators; this review proposes no compactor or policy change.

## Comparison with frozen C24 raw counts

C24's eight diagnostic records cover independent equal LEAF and literal WHOLE writes, N64/N256, p alone or p with inherited q. They report 129/513 selected component nodes, 128/512 edges, depth 64/256, fixed 1/2 owners and ready=true. The fixture captures the selected predecessor before one extra probe declaration, retains no receipt, asserts no notifications/early sends, then exact terminal output and settlement. It has no size bound assertion. Its raw log SHA is preserved in IDENTITY.json.

C25 derived 1/2/4 has the same observed selected-chain arithmetic, but is NOT an apples-to-apples before/after benchmark: updater versus literal, dependent versus independent, per-invocation drains versus C24 loop then drain, different sampling, different N, and a broader second walker. In particular C24 supplies no comparable all-root counts. It is invalid to say C25 made the original literal workload no better from this derived file alone.

The separately inspected C25 literal ROOTS-LARGE data and final literal fixture do support the narrower improvement: exact endpoint/requirement identity is asserted; enumerated counts plateau after the first closed invocation through N64/256 for leaf/whole, p or p+q, connected or callback-disposed Link. Unlike the derived fixture, that fixture asserts each enumerated metric does not exceed its first closed baseline. It also asserts useful final delivery/settlement and zero selected connection counters after disposal. This is a scoped structural bound qualification on the roots it enumerates, not a universal heap bound. Neither file authorizes relaxing a budget.

## Why “allRoots” is not all retention

The walker does traverse own data descriptors (including symbols), Maps and Sets, selected endpoint/view and the supplied saved-snapshot certificates, binding data, lifecycle exposed maps/sets/stack, fact-to-requirement weak edges, requirement listeners and owner-transition observer weak edges. The explicitly exposed transaction registry contributes installedOperations, pendingTransactions and expectedDispositions for the source tree. Symbol-bound endpoint pairs reachable from those records are traversable; they are not accidentally excluded as string-only properties.

Limits matter:

- Function closure captures are opaque. Listener/release/selector/getter closures and callback environments are not recursively inspected.
- Most WeakMap/WeakSet entries are not enumerated; only two lifecycle weak lookups and factRequirements are bridged. Runtime weak maps for other native locations, grants, predecessors and receipt ownership are not exhaustively inspected.
- Only the source tree transaction registry is explicitly read; the foreign q registry is not separately rooted by this helper. Selected global lifecycle structures may reach some of its state, which is not an enumeration proof.
- Samples after completion cannot measure every transient detached preparation object. The helper also allocates root wrappers/arrays, and the caller holds a baseline endpoint/saved snapshot. Counts describe this declared observation graph, not GC residency or byte size.
- `roleEdges` sums array lengths returned by nativeProof over visited requirements. Those are proof-role entries, potentially repeated across ancestors and roles, not distinct owners or a count of stored JS references. `edges` counts ordinary traversal slots but not every explicitly bridged weak edge. Getter properties are not traversed as data, although nativeProof is called to compute role metrics.

These limitations restrict upper-bound claims; they do not erase the observed retained chain rooted at the CURRENT selected endpoint. A partial traversal suffices to demonstrate that particular growth, while a plateau in it cannot prove absence of other retained roots.

## Disposition and cheapest remaining falsifiers

EXPECTATIONS item 2 deliberately restricts the exact-retention rule to input-free literals; the derived result is not a breach of that narrow optimization promise. EXPECTATIONS item 6's identity/bound assertions apply to its literal workload, and cannot be silently claimed for derived invocations. Items 1, 3–5 and 7 require distinct safety/input/readiness/physical/facade controls; this one passing diagnostic is no substitute.

Keep the derived result as an unresolved general-retention limitation. No general integration acceptance follows from the evidence inspected here. It also does not establish a new premature-send or value-correctness failure: its tested hold/confirmation semantics pass.

The cheapest unrun retention falsifier is already in the data: a SEPARATE bound-bearing counterpart at N1/2/4 would reject selected-source growth after the first closed invocation, without raising N or changing the diagnostic's original assertions. Before proposing a remedy, distinguish a repeated same-input case from one that genuinely admits a new q and later consumes that admitted source; preserve contradiction, dependent acceptance, useful terminal output, and role/readiness semantics. No such counterpart, runtime correction, new run, or broader integration verdict was produced by this read-only task.
