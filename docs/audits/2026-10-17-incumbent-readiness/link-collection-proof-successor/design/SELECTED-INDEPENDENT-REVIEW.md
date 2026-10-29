# Independent selected-unit mechanism review

2026-10-29. Read-only review of SELECTED-UNIT-MECHANISM.md and its explicitly author-written SELECTED-UNIT-REVIEW.md. Independently inspected clean runtime `75416029be1e0c1d9735ed3bdc0f4e8e6c02f775` at `/private/tmp/link-authored-removal-successor`, A0 at `4ed3b6094404f59b940e601626408dbbadbec588`, original tests, and preserved final-gates.log. No tests run, runtime changed, or peer verdict consulted. Parent supplied two raw source leads concerning Vue and Angular carriers; both were checked against source.

## Disposition

The source-owned prospective placement/value preparation and selected install/capture phase split fit the approved mechanism. They need no new settlement selector, public outcome, or second canonical store. A0 already requires the whole selected inverse to be prepared before installation. The preserved failure demonstrates an implementation violation of that boundary, not a new request for stronger ordinary-method atomicity.

The concrete design is **not yet complete enough to clear all selected runtime work**: its projection-invalidation phase does not establish fresh kernel-provided collection/selection reads during callbacks across the native adapters. Neither raw selection installation nor substituting the existing writable-projection constructor closes that gap. This is a specific missing representation/protocol, not evidence that a new mandatory adapter API is necessary. Continue bounded private design of that phase; do not silently select a new API or flush policy.

## Governing invariants

A0, exact revision above, installation protocol:

> Structural realization must prepare its whole selected inverse domain before any installation, as already required for atomic settlement.

> Logical ordinary methods that presently allow partial success do not acquire settlement's all-or-none rule.

> Compose ordinary membership and order across the complete selected native operation before capture/history/publication consumers accept its final domain; an intermediate snapshot cannot stand for the whole operation.

> Native group timing does not promise fresh application-owned computed values inside groups.

The last qualification does not exempt SignalTree's own activeId, activeEntity, all, or ids carriers. It also does not authorize changing user-owned computed scheduling to make the internal fix easier. The approved successor contract at `392fcf46bb0cfa2e2a77dd6c4cae36c477331d6f`, SPEC.md “Mixed undo”, additionally says: “Do not reread a whole physical row into ordinary truth, suppress the complete operation, or add a flush.”

## Positive case: the preparation extraction is supported

1. The unchanged `packages/kernel/src/lib/internals/causal-runtime/committed-entity-selected-unit.spec.ts:6–43` requires the first left rich capture to see left a1 and right a11/b12, then preserve the callback's right a777. `/private/tmp/link-authored-removal-evidence/final-gates.log:97–125` records right50/60 instead. This failure actually ran previously; this review did not rerun it. Adapter `tree-realization-adapter.ts:1448–1462` installs left structural plans before right point plans; `EntityMutationFrame.commit:390–406` invokes capture inside the individual frame. Moving notifications alone cannot fix that interval.
2. `EntityMutationFrame.preparePlacement:144–168` first obtains every instruction from `prepareCommitInstructions:416–445`, which resolves every restore against the live store. `StructuralStore.resolveSubjectRestorePlacement:428–480` contains the actual successor/predecessor/tail rule. Applying that same algorithm progressively over a discarded preparation view is a derivation of existing placement semantics. Independently resolving all restores early against unchanged live state is not equivalent: B-before-C then A-before-B must see staged B when preparing A. Existing selected dependency order remains authoritative.
3. `tree-realization-adapter.ts:1385–1414` already separates exact selected ordinary effects from ordered physical logistics. The source-prepared arena can consume both without manufacturing O from P. In particular, physical inspection payload and incidental anchors cannot become ordinary authorship.
4. Source responsibility/support preparation before installation, revision checks after reentry, and exact immutable delivery records implement A0's existing obligations. They do not themselves grant permission to replay an updater, participant callback, getter, or equality function. The concrete planner must identify what it caches once and what pure metadata it may reprepare.

The prospective stage must include per-step occupancy/lifetime checks and resolved placements, not just final adjacency. Intermediate accepted steps and their evidence cannot be netted away. Selection value is also part of prepared state where a selected rekey moves it; delaying the entire ordinary setter until delivery leaves it stale.

## Concrete freshness gap

The following are source facts, not results of a new execution:

| Surface | Frozen implementation | Consequence for the proposed shortcut |
| --- | --- | --- |
| Native createCell | `native-location-realization.ts:147–159` owns backing but returns the adapter's realized cell. | Raw backing assignment alone does not synchronize a native published carrier. |
| Vue writable cell | `vue-observation.ts:107–124` returns cached `published`; invalidate copies backing then advances a revision. | A raw selection write is invisible until invalidation reaches the adapter. |
| Vue readonly selection | `entity-signal.ts:3502–3503` returns `.asReadonly()`; `vue-observation.ts:42–63` implements that as a cached computed. | Even the direct writable-projection reader is insufficient when the public readonly view was already evaluated. |
| Vue grouping | `vue-observation.ts:67–102,151+` postpones the shared publication trigger until group exit. | Merely calling token.invalidate inside the group does not establish freshness of already-cached readonly/derived views during rich capture. |
| Angular projection | `observation-adapter.ts:42–48` uses `linkedSignal(compute)` and an untracked read of that linked signal. | The proposed projection seam is not a universally direct reader. Its dependencies must become dirty before a fresh read can recompute. |
| Solid | `solid-observation.ts:69–92` has cached published cell values; `:118–125` has a direct writable projection. | Direct projection behavior does not establish a cross-adapter contract, and its existing memo-derived views remain a distinct question. |
| Collection projections | `entity-signal.ts:425–438` creates derived views over version; `:1405–1421` explicitly bypasses cached views inside taps. | The source already documents this freshness problem. Rich capture is not presently that tap scope, and activeId has no such bypass. |
| Runtime grouping | `native-location-realization.ts:23–76` may queue publisher.notify until group exit, in addition to adapter grouping. | “Invalidate all, then capture” is not a demonstrated cache-refresh boundary. It can only enqueue notifications. |

Counterexample to the shortcut: evaluate and retain a Vue `rows.activeId` readonly view, then select an inverse rekey that moves selected X back to A. Prepare and raw-install A, enter the existing invalidation group, queue its invalidation, and run the first rich callback before the group exits. Reading the retained public view may still return X. Replacing its mutable carrier with createWritableProjection leaves the already-evaluated readonly computed problem. The same issue applies to warmed all/ids/activeEntity views, so fixing only activeId is insufficient for native coverage of the original cross-collection capture requirement.

An early group flush is not a proven alternative. The original Vue `prepared-selection-publication.spec.ts:54–160` installs a synchronous watcher and requires delivered rollback frames to contain callback-authored final selection/rows (C, X, A, nested writes and thrown-callback cases). Publishing the pre-callback selected state first changes that behavior. A blanket extra flush also conflicts with the successor contract quoted above.

The existing token/group APIs expose observation and delivery; they do not explicitly expose a portable operation that refreshes every kernel-provided cached view without running observers. The present source does not prove that adding such an adapter method is the only solution. A private kernel freshness/read protocol might be possible, but must specify cached and retained carrier behavior, native shape/identity, dependency tracking, ordinary setters, and reentry. A getter-only substitution is not evidence for previously retained carriers. Do not turn this implementation gap into a new promise about application-owned computed values.

## Callback and error constraints

- Preserve existing rich evidence slices and their order/count. `EntityMutationFrame.commit:260–266` promises every touched lifetime once per frame; the standalone capture spec asserts both rows and a rekey in the same callback. Sharing one preparation stage does not authorize one new combined capture or per-instruction callbacks. Point preparation presently lacks a rich capture call; do not invent one.
- Capture evidence must be frozen from the selected unit. If an earlier callback authors777, a later callback can read777, but its supplied selected evidence must not be recomputed and relabeled as that later write.
- Preserve relative callback chronology, distinguishing cache freshness from observable delivery. The requirement to invalidate projections before capture cannot be implemented by allowing framework observers to run first merely because an adapter permits it.
- `mutation-capture-runtime.ts:157–182` contains and reports each rich listener failure and attempts later listeners. Adapter `tree-realization-adapter.ts:1465–1545` attempts remaining invalidations/publications and preserves the first error. Extraction must preserve both policies, including thrown `undefined`, rather than replacing them with a common fail-fast loop.
- Standalone public writers retain existing split-unit/partial-success behavior. The stronger selected barrier applies to selected inverses; it does not turn ordinary branch writes into a new transaction.

## Small remaining design gate

Before this mechanism clears implementation as a whole, specify a concrete preparation-to-delivery schedule with these distinctions: primitive P/O/selection/responsibility installation; kernel-owned fresh-read readiness; rich capture in preserved order; existing taps/path delivery; native observer delivery at its existing group boundary. Name which existing source/runtime function implements each distinction and what happens if readiness/invalidation throws.

Prewrite discriminators that warm and retain public all/ids/activeId/activeEntity views before a mixed selected rekey/restore/point inverse; inspect them in the first rich capture, then author a different selection/row from that callback. Preserve exact evidence slices and verify no later prepared write overwrites it. Run the same semantic case through Angular, Vue, Solid and neutral/React realization; observe each framework at its own supported timing. Keep the original Vue tap/watcher assertions unchanged. This adds a missing discriminator, not a substitute for the original selected capture test.

No owner policy decision is demonstrated by the placement extraction or these observations. A new mandatory adapter capability/public export, changed callback order, changed ordinary atomicity, changed placement policy, or second canonical topology would be a separate architecture boundary. Contributor contracts (`docs/contributor-contracts.md:27–68,75`) explicitly govern adapter additions; calling them private cannot bypass that boundary. Current result: preparation approach supported; complete adapter-preserving freshness/callback protocol still unestablished.
