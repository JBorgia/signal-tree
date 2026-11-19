# Independent model attack and narrow verdict

Node v24.15.0. Unchanged author model: 18/18 pass independently (`original-18.log`). Added reviewer probes: 0/3 pass (`adversarial.test.mjs`, `adversarial.log`); all failures preserved. Commands: `node --test /private/tmp/st-native-netzero-discriminators/model/model.test.mjs` and `node --test /private/tmp/st-native-netzero-discriminators/independent-review/adversarial.test.mjs`. No native runtime or author model edits; no native tests replayed in this review. Native twelve-case results are supplied evidence, not a reviewer execution. Later-confirmed refusal remains refusal, not selective-omission coverage.

Verdict: not yet sufficient for native implementation authorization. Transfer and staged recipient join are credible bounded algorithms, with the concrete omissions below. No persistent root/index or additional authority framework is requested.

## Executed representation failures

1. `model.mjs:75` concatenates occurrence and dimension. (`a/f:x`, `f:y`) and (`a`, `f:x/f:y`) collide; the first valid selection is rejected as stale after the second overwrites the address. `rebindFields:30` similarly joins slot/field. SOURCE-MAPPING calls these abbreviated identities: therefore this is not a demonstrated native algorithm failure, but the encoding cannot substantiate exact identity. Use nested Maps/issued slot identities or specify and enforce a lossless encoding/domain. Include ordinary/physical domain in the production identity.
2. `render:76` assigns `value['__proto__']`. A valid own data field becomes a prototype change rather than an emitted own property. This is output corruption, without requiring hostile proxies. Use own data-property definition, as the existing native field projection does. If model keys are restricted, explicitly reject unsupported ones; production still needs lossless own-property handling.
3. `rebindFields:29–30` emits `before: undefined` for an inserted field. Inversion then has no absent selection identity or requirement. The presence change is detected, but its proof is not transported. Distinguish a certified absent endpoint from a present field whose value is undefined. Bind absent endpoint evidence to the exact field/domain; never invent a clean absence certificate. This is an actual gap in the endpoint model, not merely string notation.

## Concrete existing normalization producer omitted

`plain-branch-membership.ts:483–551` settleTurnMemberEffects does more than no-op filtering: it rewrites a membership before-image with earlier descendant before-images and refreshes the after-image from final stored state. The new supplement cites only the filtering portion at :553–563. The model has no corresponding payload/support image transformation.

Existing source counterexample: x(5); omit g; re-add g; y(13). The membership captured before-image may contain x5, but native normalization substitutes x's pre-turn value. A capability merely carried from the membership's capture retains the wrong selection for that substituted slot. A later y write likewise changes the final after-image after the membership capture. This is the source's documented existing producer, not a new semantic obligation. Entity-subject effects are explicitly excluded from that descendant-image rewrite and must remain separate.

Required bounded algorithm: alongside each native placeInImage operation, compose the exact descendant before-selection at the same relative path/presence; select final after-support at the same validated drain frontier as its final after-image. Return normalized effect selections plus retained selections for disappearing effects before clearing capture/occupancy. Do not reconstruct them by equal numeric values or publication's already-incorrect current destination role.

The net-zero test currently supplies `{kind:'normalized-away', retained:q}` directly; installDisposition merely returns q. It proves the consumer rule, not production of q. Implement the normalization metadata result for the above existing image transformation and scalar/occupancy cancellation, then test it independently rather than supplying the expected retained selection as the answer.

## Accepted scope and next finite check

First-before/latest-after within a capture segment, separate segments, prefiltered compensation, ordinary evidence preserved during physical lowering, and one staged choice supplying payload plus support are coherent for the model's covered domains. History acquire-before-release is a useful lifecycle model, not proof that production clones/normalizers/eviction retain the right references. The source mapping correctly leaves permission/disposition and recursive effect emission with existing producers.

Next review need only cover lossless identity/property/absence handling and actual normalization image/retained-selection production. Keep no-observer, reentry frontier, retention and materialization visit gates already agreed; no new blanket review. Native rollback refusal must not be replaced by the model's conditional selective-omission branch.
