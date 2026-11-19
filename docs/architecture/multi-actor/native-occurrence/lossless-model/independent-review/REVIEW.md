# Final-snapshot narrow algorithm review

Reviewed model SHA-256 `5155f85a1de1d7d60e1d329423682672873733caca2b3d1a659f693807fe6126`; all seven FREEZE.json artifact hashes match. Node v24.15.0. Independently ran `node --test /private/tmp/st-native-lossless-model/model.test.mjs`: 23/23 pass (`replay-23.log`). Reviewer `adversarial.test.mjs`: one pass, one failure (`adversarial.log`). No author source or native runtime edits. Prior findings/raw failures remain at `/private/tmp/st-native-netzero-discriminators/independent-review/`.

## Verdict

Recipient eligible join accepted within its stated staged-choice contract; full native transfer mechanism not yet accepted. Two bounded gaps remain: certified absent endpoints in rebind transfer, and selection transformation through the existing member-image normalizer. No persistent root, global index or new policy required.

## Closed on this snapshot

Nested Maps preserve occurrence/dimension boundaries and opaque identities; request-local field tokens preserve slot/field boundaries. Own data-property definition fixes __proto__ output. These close the prior executed representation defects; they are not current failures.

The join iterates staged eligible order/slots rather than source membership. Each selected identity supplies both value/presence and support. Retained peer slots remain retained; extra source rows are not admitted. Reviewer control confirms certified absent x retains support without emitting x, while present y=undefined is emitted as an own property. This validates the join for correctly produced choices, not production permission classification or actual eliminated materialization passes. Existing no-observer, revision/reentry, retained-unit and visit-count gates remain unchanged.

## Remaining executed defect: rebind absent endpoint

`rebindFields` reads absent own fields as undefined and places that directly in effect.before/effect.after. Removing and readding a row from {} to {x: undefined} produces a real presence effect, but its inverse target is bare undefined with no selection identity/support. The renderer can handle a certified absent selection; the transfer producer cannot currently supply one. Add an exact per-field absent endpoint capability from native row/domain evidence, distinct from present undefined. Do not substitute a clean default or confuse missing proof with absence. Failure is preserved in adversarial.log.

## Remaining existing producer: member-image normalization

The actual `settleTurnMemberEffects` in `/private/tmp/st-occurrence-successor/packages/kernel/src/lib/internals/plain-branch-membership.ts:483–551` rewrites membership before-images using earlier descendant before-images and refreshes after-images from final stored state before filtering no-ops. The supplement identifies its filtering but the model does not transform the corresponding selections.

Existing documented sequence x(5); omit g; re-add g; y(13) demonstrates why a carried first membership selection is insufficient: native normalization replaces captured x5 with x's pre-turn value and incorporates later y into the final image. The selection must undergo those same path/presence edits. Entity-subject effects are explicitly excluded by that normalizer; do not fold them into the plain-member image.

Specify/model paired selection composition at the actual placeInImage transformations and a validated final selection at the native after-image frontier. Produce retained selections for normalized-away effects before capture state is cleared. The current `installDisposition(..., {kind:'normalized-away', retained:q})` test verifies the consumer returns supplied q, not how normalization determines q. This is the concrete missing producer algorithm, not a request for additional abstract laws.

First-before/latest-after scalar segment transport, prefiltered compensation, ordinary evidence retained through physical lowering, and acquire-before-release remain sound within the covered model. Preserve later-confirmed native refusal; conditional model omission is not evidence that native rollback allows it. Next review can be limited to the absent endpoint and paired normalization producer; no blanket re-review needed.
