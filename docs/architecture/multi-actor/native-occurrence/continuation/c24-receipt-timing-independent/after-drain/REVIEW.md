# Post-drain ancestor receipt classification

**Bounded classification: known recipient-domain coverage uncertainty is permitted here; the observed conservative/unknown receipt does not establish a native input-coverage defect. Do not count this as a passing test or as demonstrated confirmation progress.** The new first failure remains archived unchanged: six pass/one fail, now after the drain. This supersedes any inference that timing alone would obtain held.

## Concrete source chain

Frozen C24 kernel source references:

- experimental-publication/private.ts:169–178: beginBranchInput receives the root updater source, while this binding's address is pair. `within=relativeSourceAddress(pair,root)` is undefined; `encloses=relativeSourceAddress(root,pair)` exists. Aggregate `covered` remains false, so this recipient records `recipientDomainUnknown:true`. The same function separately calls nativeInputs(root,supplied), which traverses/certifies the whole actual native input.
- private.ts:352–365 carries recipientDomain into the operation's coverage uncertainty. lifecycle.ts:260 distinguishes this from unobserved authorship; :271 does not manufacture an incomplete native window solely from recipientDomain.
- lifecycle.ts:365 explicitly ORs coverageUnknown into the closed operation proof. private.ts:279–282 combines that authored proof with native support; :318–320 projects the selected occurrence proof. lifecycle.ts:240–243 checks unknown before selecting held. Therefore a pending actual input owner and conservative/unknown receipt can coexist. The receipt does not assert that no known owner exists.
- private.ts:129–133 and lifecycle.ts:152–175 independently capture actual native input owners. `captureNativeInput` retains unconfirmed owners; nativeProof carries them in input and owners. The original independent arm's contradiction pass is useful evidence that this fixture's native p is detected; it does not prove every owner transition in the dependent arm.
- private.ts:480–499 keeps those pending owners in the delivery gate even when early declared admission is unavailable. On confirmation the source allows ordinary surviving admission if its remaining conditions permit it. That is an inspected mechanism, not an executed outcome for this new dependent case.

## Contract and precedent

Approved CURRENT-SPEC.md:40–48 requires complete dependent contributors, forbids erasing native obligations, permits same-source surviving progress, and includes conservative/unknown in the receipt states. It does not promise held for every call listing every actual owner, nor declared basis for every later successful delivery.

The exact frozen `aggregate-installed-publication.spec.ts:126–136` preserves the analogous wider ancestor updater/descendant recipient boundary. Its comment identifies the explicit recipient-only exception in 75c645eb; its assertions require useful delivery with started/surviving, rather than declared basis. That fixture has a clean native ancestor input and an unrelated pending owner, so it is precedent for recipient uncertainty/basis only, NOT proof of progress for this case's actual consumed p. The archived recipient-failure-adjudication/REVIEW.md:27–45 likewise distinguishes recipient-domain mismatch from actual native input dependency; its interpretation is corroborated by the current source above, not substituted for it.

Accordingly neither replacing native p with unknown nor withholding forever after all actual obligations settle is authorized. Merely seeing conservative/unknown while p is pending demonstrates neither defect. The existing final started/declared assertion also requires adjudication against this surviving-route precedent, but should not be silently weakened to hide failed delivery.

## Preserved evidence and cheapest remaining falsifier

`timing-original.spec.ts`, `timing-first.log`, and IDENTITY.json preserve this counterpart and failure. Later p.confirm, exact payload, settled completion, and duplicate checks were unreached. No further execution or runtime/test edit in either candidate was performed.

Prepared a SEPARATE observation-only `ancestor-receipt-observation.spec.ts` for the same kernel lib location: dependent sequence only, status checks are logged after drain and after confirm, while all executed work, exact value/owner checks, no-send-before-confirm, pending settled waiter, p.confirm, exactly one {x:7,y:0} output, settlement and duplicate assertions remain. It is explicitly not a replacement qualification oracle and is unexecuted. It would determine whether the permitted conservative receipt proceeds usefully via surviving admission; preserve any new payload/settlement failure as a distinct result. Do not claim the diagnostic passes, or change the original held assertion again on the strength of this source review alone.
