# Prepared-store extraction: independent premise review

**Technically feasible, but not yet demonstrated worthwhile.** Both methods have an optional production caller and can become consumer-imported kernel algorithms while installation remains store-owned. The safe input boundary must include retained inactive state, not merely current rows. Structural extraction has a substantial algorithmic body to move; value preparation is only a map copy plus overlays, so its added access seam may cost as much as it removes. Leaving either or both intact is a valid outcome. No budget increase or adoption is implied.

Reviewed clean HEAD `5c29bceb` in `/Users/jonathanborgia/.codex/worktrees/capture-point-owner/signaltree`: contributor contracts, current implementations, repository caller/type searches, relevant history and tests. No implementation, tests, builds, benchmarks or repository documentation edits. Only this report written. Paths below are relative to the checkout.

## Current ownership and call graph

- `lib/physical/structural-store.ts:218–310 prepareTarget` validates target identities/keys/order, copies lifetime/revision maps, adjusts only affected lifetime states/revisions, and builds detached linked-order nodes plus two indexes. `installPreparedTarget:312–323` clears the key cache and swaps prepared structures/frontier into the store. It does not reset the subject allocator or collection incarnation.
- `lib/physical/entity-value-store.ts:15–23 prepareTargetValues` copies **all retained entities**, then overlays supplied values. `installPreparedTargetValues:25–27` swaps that map. It deliberately does not clear retained backing absent from the current target.
- The sole production invocations found are `lib/physical/prepare-entity-target.ts:112–117`. That optional module already has the store objects through `EntityTargetHost`; its install closure calls both store-owned installers at `164–165`.
- Repository source/tool searches for methods and target types, plus class consumers and entrypoint inspection, found no other production preparation caller. Tests reach the methods indirectly through real collection bindings. The internal types `PreparedStructuralTarget` and `StructuralTargetSubject` are not exported through kernel root/adapter/internals entrypoints. This needs no new package API or framework adapter field.

The contributor contract places state, identity, EntityMap and restoration semantics in the kernel, and prohibits a second authority in frameworks. Moving detached construction to an internal kernel module is compatible with that ownership **if the stores remain the sole live owners and installers**. It is not authorization to invent a general plugin storage API, expose raw stores publicly, or add global registration.

## Minimum safe boundary

For structural preparation the necessary source facts are the **complete subject-state map and complete revision map**, preserving the existing missing-revision default of zero. Existing per-subject accessors cannot enumerate all inactive records. Active keys/readSource contain too little information. No live linked-list node or active index is needed as input: the algorithm constructs fresh nodes/indexes from the target order.

For value preparation the necessary source is the **complete retained-value map**, including tombstoned entities. The supplied target values are already validated/deep-cloned by the outer preparer; do not clone them again or clone untouched retained values.

A bounded route is:

1. Keep the prepared target data shapes internal, and keep both install methods unchanged.
2. Put the construction functions in an optional physical helper imported only by `prepare-entity-target.ts` (or colocate there if that avoids an unnecessary module). Stores must not import those implementations at runtime; type-only references are fine.
3. Add only the missing internal source-access seam. Prefer a narrowly scoped callback receiving typed read views of the complete source maps, or an equivalently narrow internal read port. The optional helper copies those maps before writing replacements and never mutates source records/nodes. Existing host already supplies stores; no second entity-wide host or public adapter contract is needed.
4. Invoke this access/preparation at exactly the old callsites: after the outer preparer clones all target values, structural preparation first, then value preparation, all before any install.

A callback seam restricts the ordinary access pattern better than a general mutable-state getter, but is **not a sandbox**: TypeScript readonly is compile-time, and a callback can retain its inputs. Use `ReadonlyMap` and readonly record views for input, mutable owned maps/nodes for prepared outputs, with no `any` or casts to bypass private access. Only the optional trusted kernel algorithm should consume this seam. Returning copied maps is an alternative with stronger container isolation, but avoid copying twice or moving copies ahead of validation without acknowledging the cost/order change. Do not turn the store into a general-purpose callback executor or add persistent shadow state.

The original implementation validates before copying structural maps. Preserve that sequence and its errors. Source facts must be read at preparation time, not captured once at store construction: install swaps map identities. If a proposed view caches backing maps across preparations, the second reversal can read obsolete state. Also distinguish stable current-view access from eager snapshots around potentially reentrant target getters/iterators: preserve the existing synchronous read boundaries or explicitly limit the helper to the outer preparer's normalized data. Do not silently add new reentrancy, freshness or validation policy.

A separate internal getter returning current read views can also work; it is not inherently safer than callback injection and exposes a wider retrievable seam. Choose it only if it is materially smaller/clearer and its callers remain bounded. The minimal semantic input remains the same three maps, not the entire store state.

## Counterexamples the split must survive

1. **Inactive lifetime lost:** current A is active, B is tombstoned/restorable with a revision. A target contains only A. Rebuilding states solely from target subjects loses B and later undo cannot restore it. A tombstoned nonrestorable record must likewise remain nonrestorable; an absent/forgotten subject must still be rejected if targeted.
2. **Retained value lost:** B is omitted from the active target but its value backing is retained for history. A value target made only from supplied rows erases B. `prepareTargetValues` is an overlay, not replacement of the historical retention inventory.
3. **Validation weakened:** duplicate subject IDs, duplicate keys, an unknown subject, a retired nonrestorable subject, repeated/missing/foreign order IDs must reject before any install. Do not replace the current validation with “all active keys are unique.” Map key semantics preserve numeric versus string keys; no string coercion.
4. **Revision drift:** omitting an active subject increments its revision once; restoring inactive or changing its key increments once; unchanged active key preserves revision. Omitted already-inactive records/revisions survive unchanged. Preserve `restoreAllowed` on every transition rather than manufacturing a default. Value-only updates must not invent structural revision changes.
5. **Aliasing mutation:** shallow map copies share existing lifetime records. The current algorithm replaces changed records; mutating their properties in place changes live state during preparation and breaks all-owner atomicity. Reusing live linked nodes can similarly reorder the store before install. Allocate new linked nodes/indexes; retain unaffected values by reference as today.
6. **Swaps and identity:** A↔B key swaps must prepare as one detached target without temporary keys or remove/add. Held row handles remain keyed to subject identity; head/tail/prev/next, both node indexes and active count must agree after install.
7. **Allocator/incarnation/frontier reset:** neither preparation nor install may allocate new subject IDs, reset `nextSubjectId`, or alter collection incarnation. Preserve the supplied frontier token exactly, including identity; clearing the key cache remains the installer's job.
8. **Wrong phase/failure handling:** a later collection's preparation failure must leave earlier collections untouched. Do not replace install swaps with normal public mutator loops, eager value writes, per-record notifications or retirement logic. Keep membership opening/closing, selection and publication in the existing outer preparer, and aggregate install-before-publish in target-transition.

These are concrete preservation obligations, not claims that all are directly covered by current tests. Do not add a new stale-plan acceptance rule merely because map access has moved; that is a separate semantic decision.

## Tests and history: relevant evidence and gaps

`e3dc446f` introduced both methods specifically to prepare complete structural/value targets off-store and install without temporary keys. The later `19a5bd03` reversal work reinforces lifetime/placement requirements in causal target derivation; its fixes are not permission to simplify store truth. The recent `f962e903` removes unrelated obsolete class code; it does not make these live algorithms dead.

Preserve these existing files and their assertions if internal call signatures change:

- `lib/physical/declarative-target-binding.spec.ts`: preparation leaves the current source unchanged; held facades through reorder/key swap; detached caller values; install-time membership tap and same-tap close under replacement.
- `lib/internals/causal-runtime/target-transition.spec.ts`: invalid targets/key collisions/owner isolation, all-owner preparation before installation, all installs before publication, scalar participation in the same boundary.
- `lib/internals/causal-runtime/target-transition-key-handoff.spec.ts`: complete-target identity/occupancy behavior.
- `lib/physical/structural-store.spec.ts`: linked-order integrity, held-handle rekey identity, tombstones and restore placement. Its tests are valuable but are not direct unit coverage of the entire prepareTarget matrix.
- `lib/physical/entity-mutation-frame.spec.ts`: lifetime retirement/forgetting semantics and no earlier mutation on later preparation failure. This is a different preparation mechanism; do not claim it directly tests extracted full-target map copying.
- `lib/entity-selection-lifetime.spec.ts`, `lib/entity-membership-link-restoration.spec.ts`, `enhancers/restoration/set-all-order-reversal.spec.ts`, `hidden-collection-nesting.spec.ts`, `hidden-terminal-reversal.spec.ts`, `jump-undo-equivalence.spec.ts`: live/hidden ownership, order and history integration.

There is no `entity-value-store.spec.ts` in this checkout. `physical/subject-record-target.spec.ts` tests a different map/slot preparation implementation; caller tracing does not connect those functions to these live stores. Its extensive passing assertions cannot substitute for the retained-map overlay counterexample above. Do not opportunistically consolidate onto that representation in this bounded extraction.

If implementing, the cheapest missing falsifiers are direct extraction tests for (a) untouched inactive states/revisions and retained backing, (b) changed-state preparation not mutating live records, (c) rejection of malformed targets with no install, and (d) a second preparation after a prior install seeing the new maps. Keep source/spec typechecks and unchanged public export inventory. Tests listed here were inspected, not executed.

## Leave intact is a real alternative

Both methods express truthful store operations and currently avoid exposing the retention maps. Keeping them costs emitted code but preserves a smaller encapsulation surface. In particular, value preparation is only `new Map` plus a short overlay loop: extracting it needs a retained-map access method and optional helper/call overhead, and might not produce a useful net reduction. It is reasonable to extract structural construction only, or neither.

No savings are calculated here. The experiment would need exact same-fixture emitted comparison showing the helper excluded from plain entities, net bridge/access overhead, and enhanced-bundle impact. CPU/retained-memory cost may change through copies, views or closures; prior outer-split measurements do not answer this new question. Do not expand scope or weaken semantics to make a ceiling pass. A negative or negligible measured result is sufficient reason to leave these methods intact, with budgets unchanged.
