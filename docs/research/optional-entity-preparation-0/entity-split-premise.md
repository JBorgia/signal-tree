# Entity target-preparation split: independent premise challenge

**The proposed callback injection is a defensible, smaller route than an environment getter. No premise blocker found, subject to the phase/type/dependency constraints below.** It can remove the outer preparation algorithm's static dependency from plain EntityMap without a public API change. It does not establish net byte savings, remove all prepared facilities, or prove the eventual implementation equivalent.

Read-only review at clean `f962e903` in `/Users/jonathanborgia/.codex/worktrees/capture-point-owner/signaltree`. No source edits, tests, builds, or implementation. Only this report written. Main source references below are relative to that checkout. Reviewed the concrete proposed route, not an applied diff.

## Minimal route for this bounded experiment

Keep `__prepareTransitionTarget` present under its existing position-ID condition (`lib/entity-signal.ts:4260–4271`), including `owner`, `ownerPath`, and `readSource`. Replace its internal preparation implementation with `prepareTarget(target, algorithm)` invoking a caller-supplied, generic `EntityTargetPreparer` against the collection's existing typed physical environment. The entity module must import the preparer/host types **type-only**, never import the implementation as a default or fallback.

The minimal runtime import belongs in `lib/internals/causal-runtime/target-transition.ts`: its aggregate installer at line 102 is the sole production invocation of collection `binding.prepareTarget(collection)` found. Change that invocation to pass the extracted algorithm. Restoration and transactions already import this optional installer; they need not each introduce separate registration or setup. Leave scalar/member `prepareTarget` contracts alone. Direct real-binding tests must explicitly import/pass the same algorithm; fake bindings used to test aggregate sequencing can remain fakes, but do not confuse their success with testing the bridge.

The dependency direction becomes:

- Plain entity owner → existing stores/cells/publication machinery + type-only preparer contract.
- Optional target-transition consumer → extracted algorithm → physical operations supplied by that owner.

No new public export, module registration, process-global factory, or mutation of global configuration is needed. No new runtime type module is needed merely to carry interfaces. A small internal type module is acceptable if it avoids cycles; retaining type-only declarations alongside the optional algorithm is also sufficient. Do not move broader causal orchestration into the entity owner.

## Binding and type ownership

`CollectionTransitionTargetBinding`, target/source types and `PreparedCollectionTransitionTarget` are exported **from the internal module** `lib/internals/causal-runtime/target-transition.ts:4–42`; that is not a package API export. Searches of `src/index.ts`, `src/adapter.ts`, `src/internals.ts`, public entity types and the package export map found no public exposure of this binding/target type. No framework source consumer of the named binding was found. The existing root/adapter/internals public inventories must remain unchanged, including declaration reachability; do not add `EntityTargetPreparer` to a barrel just to satisfy an import.

Use a generic *call signature* accepting each owner's `K extends string | number` and `E extends Record<string, unknown>` together, e.g. a preparer that works for every `EntityTargetHost<K,E>`. An erased `(host: EntityTargetHost<string | number, Record<string, unknown>>) => ...` is not an equivalent contract for invariant stores and key-specific callbacks. Avoid solving incompatibility with `any`, double casts, broad callback parameter widening, or public type changes. Existing target values are `unknown`; preserve the current runtime entity-value validation and key/value conversion points.

The bridge changes an internal calling convention. Existing one-argument direct callers need conversion; a default implementation imported by the owner to preserve that convention would defeat the dependency cut. Keeping this hook callable by arbitrary external casts is not an obligation of the public EntityMap contract.

## Callback injection versus environment getter

Injection is not intrinsically less safe here. This is trusted kernel implementation code, not an extension API or sandbox. It grants the selected callback access during a call and avoids adding a separately retrievable store/cell environment. An environment getter would expose the same powers more directly and broaden the internal seam unnecessarily.

However, injection is **not** a capability security boundary: the callback can retain its host, invoke callbacks out of order or install prematurely. Narrowness comes from the internal type and a single audited implementation/callsite, not the syntax. Pass only dependencies the existing algorithm needs; do not pass the entity API/root/runtime wholesale. Do not add support for arbitrary plugin preparers. Avoid extra validation or defensive cloning in the bridge that would change ordering or duplicate the algorithm.

For this experiment, typed references to existing stores and maps can be reasonable internal dependencies. A broad new public “entity physical environment SDK” is not. Existing class methods require their receivers: pass store objects or bound owner closures, not destructured unbound methods. A return value containing install/publish closures necessarily retains some environment until settlement; do not claim a memory improvement.

## Phase equivalence is the main risk

“Algorithm moved verbatim” is insufficient if closure reads become captured host values. Preserve all of these boundaries from `entity-signal.ts:535–715`:

- **Preparation:** owner mismatch is rejected before snapshot work. Capture current selected key/subject and current physical rows before target value cloning. Cloning can execute user getters; moving the initial reads after cloning changes reentrant behavior. Clone/validate every target value, prepare structural/value targets, compute selection, neighbor and publication records before installing anything.
- **Handle sampling:** `subjectEpochs.get` and `subjectStateSignals.get(...).deref()` currently occur during preparation. Keep those specific handles in the prepared publication records. Re-looking them up at publish time is not a verbatim move and can change what newly materialized readers receive.
- **Installation:** read `membershipTap` at install time, **once per install**, immediately before OPEN. Close the same sampled tap in `finally`; do not call a getter again for CLOSE after a reentrant subscriber change. OPEN currently occurs before the `try`: moving it inside changes exception behavior. Install structural store, value store, then selection, in that order. Preserve the selection assignment at install, not publish, so nested replay writes are not overwritten later.
- **Publication:** advance captured epochs/state handles, update collection signals, optionally advance physical revision, then emit each path notification and its lifecycle tap. Preserve fresh ambient metadata/position reads at their existing invocation points; do not cache `ambientMeta()` or metadata results when constructing the host. Keep `intent: 'system'`, `participation: 'realized'`, no rekey lifecycle tap, and silence for unchanged values.
- **Mutable closures:** supply `getMembershipTap()` (or equivalent getter property read at the exact phase), not a host value copied at collection construction/preparation. Audit every other captured binding for assignment; stable store objects can be retained, but calls that query current state must remain calls. Do not snapshot callback registries; retain owner callback functions such as `emitTap` that consult the current registry.
- **Aggregate boundary:** `target-transition.ts:66–133` prepares all owners before any install, installs member targets before more specific collections/scalars, completes all installs and the commit callback before publication, and attempts all owner publications while retaining the first error. Transactions additionally hold membership delivery and run the invalidation group (`transactions.ts:2535–2560`); restoration does likewise with restoration write context (`restoration.ts:3118–3150`). Keep these wrappers untouched.

The existing internal prepared return type advertises `publish()` while the concrete entity implementation accepts optional `advancePhysicalRevision`. Preserve that concrete capability if any bridge/types expose it; do not casually “simplify” the signature as part of extraction.

## Readers that must not acquire the algorithm dependency

- `plain-branch-membership.ts:65–73` uses binding presence/owner equality to identify a collection; `562–570` reads installed rows for omitted storage; `743–754 collectionBindingAt` finds a hidden collection by structured address.
- `state-location-view.ts:46,123` reads subject truth through `readSource`.
- `restoration.ts:1824–1842` reads sources to materialize history; `2974–2980` uses sources for admission; `3045–3069` collects visible and hidden bindings for replay.
- `transactions.ts:2446–2478` collects sources/bindings including hidden owners; `2694–2705` reads source for declarative admission.

None of these read-only operations needs to call a preparer. Do not replace `readSource` with `all()`/snapshot/Link projection: hidden physical rows and current installation state are intentionally different from exposed snapshots. Keep metadata presence on plain EntityMap; gating the whole binding on restoration would change collection-membership recognition.

## What the split cannot promise

With stores/physical ports left with the owner, `StructuralStore.prepareTarget/installPreparedTarget` and value-store target methods can remain retained class methods. Owner callbacks/host construction also cost bytes. `preparePointValues`, restore planners, deepClone/deepEqual used elsewhere, epochs and normal mutation frames remain outside this experiment. A plain build can lose the extracted outer algorithm yet retain substantial preparation machinery. That is a valid partial result if net output improves; it is not failure requiring immediate scope expansion.

After implementation, the decisive dependency check is absence of the extracted implementation from the plain EntityMap emitted graph, with enhanced graphs still reaching it. Compare net same-fixture output, including bridge/host overhead, rather than treating deleted source lines as savings. This review performs no build and assumes no outcome.

## Must-preserve existing tests

Use the existing Nx routes; preserve assertions when adapting direct internal calls. These are relevant contracts, not claimed run results:

1. `lib/physical/declarative-target-binding.spec.ts` — all three tests: held SubjectId facades through reorder, key swap, detached target values. Pass the extracted algorithm explicitly at lines 53,107,143.
2. `lib/internals/causal-runtime/target-transition.spec.ts` — especially lines 371,409,440: all-owner preparation failure leaves every owner untouched; all installs precede publication; scalar preparation belongs to the same boundary. Keep fake-binding tests and real-binding tests distinct.
3. `lib/internals/causal-runtime/target-transition-key-handoff.spec.ts` and `lib/physical/subject-record-target.spec.ts` — target identity/placement rather than ordinary mutation substitution.
4. `lib/entity-selection-lifetime.spec.ts`, `lib/entity-replay-taps.spec.ts`, `lib/entity-replay-tap-boundaries.spec.ts` — selection ownership, correct replay tap payloads, unchanged-row silence, nested writes and self-unsubscribe.
5. `lib/absent-collection.spec.ts`; `enhancers/restoration/designated-collection-omission.spec.ts`, `hidden-collection-nesting.spec.ts`, `hidden-terminal-reversal.spec.ts` — hidden physical storage remains readable/replayable. The designated-omission helper directly calls `prepareTarget` at line 111 and must pass the implementation; readSource-only helpers must stay read-only.
6. `enhancers/restoration/set-all-order-reversal.spec.ts`, `jump-undo-equivalence.spec.ts`, `collection-order-refusals.spec.ts`; `enhancers/transactions/reentrant-order-bookkeeping.spec.ts` — declarative order restoration/refusal and reentrancy.
7. `lib/entity-membership-link-restoration.spec.ts`, `lib/link-order-audit-regression.spec.ts`, `lib/internals/causal-runtime/post-application-failure.spec.ts` — membership delivery, projection order, post-install failure handling.
8. Native consumers: Angular/Vue/Solid `src/lib/transaction-realization.spec.ts`, Angular `restoration-reactivity.spec.ts`, Solid `native-publication-error-boundary.spec.ts`. The owner still supplies framework-bound locations; extracting the algorithm must not bypass their invalidation/error semantics.

Source typecheck, spec-types and unchanged public export inventory are necessary complements to runtime tests. Existing tests do not automatically prove install-time tap lookup was preserved: inspect that code explicitly, and if its behavior is changed/uncertain, a focused late-subscription-between-prepare-and-install falsifier is warranted. No tests were run or added here.
