# Certified endpoint composition correction

Separate successor of /private/tmp/st-native-paired-normalizer. Frozen predecessor and reviewer-replay failures remain untouched. No native runtime changes or new policies.

## Correction

append and continuous structural compileSelected now share composeEndpoints(first,last). It takes raw before, beforeKey, beforeEndpoint and fieldBefore together from the first effect; raw after, afterKey, afterEndpoint and fieldAfter remain together from the last effect. Explicit undefined clears a later certificate when the first input is endpoint-free. It never guesses a clean certificate.

rebindFields now records explicit fieldBefore/fieldAfter from own-field presence alongside its certified endpoints. inverse swaps those flags together with raw/certified endpoints. The prior certified-absence handling remains unchanged. No role rewriting, disposition or selection-domain changes.

## Validation

Unchanged original33 plus two unchanged reviewer composition killers: 35 pass, zero fail (unchanged-35.log). All five original test files are byte-identical to predecessor/reviewer inputs.

Four additional controls exercise structural earliest absent baseline, structural present->absent->present baseline, endpoint-free earliest input, and endpoint-free latest input with inverse presence swapping. Full run: 39 pass, zero fail (all-39.log).

Command: node --test model.test.mjs normalizer.test.mjs source-oracle.test.mjs independent-review/adversarial.test.mjs reviewer-replay/composition.test.mjs composition-controls.test.mjs

## Composition-site audit

Model:
- append / compileSelected: both now use the paired helper; structural continuity/cancellation and field-segment selection remain unchanged.
- rebindFields: native own-field presence accompanies source-domain and selected-field certificates; synthetic field identity remains lossless.
- inverse: reverses raw endpoints, certificates, keys and explicit field-presence flags together.
- normalizePaired/placePaired: already replace an entire paired image endpoint. No later object spread reintroduces an earlier certificate.
- lower: changing physical beforeKey is intentionally placement-only; ordinary authority remains in the paired ordinary record and placement association. Do not copy physical display identity into ordinary certificates.
- installDisposition: continues to consume actual normalized disposition, not ambient ownership.

Frozen source mapping:
- transactions.ts:1934 enqueueEffect and :1990–2007 scalar composition: earliest before/presence with latest after/presence; future metadata must take the identical branch and endpoints, including cloned priorEffects.
- plain-branch-membership.ts:411–437 composePlainBranchMemberEffect has a deliberate exception: initial whole-value reactivation replaces a preliminary scalar before with incoming absent-member before. Transfer its certificate and presence with that replacement. The generic model helper is for already-selected endpoint composition, NOT a proposed replacement of this native rule. This exception is source audit, not newly covered runtime behavior.
- occupancy-composition.ts:26–55 retains first/beforeKey, latest afterKey, first removal and latestRemoval/addition separately. Certificates must follow the corresponding existing image, not whichever input spread last. occupancyEffect:58–85 may choose addition/removal context or synthesize rekey; metadata must remain paired with the selected endpoint context. Model structural controls validate the endpoint transfer law, not production context wiring.
- transactions.ts:3208 compileSelectedCompensation composes only selected continuous structural runs; corrected compileSelected covers its analogous spread regression. Omitted effects still never supply inverse support.
- transactions.ts:3178 toRollbackEffect flips membership and fieldPresence; model inverse now explicitly mirrors the field-presence swap with certificates.
- plain-branch-membership.ts:483–578 normalization rewrites complete before/after images and filters net no-ops. Existing paired normalizer and frozen-source differential tests remain byte-identical.
- ordinary-realization.ts:19 lowering changes physical placement without rewriting ordinary evidence. No model change required.

Integration obligations and runtime authorization remain as before. This is an exact review-ready model correction, not a claim that Faraday reviewed this successor or authorized production work.
