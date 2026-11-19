# Independent focused implementation review request

Read-only. Main should assign a fresh reviewer. Budget: at most 30 tool calls / 15 minutes. Stop after a bounded source-grounded verdict; do not patch, broaden the project, or create a successor. On HTTP 403 use another source, never retry the same fetch or bypass access controls. No internet is needed.

Review the frozen implementation at `/private/tmp/st-projection-certificate-successor`, against baseline `87ddcfdedcb5d91e700d812bd6cbee2f77038510` in `/private/tmp/link-collection-proof-successor` (read-only). Verify IDENTITY.json, source.patch, runtime.patch and SOURCE-SHA256.json in this evidence directory before review.

Read the approved mechanism `/Users/jonathanborgia/code/signaltree/docs/architecture/multi-actor/native-certificate/DESIGN.md`. Source premise at baseline: entity-egress-projection.ts, “Authority is never shared.” Scope is private native lifecycle, projection selection and connection-local ingress; no public exports, activation or ceiling changes.

Question: Does this exact implementation realize the specified requirement-finalization, occurrence selection and ingress-isolation contracts? Give concrete boundary sequences and exact source hooks. Examine enrollment without a recipient operation under a parent horizon; composite readiness; summary replacement and disposal before close; completed ancestor membership and payload/support coherence across omission/restoration/lifetime replacement; equal/full ingress with peer order and nested acquisition. Separate source inspection from executed observations and distinguish an implementation gap from a contradiction in the recorded mechanism.

Raw evidence supplied without other reviewer verdicts: 002-original.log, 003-new-before.log, 004-after-first.log, 005-source-types.log, 006-focused-regression.log, 007-spec-types.log, 008-final-focused.log, 009-final-spec-types.log, original fixtures under unchanged-fixtures/, and exact changed source under source/. Source and tests in the scratch directory are the same frozen artifact. The initial unsupported flag is preserved in 001-original.log.

Do not use RESULTS.md or prior review prose as conclusions to adopt. Return a bounded recommendation, concrete counterexamples, remaining coverage limits, and whether more implementation can be treated as the same reviewed mechanism or requires renewed mechanism review under the recurrence rule. Passing test counts alone cannot establish acceptance.
