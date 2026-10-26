# Entity admission implementation map — read-only proposal

Checkout `/private/tmp/link-a1-successor-experiment`, HEAD `4d8157aa059f7e6e3fbb41de06ec0cb74de01973`. Inspected with active presence/aggregate edits; none changed by this review. Entity, Link and heterogeneous-adapter source initially match rejected d0. The root is separately changing D3 invalidation containment; this map refers to the inspected pre-D3 adapter hash below. No tests run. Root retains architectural and implementation authority.

## Concrete result

The existing live-point source supplies enough P/O value evidence to prepare the old right-row transition in the public reentry failure. The callback's newer ordinary field write reaches a different source seam, `commitExistingSubjectValue`; both must participate. Fixing only replay notification order cannot solve default Link generally.

Use one optional source-owned **prepared entity publication unit**, with the existing `PreparedPublicationUnit {record, completion}` installation carrier, feeding the existing relationship eligible projection. Do not attach another notification observer and call that admission. Native field/membership/order identity remains source-owned. The needed extension is a staged reducer input and a pure record install, not a second eligible snapshot store or new inverse selector.

There is a concrete extraction dependency: the heterogeneous install is not currently wholly callback-free. Structural `commit()` performs preparation, rich capture and some native invalidation. Separating pure preparation/install and delivering rich observers only after the complete selected atomic settlement installs restores the existing atomicity contract; it does not select new inverse authority or require a new owner callback policy. The contract adjudication below limits that conclusion to selected settlement, not ordinary partially successful authoring methods.

## 1. Minimal private interfaces

Proposed roles, not final exported names:

- **Entity source port:** one optional preparer held by the collection's mutating closure, discoverable at enrollment through a private symbol forwarded by the EntitySignal proxy. Avoid a new `__` string API and a WeakMap keyed only by the implementation object: `internals/entity-projection-seed.ts:1–33` explains why that misses the consumer proxy. Registration/release should compose affected optional consumers, like `preparePublicationMutations` in `intrinsic-mutation.ts:258–300`; an unobserved collection pays one absent-field branch. Do not import experimental proof machinery into the bare writer.
- **Prepared input:** collection identity `(registry, position)`, operation/unit identity and base revision; ordered exact O changes; literal authored field edits (including explicit row replacement versus omitted/deleted field); separately typed P placement/value facts; `CompletedTopologyUnit` including its order endpoints/domain when present; frozen participation/selected-disposition attribution; captured native updater-input evidence. Anchor/neighbor witnesses are not authored support or permission.
- **Result:** the existing `PreparedPublicationUnit`. Its record contains only precomputed internal writes/adds/deletes and pending registration; its completion is an opaque installed token. Adapt the existing token wrapper/installed guard in `intrinsic-mutation.ts:33–47,278–295`, rather than calling `completePreparedPublication` with a token that was never installed into that guard. Completion/drain is separate from public notification. No source-publication callback runs inside `installTerminalRecord`.
- **Grouped preparation:** a selected atomic operation offers all its constituent inputs to one preparation context per affected relationship. Do not prepare N replacement projection snapshots against the same old baseline and then install them sequentially: later prepared snapshots would erase earlier rows. Stage exact patches in operation order, or stage one combined patch. Sparse edits may share operation identity while retaining individual source-unit identities.

The aggregate worker's relayed contract leaves `PreparedPublicationUnit` unchanged and requires ordered O changes plus explicit `CompletedTopologyUnit.order`. This proposal fits that carrier; its input descriptor and source registration still need centralized agreement. Do not force every row/member/order unit into scalar `IntrinsicMutation.before/after` with inferred footprints.

## 2. Required producer seams

Paths below are under `packages/kernel/src/lib`; line numbers are the inspected source.

| Producer | Existing evidence and exact seam | Required admission behavior |
| --- | --- | --- |
| `entity-signal.ts:511–590`, `preparePointValues` | `prepareRealizationTransition(subject, after, edits)` prepares P/O; `install` writes all transitions at 542–545; invalidate and per-row notify/tap are separate. | Preserve supplied `edits` in the prepared publication input. Prepare once for the complete enclosing selected unit, install its private records with native writes, before `invalidate`. Return completion identity so later notify is observational only. This is the old right-row side of D1. |
| `entity-signal.ts:1980–2035`, `commitExistingSubjectValue` | Prepares O transition, ordinary topology and minimum responsibility; installs value/O/responsibility then calls rich capture. | Prepare publication before the revision check; install its record before `capture?.(...)`, `syncEntitySignal`, `updateSignals`, path/tap delivery. Return its identity with the transition. This is the callback-authored 777 side of D1 and must work for default Link. |
| `entity-signal.ts:1113–1340`, `commitAndProjectEntityMutationFrame` | Already prepares value transitions, exact `ordinaryPlan.changes`, paired topology unit and order, then calls `frame.commit`. | Extract a prepared frame result containing pure installation records, source publication input, rich-capture delivery and native delivery separately. Combine publication record with minimum responsibility before `physical/entity-mutation-frame.ts:393–410` can invoke its observer. Frame mutation `authoredFields`/value steps must survive; `CommittedEntityMutation` alone does not preserve equal authored-field attempts. |
| `entity-signal.ts:1700–1776,2140–2319`, prepared rekey/restore/fresh-add/remove | Current returned `commit` creates a frame and calls the combined function, then mutates epochs/active selection/signals. | Expose prepared install, invalidate and rich/public delivery phases to the existing hetero owner. Preserve occupied-destination/vacating-key and anchor selection. Do not simply move `commit()` into a supposedly pure install loop. |
| `entity-signal.ts:615–854`, `prepareOrdinaryRealization` | Supplies separately selected O changes, order endpoints and interval. Its install writes O while preserving physical backing. | Carry these outputs through the `CollectionNode` type (currently erases endpoints/interval at adapter 50–54). O changes are the selected publication facts; intermediate ordinary changes produced while installing physical structural frames must not independently author the eligible projection. |
| `entity-signal.ts:1791–1825`, `publishOrderChange` and frame callers | Order delivery is a rich capture channel; frame's `topologyUnit.order` already exists before install. | Admit order together with associated membership/field unit, not when this late callback runs. Keep public/capture announcement at its existing intended boundary. Order-only transitions require an explicit source-prepared unit even without a row event. |
| `physical/prepare-entity-target.ts:168,225–266`; `causal-runtime/target-transition.ts:131–154` | Declarative targets prepare O, install all collections, then complete and publish order/rows. | Thread the same entity publication carrier through this existing target port. Install source records before membership-close/delivery; register all selected units before `onCommitted`, order publication or invalidation. Otherwise history target replay remains an alternate late path. This is necessary coverage mapping, not a claim to reimplement target selection. |

Ordinary public bulk writers already share the frame/direct-value seams, but their existing partial-success boundaries remain. `addManyInOrder` finishes frame topology then signals/order/path/taps (2550–2646); `setAll` stages one frame then announces order and closes its membership reader unit (4590–4660). Do not group a whole arbitrary transaction, fold callback writes into it, or replace the ordinary ledger from the final physical row list.

## 3. Enclosing native operation and D3

`preparePointRealization` has two paths. The nonstructural path (adapter 864–931) prepares collection plans before installation, installs all collection/scalar/member plans, then invalidates/publishes. It needs a whole prepared publication context before that first install, with all records admitted before any publish phase. The structural path (736–787) delegates to heterogeneous install and has the same requirement.

`planHeterogeneousFrame` (937+) already selects physical removal/placement/rekey order and distinct selected ordinary plans (1380–1425). Preserve these owners. Structural preparation must use the existing prospective context/vacating-key and placement stages across the complete selected sequence: preparing each restore independently against the untouched live store would regress occupied-destination and anchor dependencies. Do not invent a second topology planner or validate a later step as though earlier planned removals had not occurred. Compose the complete publication input during preparation, using `ordinaryPlans` for O and physical plans for P. Suppress constituent re-admission under this prepared owner by passing the actual operation/token, not an ambient boolean that would swallow callback-authored newer work. All installed records must exist before `invalidate` (1464) or `publish` (1471). Validation after reentrant preparation must cover native revision and relationship preparation revisions; failed preparation installs no token.

D3 is independently mechanical containment: attempt each live-point invalidation and scalar invalidation despite earlier failure; retain the first error; attempt publication of installed work even when invalidation failed. Root owns that adapter edit. This does not require or prove entity admission. The direct `commit` path (1536–1548) currently differs from the composed caller's try/continue wrapper; both must retain installed obligations. Do not settle native groups early: `entity-tap-reads.spec.ts:262–283` fixes held-cell cache timing at group end.

### Timing adjudication: selected settlement, not ordinary partial authoring

`EntityMutationFrame.commit` calls `installOrdinary`, installs minimum responsibility, then invokes `observeCommitted` (393–410). `committedEntityObserver` routes to `mutation-capture-runtime.ts:157–181`, which invokes arbitrary registered capture listeners and can call an error reporter. Structural `plan*.commit` invokes this while later heterogeneous constituents remain uninstalled. It also calls `publishSubjectPhysicalChange`/`updateSignals`; the latter can enter the native adapter. An outer invalidation group alone does not prove this interval callback-free.

The governing source contracts resolve the interpretation:

- `RELEASE-1.0.md:1736–1745`: “All expected fallible semantic work precedes private commit”; “PRIVATE COMMIT consumes prepared instructions only”; and “no observer, publication adapter, persistence consequence, or other external consumer may observe an intermediate heterogeneous state.” The selected settlement's private substrate count does not change that boundary.
- A0 installation/composition clause 6 (line 96) requires composing the complete selected operation before capture/history/publication accepts its final domain. Line 99 expressly requires whole selected inverse preparation for atomic settlement and separately preserves ordinary methods' partial success.
- `enhancers/restoration/committed-entity-capture.spec.ts:29–72` requires the **complete committed frame** and stable subjects before publication. Its failure test (91–107) forbids uncommitted evidence; containment test (110–130) preserves later listeners. None asserts a right to observe later constituents of the same selected settlement still uninstalled.
- `heterogeneous-atomicity.spec.ts:15–39` repeats the external coherence invariant, but its forward runtime witness explicitly runs with normal batching (99–110,143–151). That test is not evidence for buffering all synchronous notifications or arbitrary callbacks in an ordinary transact body.

No intentional intermediate selected-settlement observation guarantee was demonstrated. Moving rich capture/error reporting and native callback-capable staging after **all native P/O and minimum responsibility/private records for that already-selected atomic unit** are installed is therefore a contract repair, not a new public semantic selection. Preserve each exact captured source record, listener containment, first error identity and complete-domain witnesses; do not change which effects were selected. Freeze record payloads during preparation, not by rereading after the first observer reenters.

Smallest implementation implication: split structural plans' current `commit` into prepared primitive installation plus later capture/invalidation delivery. The encompassing selected settlement performs every pure install first, admits the full operation's private records, then delivers prepared rich records and existing invalidation/path/tap phases. An ordinary standalone frame may keep its existing wrapper order (install → rich capture → invalidation/publication). Ordinary scalar capture-before-readd and partial sibling intervals remain unchanged. Do not pre-admit future uninstalled rows as a substitute for this split.

This conclusion is contract/source derived, not a newly executed rich-capture counterexample. A bounded falsifier is a committed-entity listener during mixed selected undo that reads both a restored structural collection and a later live-point row, then authors a newer row. It must see the complete selected state and retain its newer write; rich-capture failure must leave later installed obligations recoverable. The existing public tap failure proves the broader delivery defect but does not alone execute this earlier rich-capture seam.

## 4. Reuse the existing reducer; replace its two late authorities

`entity-egress-projection.ts` owns relationship-local `rows`, `keyOf`, `order` and physical topology. Reuse its lifetime identity, field projection, membership/rekey, local-order and eligible-order rules, plus Link's creation seed (`link.ts:340–446`). Different relationships retain different baselines. A source packet is not a canonical replacement baseline.

But `apply` is presently a mutating method, not a pure install plan. `projectEntityFields` spreads/reads row properties (36–54), `place` consults topology, and membership adoption reconciles occupancy. These operations cannot simply run in the primitive native install interval with arbitrary payloads. Add a preparation/staging form to this same reducer; prepare affected patches and validate base revision, then install internal writes. Do not clone the entire projection for each field or claim point-cost bounds from existing `order.includes`/occupancy scans.

Retain the separation between chronological P topology and exact selected O in `link.ts:57–89`; inspection updates local context without granting permission. P/O evidence is paired at source, not reconstructed from `structuralRecords` beside a P frontier: those records can describe ordinary changes. Explicit ordinary order must not be inferred from incidental neighboring rows.

For migrated sources, replace both late mutation paths:

- `link.ts:565–773` / `projection.ts:10` must no longer apply old public row events into eligible state. The source-installed unit updates direct collections, retained row/field links and ancestor branches' nested collection projection through their existing instances. A notification may wake/audit but may not grant authority or replay an already-consumed unit.
- `link.ts:1012–1054` currently subscribes to collection-order capture and queues a later microtask to reorder the projection. That separate queue must not subsequently overwrite the privately reduced order. Move its eligible work/pending obligation into the same installed unit, while preserving the capture channel for other consumers. Leaving this path intact creates a second chronological writer.

Keep `flushOutbound`, serialized sends, current consequence scheduling, inbound acquisition/reseed and disposal semantics. Default Link must register this source consumer even without `declare`; experimental support eligibility is an additional condition on that single projection, not a separate delivery copy.

## 5. Dependencies not supplied by this mechanical map

Entity aggregate declaration support still requires source-index enrollment for collection, ancestor branch and retained subject/field relationships, and per-fact support from the aggregate lane. Literal field equality must preserve authored footprint even without P/O difference. Native updater inputs must be captured before user execution: entity callable updater at `entity-signal.ts:2980–3000` currently calls user code before `replaceOne`; field writable projections likewise require a before-updater handoff. Late `commitExistingSubjectValue` cannot reconstruct those inputs. Do not enable full entity declarations merely because D1's literal setter passes.

No test pass is claimed. The unchanged D1, D3 and observer-mode D2 are the direct falsifiers; same-row other-field and order reentry distinguish exact reduction from revision dropping. Identity replacement, support lifecycle, cost and broader qualification remain outside this read-only mapping.

## Inspected source identities

SHA-256 at inspection (working copies may later change in other lanes):

- entity-signal: `956d39c81548d5168df8ba40a20ddedd40b89b10b46d26eebb2c37827033b013`
- tree-realization-adapter, before root D3 edit: `167803fd47bfa52469f125f7fcddae8c5a84842f52f41b9ef8fff252d52226d0`
- link: `1e854b98436cf1eac2b2c8e2d96ebd382031793fe02810589f555ffca93b6b4c`
- entity-egress-projection: `e68f53f77cf8cd3f67bf4e0be618a4cbb3b3bea71a8b33c10fb7d0bd677b6315`
- entity-mutation-frame: `0af1d67e76841a68d08c647205043e89c8b34c2f2757f503fe71b2d7260c3030`
- intrinsic-mutation, active branch-input edits: `9c08330121d31416ab63c7f1c9426619eb77950fa370dc865f888f7574821cff`
- mutation-capture-runtime, active presence edits: `54260cd194e6e3567acaad5e6045b0a89345d27e4da715f6f1dbacb54fcdb81f`
