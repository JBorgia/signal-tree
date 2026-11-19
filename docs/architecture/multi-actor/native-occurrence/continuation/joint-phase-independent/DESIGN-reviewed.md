# Joint source-owned operation recipe — for Main review

**Proposed bounded mechanism, not authorization to implement.** Use the existing prepared heterogeneous operation as the phase owner. Add no global scheduler, persistent authority overlay, public API, or source-kind exception. Direct writes use the same order as a one-participant operation.

The later experiment must start in a new disposable copy of frozen C0: `/private/tmp/st-native-combined-c/candidate`, snapshot `SNAPSHOT-C0.json`. Main reports146 placement/172 recipient controls and source types pass; these are not independent replays by this review. No C0 runtime was modified or used for an experiment. Carry forward only the relevant scalar successor logic, corrected at its phase boundaries; do not apply the rejected rich patch wholesale.

## Distinct causes, now reconciled with Carver

Read `/private/tmp/st-rich-unit-causal-trace/HEISENBERG-HANDOFF.md` and checked the cited frozen source. This corrects the earlier rich RESULTS generalization:

| Defect | Exact current boundary | Required correction |
|---|---|---|
| Sibling proof gap | Scalar `tree-scalar-slot-runtime.ts:207–224` prepares sequentially; `intrinsic-mutation.ts:322` finalizes each source immediately | Retain unfinalized units until all owning-operation preparers finish |
| Completion during installation | Rich adapter1600 → ordinary plan `entity-signal.ts:1016–1025`; finalize and source complete both occur inside install | Hoist finalize before **all** stores; detach completion until **all** read models are ready |
| Rich observation before readable coherence | Adapter1618 → structural complete → entity-signal1555, before invalidate | Release observations only after operation-wide read readiness |
| Completion inside point invalidation | Entity-signal673 calls source complete before epochs/updateSignals | Split read-model work from completion; renaming or reordering outer loops is insufficient |
| Live-rekey preparation regression | Adapter1431–1453 resolves live rekey, but1567–1571 later requires restoration-context subject | Carry the source-resolved recipe, never reconstruct it from optional preparedContext |

The completion diagnostic does **not** separately measure direct rows; its measured stale cached collection and stack establish its earlier boundary. Rich observer diagnostic measures direct11/12, leaf11, cached50/60, final777/12. Keep these claims separate. Ten live-rekey-dependent failures are introduced preparation failures, not inherited reds or proof that stale-unit refusal works. The eleventh failed test patches an obsolete commit hook and no longer injects its intended fault.

## Minimal private recipe

The existing adapter collects a finite array of prepared source parts for **this operation only**. Each part supplies its existing source-owned store recipe, source/revision/enrollment validation, unfinalized publication units, read-model invalidation work, and detached completion/publication work. These are responsibilities to separate in current closures, not a proposal for a general dispatch framework.

1. **Prepare all parts.** Resolve scalar equality/ordinary shadows, structure, selected points and ordinary disposition. Run callback-capable source/recipient preparation and responsibility construction. No outer stores. Preserve operation-local scalar predecessor threading and exact per-contribution coverage from the passing scalar work. Nested independent writes do not join by ambient context or inherit predecessors.
2. **Close preparation, finalize, validate.** After every participating preparer, finalize each operation-owned proof once, then check every captured physical/source/enrollment revision and recipe structure before any store. The returned installation closure checks staleness again, but never resamples the authorship window. Actual native D/I/V and invocation snapshots stay per source; no blanket union or altered recipient-only policy.
3. **Install every part.** Apply physical values/placement, ordinary transitions, terminal evidence and required internal witness bookkeeping. Advance the shared clock at its existing single-unit boundary. There must be no remaining equality, arbitrary getter, missing-subject resolution, source completion or public observation inside these install closures.
4. **Make all participating reads current.** Under the owning operation's existing invalidation grouping capability, update all affected row/leaf epochs, collection versions/queries, membership/order/active-key reads and scalar carriers before any callback can inspect the unit. Per-source nested invalidation groups are not sufficient evidence by themselves.
5. **Drain delivery and completion.** Once read-ready, release existing callback-bearing invalidation/scheduling, source completions, rich observation and notifier publication in their established causal order. Drain installed obligations despite errors. No outer store/cache reconstruction remains after the first reentrant callback. Captured event payloads retain their operation facts; subsequent callbacks may read a newer nested777 state.

Dependencies are strictly **all preparation → proof finalization + validation → all stores → all readable state → arbitrary reentry**. Source kinds do not change those dependencies. This fixes the *boundary* problem; source recipe composition below fixes a different preparation problem.

### Finalize must actually be safe at that boundary

Existing `finalizeNativeRequirement` scalar lifecycle155–166 computes proof, clears inputs/known and invokes `notifyRequirement`. Merely delaying a loop of current finalizers may still let a later readiness callback create an owner after an earlier proof is irreversibly sealed. Do not finalize twice.

Classify these existing callbacks before implementation. Callback-capable preparation/readiness work needed to build a unit must finish before any seal; final proof sealing itself must not deliver. Installed eligibility/retirement wakes belong after the required installed/read-ready boundary. If current readiness dependencies cannot be separated this way, that is a concrete design blocker to return to Main, not license for a generalized scheduler. The fixed-window policy and inherited proof facts remain unchanged.

### Do not assume invalidation is callback-free

Structural invalidate includes subject notifications and active-id replacement; point invalidate includes completion; scalar publish wrappers include completion. Split their responsibilities at these actual sites. Use the existing facade grouping primitive only if a first-callback control proves every relevant native read is fresh across the entire unit. Do not silently invent a native silent-write mode or change computed/synchronous subscription timing. Native feasibility is an explicit qualification gate, not established by the method name `runInvalidationGroup`.

Private transaction/restoration witness folds must remain synchronous and ordered before arbitrary observation. The rich witness/listener distinction is useful evidence, but private registration alone does not prove a callback is safe inside install. Prepare getter-dependent operands earlier; retain source-issued authority bookkeeping at install; defer callback-bearing error reporting until coherent reads. Do not defer compensation ownership behind an application callback or blindly transplant rich witness code without auditing its actual folds.

## Carry recipes from their first source resolution

Keep the subject/value/key/revision and placement constraints already resolved by the successful live rekey planner. Fresh/restore preparation can supply later subject recipes; an absent restoration context is legitimate for a live rekey. No target-key lookup after planning, invented lifetime, or physical-row fallback may reconstruct authority.

For one source, compose admitted remove/restore/fresh/rekey and touched-value transitions in the existing physical operation order. A removal supplies a vacancy to a later rekey; subsequent same-subject instructions consume the earlier proposed state; numeric/string keys stay distinct. Carry exact selected ordinary disposition separately. Structural and live-point plans may not install independent whole-Map replacements based on the same predecessor: prepare a single source result or explicit predecessor-dependent deltas before stores. Keep this finite proposal local to the existing operation, not a persistent root or generalized overlay.

## Error and lifetime obligations

Before install, failure leaves all outer state/history/evidence unchanged; independently committed nested work stands. Validate at the actual new preparation boundary, not an obsolete hook. Install closures must be prevalidated and callback-free; catching a partially installed invariant error is not atomic rollback.

After install, preserve committed truth, exact primary error identity and the established secondary reporting path. All completion owners drain once, including equal-display authority changes and publish:false. Capture installed completion parts independently of current subscriptions or changedSlots; consume ownership before invoking callbacks. No later outer write may overwrite nested777. Disposal releases owned work without pretending to settle unresolved owners. No universal GC guarantee is implied.

## Bounded integration and preregistered gate

From C0, port the scalar successor's source binding, ordinary inspection baseline/adoption, predecessor threading, exact coverage transport, installed-completion ownership and finally-drain logic with scoped phase corrections. Retain C0's reviewed placement and recipient classification. Rework only the required source recipe/phase seams; reject wholesale import of failed rich runtime.

Preserve these discriminators before execution in the later authorized copy:

- Scalar later-sibling red plus earlier-sibling positive; mixed structural/point later preparer; no stores before install; per-source native proof, fixed later-owner exclusion and useful terminal wake. Include a finalizer/readiness callback counterexample, not just preparer order.
- Both original rich/source-completion falsifiers, their distinct stacks and negative controls; first invalidation callback reads row/leaf/all/order/key/scalar coherently. Nested777 survives; native facade timing remains exact.
- All ten live-rekey-dependent cases, same-source two-restore positive, fresh-restore dependent anchors and structural/live-point Map overwrite. A throw at missing-subject must not masquerade as stale-unit safety.
- Preserve obsolete fault-injection original/log, then add equivalent failure at the actual source-group preparation seam with unchanged atomicity/history/no-delivery obligations. No automatic oracle waiver.
- Scalar primary/secondary error/drain controls, rich observation errors, disposal, no-op, publish:false; C0 placement146 and recipient172 selections, then appropriate source/spec types. Counts are scoped, not release acceptance.

Main must review this concrete recipe and the native read-readiness feasibility before authorizing the successor implementation. Carver's raw handoff is integrated as independent causal evidence; no claim that Carver has endorsed this design.
