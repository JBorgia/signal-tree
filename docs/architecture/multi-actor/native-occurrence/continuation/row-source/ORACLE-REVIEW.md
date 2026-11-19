# Entity no-op oracle adjudication — read-only

## Verdict

Separate the operations. Existing recorded authority and later exact tests support **replacement adoption for `row(row())`**, even with referentially identical displayed input, and **no adoption for `row(current => current)` alone**. The combined original empty-send oracle conflicts with the approved replacement contract. It must remain preserved as an original failure, not drive a runtime policy reversal. A send of99 after both operations cannot establish that the identity updater alone is correct or incorrect.

No new policy is required for this distinction. No source/test edits or executions were performed; the supplied current send99 result is not an independently replayed result here.

All relative paths below refer to `/private/tmp/st-row-source-successor/candidate`.

## Authority and historical evidence

1. `docs/audits/2026-10-17-incumbent-readiness/link-equal-write-boundary/README.md:30-36` preserves the initial recommendation to retain equal-setter no-ops, followed by an explicit superseding owner-decision record: “authorize adoption; rollback restores both physical state and publication authority7.” The initial review recommendation is expressly historical advice, not current authority. This is a recorded owner decision, not a raw user-message transcript inspected in this review. The current user request independently confirms that approval.
2. `RELEASE-CURRENT.md:499-511` distinguishes ordinary7 / inspected99 / explicit ordinary99 adoption from genuine ordinary99-to99 no-op. Physical/display equality therefore does not by itself establish no-op authority. `link-equal-adoption/README.md:10-24` records the initial scalar implementation, ordinary-before capture and separate responsibility/physical change. It explicitly leaves entity qualification unestablished at that stage; scalar evidence alone cannot adjudicate every row updater.
3. The later entity-specific boundary audit resolves precisely this question, not merely an analogous scalar case: `docs/audits/2026-10-17-incumbent-readiness/ordinary-order-boundary-audit/README.md:17-22,40-49` says the combined assertion conflicts with approved replacement adoption, identifies `row(row())` as explicit replacement, and separately identifies identity-updater-alone adoption as a defect. It records raw five-case traces on exact slice1/current inputs, not new policy. `RELEASE-CURRENT.md:171-186` carries the same scoped adjudication.
4. Git history corroborates this record: commit `c0f55f0dbd5354b37f737a4562dfc4a52b8069cc` (October24, “docs: qualify slice-one scope and trace prepend traversal cost”) adds the audit and narrows the controller acceptance. Its evidence archive is retained in that directory; this review read the report, not executed its archive. `f01ed39a7` (“experiment: freeze shared transition qualification candidate”) contains the later separated test bodies quoted below; inspected with git show. This is stronger than interpreting the old test title in isolation.
5. The original fixture's tracked introduction is `d2218eb0d2f2cbd92dc50d897b6b8c4400864f6d` (September24 protective snapshot). Its commit message explicitly says it is not a reviewed change set or release candidate. That does not erase its assertions, but the older oracle cannot override a subsequent explicit compatibility decision.

## Operation-by-operation oracle

| Operation, starting ordinary x0 / inspected x99 | Existing required meaning | Supporting exact test |
|---|---|---|
| `row(row())` | Whole replacement authors/adopts displayed99 despite same reference. A transaction must capture the ordinary x baseline and rollback to0 here (7 in the user's canonical example). | `derive-footprint.spec.ts:60-67`: executes exactly `tree.transact(() => row(row()))`, requires an x change in inspect, then rollback x0. |
| `row(current => current)` alone | Derive with zero physical authored footprint: no adoption, empty transaction changes, no outbound send; displayed99 can remain while ordinary stays0. | `derive-footprint.spec.ts:36-45`: same-reference AND same-fields derive cases both require empty changes, no send, physical99. |
| Replacement followed by identity updater | First operation adopts99. The no-op updater cannot undo that adoption. Final no-send expectation is incompatible. | Original `entity-egress-footprint.spec.ts:198-220`; boundary audit table explicitly classifies this sequence. |
| Ordinary99 followed by equal ordinary99 replacement | Genuine equality of both ordinary and display truth remains no-op. | Owner decision plus entity semantic transition acceptance, below. |

`entity-semantic-transition.spec.ts:37-55` independently covers field, updateOne, replacement and setAll equal-display adoption, rollback to ordinary7, and genuine ordinary-equal no-op. Its replacement uses a fresh object, so it alone would not resolve reference identity; the exact `row(row())` test above does. The derive same-fields case also shows that reference equality is not the defining boundary: operation intent and authored footprint are.

## Current source consistency, not execution proof

`entity-signal.ts:3260-3278` evaluates updater against displayed current value, classifies function input as derive and non-function input as replace, and passes that intent to replaceOnePrivate. At `entity-signal.ts:2187`, preparation preserves derive versus full replacement (`authoredFields: mutationIntent === 'derive' ? 'derive' : null`). This supports the documented distinction. It is not sufficient to certify all subsequent preparation/publication paths.

The original fixture performs both operations before flushing/settled and asserts only one final empty output list. It does not isolate which operation authored the send, inspect transaction responsibility, or verify adoption rollback. Its title is not evidence of a special approved same-reference replacement exemption.

## Remaining limits / next adjudication boundary

- Current candidate identity-updater-alone behavior remains unverified by this read-only review. Preserve its separate empty-changes/no-send assertions; if it sends99 independently, that remains a runtime defect.
- Current same-reference replacement rollback to the ordinary baseline remains an execution obligation; outbound99 alone does not prove correct rollback or lifecycle.
- Preserve the original combined fixture and first raw red. Do not call it passing, delete it, or silently change assertions. It can be classified as a documented contract conflict alongside separate replacement-adoption and identity-derive controls.
- No claim that downstream lifecycle failures, all inherited failures, or this candidate's acceptance are resolved. No broad test run or runtime recommendation beyond applying the existing documented distinction.

## Inspection identities (SHA256)

- `packages/kernel/src/lib/entity-egress-footprint.spec.ts`: `19536a3160a4458b7b3cd85d97fb04c092c63bc64c22d675346788d5dbf84a2a`
- `packages/kernel/src/lib/derive-footprint.spec.ts`: `b0debc44848f8ba6b8d097fa8ff1eabc94f183cc7983c34be524c815cb5e167d`
- `packages/kernel/src/lib/entity-semantic-transition.spec.ts`: `24c0a85d87365a81ec181dd2e97aa0a2175141855b665c6817d8c520e2350837`
- `packages/kernel/src/lib/entity-signal.ts`: `a2319dec7f66aa7f33f8a89a27951946553f50771496a3ceaf77ad7590c15ef9`
- `RELEASE-CURRENT.md`: `22619dc9ef9f7b069579d493075f1cfee225a2025daf80e52c5d5d7350fd1e44`
- `docs/audits/2026-10-17-incumbent-readiness/ordinary-order-boundary-audit/README.md`: `1596bad8876ff75c168fb5f5ff057e12e22fb56e0a5b81ca32eb29fc0b49d615`
