# Independent joint publication phase premise review

Disposition: the ordering correction is necessary; the operation-local source recipe is a coherent bounded way to provide it. No fundamental impossibility established. It is not yet an implementation acceptance: callback-free sealing, activation/horizon semantics, and native first-callback feasibility require explicit qualification. Two concrete missing obligations were flagged to Main in the active conversation: immediate readiness registration bypasses notification deferral, and an operation seal must not close its enclosing declaration horizon.

Read DESIGN, Carver's raw handoff and cited failed rich runtime, my preserved scalar review and actual C0 lifecycle/occurrence/adapter source. INPUTS.json identifies those sources; DESIGN-reviewed.md freezes the reviewed proposal. Did not inspect Heisenberg's evolving implementation, edit author/runtime source, or combine candidates. This is a source premise review; no new phase implementation or framework experiment ran.

## Necessity, separated from implementation choice

The scalar control demonstrates per-source finalization before later sibling preparation: a later preparer opens a pending foreign owner while the earlier proof is already cached. Reordering delivery cannot repair that lost authorship window.

Carver's exact rich source has separate post-store defects: ordinary plan installation calls source completion inline; structural completion precedes structural and point read-model invalidation; point invalidation itself contains completion before epoch/updateSignals. The recorded rich observer reads direct11/12 but cached50/60. Source-completion diagnostics did not separately measure direct rows, so that stronger observation is not inferred. Moving one complete() loop cannot cover all three routes.

Live rekey is a separate producer-composition failure. In the rejected rich adapter, the planner at1431–1453 can legitimately resolve live rekey through __planRekey without a preparedContext subject. Later grouping at1561–1575 requires that subject anyway. Carrying the first source resolution is necessary; phase deferral does not repair missing authority transport.

A strong smaller alternative is to retain existing prepared closures and return explicit operation-owned handles for deferred proof sealing and detached completion, hoisting them at the existing heterogeneous operation coordinator. No generalized recipe interface is intrinsically required. However, same-source plans that install independent whole-Map snapshots still need one composed source result or predecessor-dependent deltas. Thus the alternative can reduce rewriting, but cannot avoid the ordering constraints or source composition. An ambient scheduler, rerunning preparation at install, or re-finalizing cleared proofs is not equivalent.

## Seal is not readiness activation

C0 lifecycle.ts:158–166 computes a final proof, clears input references and calls notifyRequirement outside active declaration frames. Readiness observers are not merely delayed endpoint sends: recipient-occurrence.ts:60–70 reads readiness immediately on replacement, updates per-contributor summaries, invokes onProof and later wake. onNativeRequirementReady at87–89 immediately invokes a newly registered callback if ready. Retirement also subscribes through this seam (and queues its own deletion).

Therefore replacing notifyRequirement with a deferred callback list is insufficient. Define both operations explicitly:

- A pure operation seal fixes the operation-owned authorship window after all callback-capable preparation. It must not invoke listener code, onProof, reporting, or source/recipient completion. It preserves each source's actual D/I/V and inherited facts rather than merging all sibling owners into every proof.
- Activation exposes installed readiness and drains exact registered obligations after installation/read readiness. NativeRequirementReady and immediate subscription must agree with this boundary; registration between seal and activation cannot bypass it. Disposed/replaced occurrence entries must not reactivate.

This need not be a public two-phase API or global scheduler. Operation-owned state and a detached activation receipt are sufficient in principle. Inspect the existing two readiness consumers before splitting: occurrence proof refresh and retirement scheduling do not, from inspected source, demonstrate a requirement to run arbitrary callbacks in the middle of sealing. No preparation/readiness cycle was demonstrated, but an implementation that requires one must return that concrete cycle rather than silently weakening the phase contract.

## Preserve the enclosing declaration horizon

Operation sealing does not imply complete declaration validation. prepareNativeRequirement associates requirements with the active horizon; finalizeNativeRequirement only caches/clears a proof with frames.length===0. finish(h), called when the outer declaration closes, resolves requirements and shared frame validation. A declaration can perform multiple writes and then contradict, throw, or reenter through reporting.

A write inside that declaration may install before the declaration closes. Its window must already be fixed, but its final eligibility must remain validating until the shared horizon closes. Readiness is consequently contingent on both the appropriate installation boundary and unresolved declaration validation. Do not freeze a premature proof, clear live frame evidence, or run finish(h) just because one operation sealed. Conversely, horizon closure must not activate a prepared but aborted/uninstalled unit. This conjunction is missing from a literal reading of “finalize every proof, then install.” It is a required refinement, not a new owner policy.

Pre-install failure must discard unpublished activation work, preserve independently committed nested writes and cancel registrations created for the abandoned unit. Post-install errors must drain remaining owned obligations exactly once. A readiness callback that throws cannot strand later source activation; preserve exact primary/secondary reporting behavior. These are phase-specific falsifiers beyond merely deferring source completion.

## Native current-read and timing boundary

C0's createCurrentReadonlyCell contract explicitly promises fresh direct ST reads without advancing application computed caches. Vue's source-linked wrapper keeps stable same-source metadata and calls readCurrent when the native recipe did not run. It is not authority to force application computeds to evaluate eagerly.

The phase design should say “all kernel read models and direct ST readers are coherent, and grouped native invalidations are installed before their permitted observers run,” not “every native computed has been recomputed.” The latter would relax the approved cached-native distinction. No prewarming user computeds, substitute carrier types, private framework internals or silent legacy-adapter fallback.

Actual grouping differs: Vue queues a shared publication trigger until outermost group exit; Solid uses batch; Angular's group simply executes run(). These names are not a universal callback-free guarantee. The existing optional native commit/token paths may read or publish at different points. Each affected route must classify operations that can invoke a getter, projection recipe, native subscriber or error reporter. All row/collection/key/scalar kernel cache/version work must precede the first such callback. Place detached completion outside the group body when group exit is itself the native publication frontier. Preserve established callback ordering and error draining at that frontier rather than assuming a second generic publication pass.

Required native discriminator: prime ST collection/key/leaf readers and separate application computeds, then at the first synchronous observer inspect every participating ST view and a newer reentrant777 write. Direct ST reads must reflect the complete unit, held native computeds retain their documented cache timing until invalidation, and no later outer cache rebuild may overwrite777. Check callback counts/order/error identity across supported facades; a permissive fake alone is not feasibility proof. No such new native probe was run in this review.

## Recipe composition and installation completeness

Carry source-resolved subject/key/value/revision/placement from first successful planning. Do not recover live subject authority by target-key lookup, optional context, or physical-row fallback. Validate original semantic ordinary endpoints before lowering. Keep numeric/string keys distinct and ordinary/physical images separate.

Compose remove→vacancy→rekey, fresh/restore→later same-subject update, and dependent anchors in the admitted execution order. A later phase cannot fix a same-source snapshot that overwrites earlier value installation. Preserve reviewed final ordinary placement reduction without changing sequential value/lifetime execution or explicit order precedence. No blanket fullcollection snapshot is justified by the phase repair alone.

All stores, terminal evidence, source revisions and mandatory internal compensation/witness folds must be complete before arbitrary reentry. A private registration is not proof a fold is callback-free: getters/equality and reporter paths must be moved to preparation or coherent delivery as appropriate. A callback-free install that can still discover a missing recipe midway is not atomic refusal. Validate actual unit completeness before any stores, including equal-display authority changes and publish:false ownership.

Direct writes should preserve the same semantics as one-participant operations, but routing them through a different lifecycle must not abandon existing interception, synchronous coalesce, retry/one-use, local recovery, or error rules. No need for an ambient operation accumulator: nested independent writes remain independent and invalidate stale outer plans through existing revisions.

## Finite acceptance gate

Keep the design's original scalar sibling/order controls, distinct rich/completion controls and ten live-rekey cases. Add/ensure:

1. A readiness callback opening an owner cannot run between sibling seals; new subscription between seal/activation cannot run early; throwing readiness callback drains later activations.
2. Two writes inside one declaration followed by contradiction/throw stay withheld until shared horizon disposition; rejected/aborted prepared unit never becomes ready; unrelated nested committed write survives.
3. First observer reads all relevant kernel and facade views coherently, native computed timing/counters remain exact, reentrant newer state survives every remaining delivery.
4. Same-source remove/rekey/vacancy, fresh restore, touched-value plus structure and typed keys compose without independent Map overwrite. Real stale-unit refusal must be reached, not masked by a missing-context error.
5. Fault injection at the actual new preparation boundary preserves all-state/history/no-delivery assertions. Keep the obsolete-hook original/log as historical failure rather than claiming it now injects anything.
6. Post-install native/source/rich/readiness exceptions preserve exact primary value and drain once; disposal/replacement cancels activation; no-op and publish:false do not lose installed obligations.

C0's placement146 and recipient172 are relevant regression selections, not acceptance of the joint mechanism. Source/spec types and the supported native feasibility controls must accompany exact frozen source review. No blanket full integration, timing or retention claim is warranted by this source analysis.
