# Bounded scalar completion/horizon audit

**Conclusion:** the inspected supported scalar-selection paths support a finite synchronous completion/validation lifetime for an installed-only readiness registration. No concrete stranded installed scalar requirement was found. Source replacement, Link disposal, or owner settlement need not own cancellation: retained aliases can normalize the same requirement in place after readiness without reinstalling an endpoint. No refcount requirement follows from this audit.

This is a source-derived guarantee for the paths below, conditional on normal synchronous unwinding and the existing callback-free installation contract. It is not a universal proof over every caller or arbitrary private requirement. No tests, experiments, runtime edits, or implementation approval. The report uses only source already inspected; no additional exploration after the stop instruction.

Source root: `/private/tmp/st-c25-equal-owner/candidate/packages/kernel/src/`. Paths below are relative to it. Exact observed source copies/hashes are recorded in SOURCE-IDENTITY.json. The design input was `/private/tmp/st-finalized-role-design/DESIGN.md`.

## Evidence chain

1. **Installed-only boundary.** `lib/internals/intrinsic-mutation.ts:54–67,329–347`: scalar composition places native completion first, installs a completion token with the terminal record, and completion deletes that token before running all parts. Each part is attempted despite earlier failure; the first error is rethrown. Failed preparation without token installation cannot activate through this gate. Internal terminal record writes are callback-free by contract (`:8–16`); this conclusion excludes injected throwing record setters or partial corruption of those stores.

2. **Direct neutral and native leaves.** `lib/internals/location-runtime.ts:477–505,510–540` and `lib/internals/native-tree-scalar-leaf-runtime.ts:221–290,299–371`: replace/derive retain the prepared completion and call it in finally even when capture, publication, or an observer throws. Completion failure does not replace an already-thrown primary error. User updater failure before preparation creates no installed requirement for that invocation.

3. **Scalar frame drain.** `lib/internals/tree-scalar-slot-runtime.ts:238–270`: installed frame completion drains the captured unit list, attempts every unit, and preserves first error. `tree-scalar-leaf-runtime.ts:56–65` and `native-tree-scalar-leaf-runtime.ts:50–59` call completeScalarFrame in finally around invalidation. This includes frames with no changed notification slot but installed publication work.

4. **Inspected restoration dispatch.** `lib/internals/causal-runtime/tree-realization-adapter.ts:705–738,1677–1682,1751–1783,1828–1831` records detached scalar completion before publication; the inspected dispatcher drains detached completions through `post-application-failure.ts:23–38` even after application/delivery errors. Heterogeneous completion also attempts its individual plans after failures. These are concrete traced routes, not certification of every realization caller.

5. **Independent barriers.** `lib/experimental-publication/lifecycle.ts:118–147,201–214`: no-frame finalization closes validation but retains the activation barrier. Installed native completion (`private.ts:182`) removes activation on the actual prepared requirement. For active declarations, validation remains unfinished until finish. Ready means both barriers clear recursively through components, not proof existence and not owner confirmation.

6. **Horizon always unwinds.** `lifecycle.ts:350–373,379–418`: runDeclaration pops/decrements in finally, including callback errors, invalid declarations and async-result refusal. The last synchronous frame calls finish. Finish caches all installed source proofs, clears inputs/frames/known and unfinished membership before recipient recomposition and readiness delivery. It then attempts every ready requirement notification despite notification failures. Existing frame/proof computation before notifications is internal; no supported callback-induced failure there was identified in this audit.

7. **Registration releases before callback.** `lifecycle.ts:128–147`: already-ready registration invokes immediately without installing a listener. Otherwise check releases every child subscription and clears its release list BEFORE invoking the callback. Notification snapshots/drains callbacks and preserves first error. A normalization callback throwing after release cannot leave this registration armed. Reentry creates/uses the appropriate new work; it does not reopen the old finished horizon. Transient notification-stack references can survive until that synchronous delivery returns.

## Lifetime rule supported by this trace

Enroll only from the exact installed scalar native completion, using the installed selected requirement—not inside combine/preparation. If already ready, normalization can happen immediately. Otherwise its strong temporary ownership can belong to the still-unwinding completion/validation work until both barriers close. Pending owners need not settle. Replacing the source or disposing a recipient does not establish that inverse/snapshot aliases disappeared, and does not require cancelling this finite registration prematurely.

Activation-before-finish waits for horizon closure; finish-before-activation waits for installed completion. Closed older scalar constituents are already ready; unfinished installed scalar constituents have the same completion/horizon unwind obligations. This is a bounded-by-outstanding-work lifetime, not a constant numeric bound independent of nesting, user callback duration, or number of installations inside an open horizon.

Implementation still must service registration/normalization if activation delivery itself throws: placing enrollment only after an unguarded throwing activation call could skip normalization. Enrolling at the installed boundary before activation, or an explicitly error-safe ordering, must preserve native-first completion and first-error/drain behavior. This audit does not choose or implement that ordering. Do not reinstall the old endpoint; normalize the recognized requirement identity shared by surviving aliases.

## Explicit limits and non-scalar finding

- No concrete public scalar stranding counterexample was established. This is static evidence; readiness/listener-count, reentry, failure, and alias-normalization tests remain unrun.
- All alternate scalar-frame callers, every structural/member producer and every custom realization were not exhaustively traced. `commitSlot`-style low-level convenience paths were seen but their complete caller graph was not audited. They are limitations, not inferred public defects.
- Entity `completion.support` may remain explicitly unchanged. No general entity-normalization lifetime is certified here.
- An inspected non-scalar gap prevents universalizing the conclusion: `lib/entity-signal.ts:3278–3308` defers entity completion, then deep-clones the caller-derived row before reaching updateSignals(committed.complete), without a surrounding completion finally. `internals/utilities/deep-clone.ts:13–22,110–125` can reach caller-controlled reflection in its fallback. A throwing proxy/reflection input could bypass activation after installation. This is an UNEXECUTED public-input candidate; accepted-input reachability and the resulting requirement state were not reproduced. It does not refute the narrower scalar completion trace or justify expanding this audit.
- Process termination, nonreturning user callbacks, arbitrary private proof/record injection and resource exhaustion are not synchronous-unwind guarantees.

**Disposition:** source evidence is sufficient to support the narrowly scoped scalar horizon/completion ownership premise, without requiring source-replacement cancellation or refcount by assumption. It is insufficient for a universal shared-normalizer guarantee. Keep entity support and untraced paths outside the premise; preserve separate implementation review and falsifiers.
