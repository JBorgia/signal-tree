# Independent row-source admission premise review

Disposition: approve the minimal shared admission correction described below. The current anchor successor has a concrete row-Link classification mismatch; do not accept its 19 passing tests as a clean run. No runtime or test edits, and no independent execution, were performed here.

## Source and raw evidence

Reviewed /private/tmp/st-entity-anchor-successor/candidate against the retained-source predecessor's entity-signal.ts. The anchor delta moves defineEntityPublicationBinding from the raw api to the returned proxy; this review addresses the resulting admission alignment, not separate acceptance of that anchor change. Root HEAD 628d302dadb082a48c58528651c9088234d0a777; unrelated dirty work preserved. Read docs/review-contract.md and applicable previously read ownership/lifetime contracts.

Read runs/anchor-first/COMMAND.json, RESULT.json and first.log directly, not another review's conclusion. Recorded command: corepack pnpm nx test kernel --skip-nx-cache native-anchor-diagnostic.spec.ts link-native-address.spec.ts audit-entity-boundaries.spec.ts --maxWorkers=1. Exit 1: 19 passed, 2 timed out, 2 uncaught errors. Both timed-out cases are “row and field links retain ownership, enhanced=false/true”. The stack is installFact private.ts:151 -> ready :229 -> queued wake. The test awaits rowLink.settled() before constructing its field Link, so these failures do not demonstrate failure of that later field arm. The ten link-native-address controls separately exercise fields.

## Concrete mismatch

link.ts:314 already recognizes entityLocation and admits a row with no ordinary sourceAddress. accessorsFor supports its callable read/write form. The cast-free public fixture passes the EntityNode directly to link. entity-signal.ts:3283–3300 binds the row callable with registry, entity location owner/subject, and entity publication source/subject; its fields receive the corresponding field identity.

But link.ts:560 sets research.bindSource supported only for a collection, writable location, node accessor or recorded root. The source-issued row callable is none of those. Shortly afterward :575–613 detects its entity publication binding and registers a recipient anyway. Thus the same row is considered unsupported for native enrollment but supported for preparing entity source projection units.

experimental-publication/private.ts:350 onward enrolls source occurrences only if identity.supported && source. The row skips that branch. Its subscribed entity units nevertheless reach prepareSourceProjection and completeSourceProjection; ready :229 installs the completed value support on b.source. installFact :151 correctly refuses because no occurrence was enrolled. This is an upstream admission inconsistency, not a reason to remove that assertion or increase test timeout.

## Minimal shared correction

Resolve the own entity publication binding once before research.bindSource. Use that same binding as an additional supported-source case and as the decision/identity for registering the own entity recipient. Preserve existing ordinary source cases and existing sourceAddress/entityLocation admission. The relevant criterion is the source-issued binding already used by this pipeline, not “any callable”, a display path, a subject number alone, or a collection-shaped object. Avoid separate row/field approximations that can diverge again. Passing the resolved own binding through recipient registration, or an equivalently shared private classification, expresses the same fact without a new public API.

This lets a bound row enter the existing native enrollment path; it does not itself certify publication eligibility. Keep captureNativeOccurrence unchanged: it resolves the entity source's collection anchor, requires a registered root and address, traverses exact own data-property ancestry, compares final anchor identity, and adds the subject/field-specific source edge. RecipientOccurrences.enrollCaptured also validates issued occurrences and rejects a different root. Keep the anchor fix's exact returned collection identity. Do not enroll a row by re-resolving its mutable public key.

Keep installFact's missing-occurrence error. Do not invent a clean baseline/proof on that error, catch it and declare settlement, enroll opportunistically during ready, or substitute the collection's proof for every row/field. Source classification makes an existing validation path reachable; it is not a fallback grant. Binding metadata is a private source-produced premise, not a new adversarially unforgeable public capability claimed by this review.

## Row / field distinction and scope

Row projection consumes all relevant ordinary edits for its bound subject; field projection additionally selects the exact field, including absence. Fields generally already meet isWritableLocation, which explains their different admission path. The shared entity-binding case is valid for both, but must preserve binding.field === undefined versus an actual field key (including an empty-string key). Do not widen field subscriptions to every row edit or collapse row support into arbitrary scalar support.

Native occurrence enrollment proves source ancestry/identity, not current active-subject existence or permission to publish. Existing subject-bound projections and lifecycle requirements still govern removal, key reuse, pending ownership, inspection and rejection. An old row handle must not follow a fresh same-key subject. Hidden ancestor edges must remain unexposed; a verified anchor must not bypass absence.

## Finite falsifiers (proposed; not run here)

1. Replay the exact anchor-first Nx command unchanged. Require both row/field ownership cases to complete with their exact payload assertions, zero uncaught errors, and all ten native-address controls intact. Do not merely remove the timeout or skip settled().
2. Separate row and field Links over the same subject: one ordinary update reaches the row and selected field, while a sibling-only update does not contaminate the selected field. Include pending transaction hold then confirm/reject using existing contract expectations; enrollment must not send a pending/inspection value early.
3. Retained row rekey then remove/re-add same key: rekey follows the original subject, removal preserves absence, and later writes to the fresh subject do not revive the old row Link. Pair the existing field lifetime control rather than assuming its result covers rows.
4. Retain the native anchor negative controls for wrong ancestry/root or absent anchor, and an unbound callable negative case using the existing owned-source checks. No supported classification should turn a failed captureNativeOccurrence into successful publication. Verify source mismatch refuses, rather than merely having an endpoint that never records calls.
5. Dispose a row Link before a queued completion: no stale endpoint call, no uncaught missing-occurrence error, and no permanently pending settled work under the existing disposal contract. This exercises the newly reached enrollment/release path without a broad GC or cost run.

The first replay is the cheapest causal discriminator. A remaining enrollment error after the shared predicate is corrected would falsify the claim that this predicate is sufficient and require inspecting the failing source identity; it must not be hidden by a fallback. These are bounded validation gates, not authorization for unrelated repairs or full integration acceptance.

## Read identities

- `packages/kernel/src/lib/link.ts`: `6a5f67b2fe97dd276ccf2fef98c231704357125a249aa13d06267c17348fb51f`
- `packages/kernel/src/lib/entity-signal.ts`: `a2319dec7f66aa7f33f8a89a27951946553f50771496a3ceaf77ad7590c15ef9`
- `packages/kernel/src/lib/internals/native-occurrence.ts`: `421873e7534602a1328dc1d04dd3f09e80f955b66445b1d0b4044316a00773bc`
- `packages/kernel/src/lib/experimental-publication/private.ts`: `79d7a077ff92c33d07438843d291e41e8e16bc91b5e92eb00e81f492d6178da7`
- Raw anchor-first log: `5cefef0c44cc050f0afeeda0c2365fc927a847eff53ab0f56f21892ab445d026`
