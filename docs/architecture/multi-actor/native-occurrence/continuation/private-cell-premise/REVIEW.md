# Neutral private-cell premise (source-only, exact C21)

**A private registration flag is plausible internally; making every neutral createCell unobservable is not supported.** There are concrete observable-data uses of neutral createCell. Keep its existing default and all generic createWritable/application paths registered. No runtime patch, SDK capability, epoch conversion, threshold change, or new measurement was made. A remains frozen separately.

## Positive mechanism and boundary

Neutral location-runtime.ts:433–553 uses one createWritable implementation. It registers every location at :472; derive captures publication input before reading and calling the updater (:517+). createCell (:555) delegates to it, but its local writer ignores the preparation callbacks. Therefore private counter derives can incur factory input preparation even though that input cannot become a prepared write through this writer. This is the same discarded-capture route identified in the point stacks, not an application-authored updater consumption requirement.

Native-location-realization.ts:94–168 already selects registerIntrinsicMutationSource versus unobservableMutationSource with an implementation-local observable flag; createCell supplies false. The immutable shared source has no observer or publication hooks, and bypasses registration, not native cell creation. Neutral analogous selection could preserve its dependency node, read tracking, equality, binding, installed marking, notification/grouping and updater invocation order. It would eliminate source registration and its factory/capture for the selected cells. This is a reduction hypothesis, not a measured saving or a safety proof.

An implementation-only optional parameter on the closure does not inherently require an adapter/public change. But flipping createCell globally would be the wrong discriminator. The remaining design question is how known-private construction opts into the neutral implementation without extending LocationRuntime or interpreting custom implementations differently. No existing private-createCell selection facility was found in this audited source; this report does not authorize inventing an SDK capability or broadly bypassing factories. Preserve the default path when private ownership is not proven.

## Callsite classification

| Callsites | Actual role / escape | Disposition |
| --- | --- | --- |
| entity-signal.ts:419 version; :2255 neutralEpoch fallback; :2287 activation carrier | Numeric counters retained by closures/private maps; consumers take dependencies or use revision keys, not the carrier as application data. getSubjectStateSignal is consumed inside read paths (:3567). | Strongest narrow candidates, beginning with version. Preserve numeric values and derive/equality/notify order. No epoch conversion. |
| snapshot-authority.ts:40 membership revision | Private WeakMap carrier; observeMembership exposes a read effect, not the cell. | Private by inspected flow, but outside smallest point experiment. |
| restoration.ts:747–749 index/history/frontier | Private fields, read by currentIndex/history/canUndo/canRedo; index carries meaningful manager state, not merely a nonce. | Do not call every createCell a counter or assume every private value dispensable. Outside initial scope. |
| signal-tree.ts:2049 destroyed; devtools-impl.ts:275 metrics | asReadonly escapes. Neutral asReadonly returns the same function (:551); these are reachable carriers. | Unreachability argument does not apply. Keep existing registration absent separate evidence/authority. |
| signal-tree.ts:1530 fallback leaf construction | Actual leaf value if scalarSlotRuntime is absent. Normal construction supplies scalar runtime (:1837); existence of fallback alone is not evidence it runs in ordinary construction. | Retain actual-data semantics; do not delete by assuming unreachable for all internal/custom construction. |
| reactive-test-realization.ts → locations.createCell; intercept-leaf-signals.spec.ts, custom-markers.spec.ts, marker/unwrap/snapshot/link fixtures | Actual scalar/array/object values and custom marker state, not only implementation counters. | Existing observable-data behavior is a concrete falsifier of a blanket switch. |

In particular intercept-leaf-signals.spec.ts:10,65+ constructs count with neutral createCell and requires one write record with before/after, intent and metadata. intercept-leaf-signals.ts:146/168 attaches observeIntrinsicMutations; unregistered cells return no release (:intrinsic-mutation.ts:255+). These assertions cannot be dropped or rewritten to make an optimization pass. This conclusion follows source inspection; no new failure run was needed or performed.

## History and contract audit

c76814e0b5053602ef7e900d01dfa58aa07929e4 deliberately changed **native** registration, claiming private entity cell unreachability. Its actual diff leaves neutral location-runtime untouched. It explicitly reversed the cost assessment in 71182dd5, not the observability of reachable leaves. The historical entity representation has since changed; that old claim does not prove current all-createCell unreachability.

81780c4ebe084e4adbc3060b82bda2dda5c98152 introduced neutral intrinsic registration with callable location grammar. Current tests retain deliberate observation/interception reliance. This is stronger evidence than a helper's private-looking name.

intrinsic-mutation-pay-for-use.spec.ts retains late attach, release/re-attach and independent-source controls, plus shared source immutability. native-projection-observability.spec.ts documents that an earlier broad registration deletion passed the then-neutral kernel suite while deleting a real native capability; its explicit projection observer/release assertions remain load-bearing. No factory-wide suppression is justified by private-cell scope.

The queried spelling observeMutationSource is not present in the C21 TS/Markdown search; the relevant implementation here is observeIntrinsicMutations (and terminal/publication preparation). The source-registration decision also controls nativePublicationFactory invocation, so proving lack of observers alone is insufficient for reachable application data.

adapter.ts exports ObservationAdapter/factory primitives, not LocationRuntime/createCell or mutation observation. The SDK factory selects native versus neutral implementations internally (:85–107). This supports keeping an optimization private, but is not permission to change the behavior of custom adapters or test realizations. MaterializationContext contains locationRuntime internally; no public capability change is proposed.

## Minimum qualification before any later patch is accepted

Retain generic/actual-data observation and late attachment, application derive capture before callbacks, terminal/publication hooks, native projection observation, and custom marker behavior. For each selected private counter prove no carrier escape, no enrollment/terminal attachment, and equivalent same-value equality, changed writes, derive callback count/errors/reentry, grouped notification order and parent/current snapshot refresh. Keep native/custom adapter paths unchanged. Existing retained-readonly/reentry/late-enrollment controls and the unchanged point counter remain required. Demonstrate fresh operation-count reduction without assuming it reaches <2000. No such tests or mutant proof were executed in this source-only audit.

Bounded conclusion: investigate selective known-private neutral source suppression, **not** all-neutral-createCell suppression. It can in principle stay an implementation detail; the precise selection seam and behavior proof remain open. Historical native precedent is supportive but does not close those obligations.
