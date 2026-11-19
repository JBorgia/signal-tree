# Readiness fixture final source review

Bounded ACCEPT of `/private/tmp/st-c12-occupancy-review/READINESS-FIXTURE.patch`, SHA256 `762fc46f6904d8cd4b6da1d299d3155bbe8b96f4f4bf52a825bbad7c93cf7e93`. No blocker found. This is a two-hunk fixture correction containing two activation calls and one added assertion, not a runtime change.

`native-certificate-successor.spec.ts:17` completes the private lifecycle after installation/finalization with deliverNativeRequirementReady. This matches the earlier independent occurrence-successor finding (`full-run-classification/REVIEW.md:41–57`): explicit private fixtures must activate installed requirements; sealing alone is insufficient.

Current lifecycle source:

- `experimental-publication/lifecycle.ts:118–121,187`: preparation independently marks unfinished and unactivated; readiness requires both barriers removed and ready components.
- `:200–212`: finalization seals evidence; installed completion removes activation. With an open declaration horizon, activation does not itself make the requirement ready.
- `:340–363`: horizon close seals parent evidence/removes unfinished status before notifying readiness listeners. It does not invent absent activation.
- Actual scalar/membership/entity completion paths already call the same delivery function: `experimental-publication/private.ts:135,238`, `experimental-publication/entity.ts:234`.

First fixture still asserts composite unready within the open declaration, then throws its sentinel, and asserts ready afterward with exactly one callback observing invalid parent proof. Activation restores the prerequisite for that positive assertion; it does not change the expected invalidation or turn the test into silence.

Second fixture releases its listener before activation and adds an explicit assertion that the requirement is still unready within the declaration. It retains zero calls after close. The first fixture supplies the positive delivered-listener counterpart; this is useful cancellation coverage rather than non-delivery caused by never activating. No assertion is removed, no recipient operation is introduced, no public surface is changed.

Source/patch review only here; no readiness test was rerun for this request. C13 retention executions are separate composition evidence, not readiness-test execution. Original earlier failures remain archived. No statement here approves general private reentry, new activation policy or production exposure.
