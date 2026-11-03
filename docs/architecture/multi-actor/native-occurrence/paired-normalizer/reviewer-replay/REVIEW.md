# Narrow successor review

Reviewed frozen model `1a86071996f7938b6909c90d31442c655e69b7d2b4833a741e5b5afe80b71e91`. All FREEZE artifact hashes and the frozen native normalizer source hash verified. Node v24.15.0.

Independent replay: original33 pass, including the unchanged reviewer killers and three-scenario frozen-source differential. Command: `node --test /private/tmp/st-native-paired-normalizer/model.test.mjs /private/tmp/st-native-paired-normalizer/normalizer.test.mjs /private/tmp/st-native-paired-normalizer/source-oracle.test.mjs /private/tmp/st-native-paired-normalizer/independent-review/adversarial.test.mjs`. Raw output: original-33.log. No author files or native runtime edited.

## Verdict: one concrete introduced composition regression blocks acceptance

The absent endpoint and paired member-image normalization now address the previously identified producer omissions at model level. The normalizer transforms earlier descendant selections with the before-image, selects the final paired after-image, and produces a normalized-away baseline instead of accepting retained:q as its answer. Recipient join acceptance remains unchanged. This is bounded model evidence, not native integration qualification.

However, `append` at model.mjs:7 spreads the later effect, restores the first raw before and beforeKey, but leaves the later beforeEndpoint. Newly added certified endpoints therefore disagree with the composed value baseline. `inverse` now consults that inconsistent endpoint.

Two reviewer failures, using only exported model operations and canonical fieldSlot tokens:

1. Same-segment {} -> {x:1} -> {x:2}: merged beforeEndpoint is present1 rather than the first certified absence. The absent-domain proof is lost.
2. Same-segment {x:7 with D=q} -> {} -> {x:11}: raw before remains q7, but beforeEndpoint is intermediate absence. Inverse returns that absence rather than q7.

Command: `node --test /private/tmp/st-native-paired-normalizer/reviewer-replay/composition.test.mjs`. Result: 0 pass, 2 fail; raw output composition.log. These are model algorithm failures, not asserted native runtime regressions.

Required bounded correction: compose each endpoint's value, presence and certificate as one unit. Preserve the earliest beforeEndpoint whenever preserving earliest before; keep the latest afterEndpoint with latest after. Apply the same paired-endpoint rule to any structural normalization that accepts certified endpoints (`compileSelected` has the analogous spread pattern). An endpoint-free input must not silently inherit an unrelated later endpoint. No new authority structure or semantics are requested.

Acceptance can be reconsidered on this exact composition correction and unchanged tests. Existing native reentry, no-observer work, lifecycle and materialization gates remain integration obligations; no new generic gate is added. No native runtime authorization granted by this review.
