# Structural target planner split — independent implementation review

**Bounded acceptance for the supplied internal synchronous planner. No production correctness blocker found.** Readonly parameters are a compile-time convention, not isolation. Exact equivalence is qualified for hostile getters/subclass overrides that reenter or replace store state during planning. No size, adoption, budget or release approval follows from this verdict.

Baseline independently verified clean at `5c29bcebe2d3e04a378b7fe1bf896091d223c833` in `/Users/jonathanborgia/.codex/worktrees/capture-point-owner/signaltree`. Candidate: `/private/tmp/signaltree-store-preparation-20261014`. Initially only the three stated implementation files differed. I added a separate `packages/kernel/src/lib/physical/store-split-review.spec.ts` in the temp archive and ran it through Nx. No production files edited; no builds or benchmarks run.

## Exact implementation findings

1. **Validation and order preserved.** Duplicate subject identity/key refusal, active-or-restorable eligibility, order length/uniqueness/membership checks retain their order and error strings. Maps preserve typed-key semantics; the active linked list is rebuilt in supplied order with identical head/tail/prev/next and lookup maps. Preparation writes only newly allocated maps/nodes in the supplied algorithm.
2. **Lifetime and revision rules preserved.** Active subjects omitted from the target become inactive while retaining restoreAllowed, with one revision increment. Reactivated/rekeyed subjects increment once; unchanged bindings and inactive omitted subjects retain revisions. Unknown or nonrestorable inactive subjects are refused. Replacing `this.subjectRevision(id)` with `(sourceRevisions.get(id) ?? 0)` matches that method's implementation. Fresh-ID allocation and collection incarnation are untouched.
3. **Installation remains store-owned.** `installPreparedTarget` is unchanged and performs the same map/list replacement and key-cache invalidation. The planner returns the same representation, including the original frontier reference. No physical-clock/publication behavior moves into the helper, and no single-use or stale-target guarantee was added. The original method also lacked those guards.
4. **Caller adaptation is complete for inspected production code.** `prepare-entity-target.ts` supplies the imported function as the new fourth argument. No other production direct StructuralStore.prepareTarget call was found. The entity preparation sequence still prepares structural target, then value target, before returning installation/publication closures. Direct collection binding consumers are unaffected by this lower-level signature change.
5. **No public export addition found.** Store/helper symbols are not exported through kernel root, adapter or internals barrels. StructuralStore imports the helper type only; the helper imports store types only. The algorithm's value import belongs to the consumer preparation module, with no runtime cycle. This establishes a source dependency boundary, not universal tree-shaking or size evidence.

## Readonly boundary and equivalence limits

The callback receives the actual private map references. `ReadonlyMap<number, Readonly<SubjectLifetimeRecord<K>>>` forbids normal typed mutation of entries/records, but does not freeze, clone, or prevent retention/casts. The supplied helper does not mutate those sources. It builds new maps and new active records/nodes; untouched inactive records remain shared, just as the old `new Map(this.subjectStates)` did. “Detached planning” should not be read as deep immutable isolation.

A malicious replacement preparer could mutate the maps or return a forged target. Therefore safety depends on the fixed trusted internal function, not the callback type acting as an authority boundary. Current production wiring supplies that function explicitly; this is not an external plugin API.

There is also a narrow non-equivalence outside the inspected producer domain: source map references are now captured once at entry, whereas the old method reread `this.subjectStates` and called `this.subjectRevision`. An input accessor that installs a different prepared target during subject validation could make the old implementation consult replacement maps and the new one continue with the earlier maps. Similarly an override of subjectRevision is no longer called. This is a source-derived diagnostic, not an executed counterexample or demonstrated public operation regression. The production consumer supplies freshly constructed subject records and internally derived order arrays; no such callback is introduced by this split. Do not advertise unconditional equivalence for arbitrary reentrant internal inputs.

## Independent falsifier results

Command from the candidate archive (Node 24.15.0):

```sh
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test kernel --testFile=packages/kernel/src/lib/physical/store-split-review.spec.ts --skipNxCache
```

**4 tests passed, no assertion failures:**

- Preparation leaves active keys/revisions unchanged; subsequent rekey/removal/restoration installation preserves held lifetime identity, exact revisions, order, endpoints and frontier.
- Order-only target and untouched tombstone do not increment subject revisions.
- Duplicate keys/identities, invalid/duplicate order, missing and retired lifetimes refuse without changing live keys/revisions.
- The callback demonstrably receives the live, unfrozen source maps; delegation is exercised and leaves state unchanged when using the supplied planner.

A process check found another Vitest process and existing Rollup processes, but no matching benchmark process. I ran only this small Nx test; no cost measurement was performed or inferred.

## Additional owner evidence inspected

Under `/Users/jonathanborgia/code/signaltree/artifacts/store-preparation-split-2026-10-14`:

- `full-suites.log` reports Nx success for kernel/angular/react/vue/solid. This is owner-run evidence, not my rerun.
- `types.log` records the typecheck invocation and current generated proofs without reported diagnostics; exit 0 is also reported by the owner.
- `store-controls.log` reports 3 passing tests. I inspected the added `prepare-structural-target.spec.ts`: it covers typed numeric/string keys, preserved inactive/retired revisions, reading current maps on a subsequent prepare after install, unchanged fresh-ID allocation, and malformed targets. It was added after the full suite began, so its separate result matters.
- `bundle-comparison.json` and its logged output record the two fixture graphs, output hashes and preparation-module inclusion differences. Those are separate artifact evidence; I have not reproduced the generator or audited the size experiment here. They do not change the correctness conclusion.

Owner-reported demo and entity budget failures remain unresolved; neither suite success nor this review waives them. No adoption decision or cost conclusion is made.

Implementation hashes rechecked after the focused run and owner update:

- structural-store.ts: `56432ceccaa9c0ae3591a63ef7de5fb292c4961341faa6b99f31530c38a3c322`
- prepare-structural-target.ts: `33642f4fdef5306d2768e21871daa4318e7b281b709909708c3cb4c1ec1340fb`
- prepare-entity-target.ts: `1601e0084f563528c681343f28dc500a961cbc5cbbcefc94ded64967b4186734`
