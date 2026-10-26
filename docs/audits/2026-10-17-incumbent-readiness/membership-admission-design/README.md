# Membership handoff: native successor not yet admissible

October 26, 2026. **Read-only design disposition. No runtime implementation or new behavioral execution.**

The bounded investigation is complete: an event-identity-only handoff cannot cover the actual producers. The proposed enriched queue is plausible, but independent review identifies additional writer-preparation and publication-support mechanisms that are not specified or authorized by the original entity migration. This closes the handoff-only hypothesis; it does not disprove shared semantic facts or establish a working successor.

Production remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`. Rejected candidate `f01ed39a7df8a5de185ebec0773e09e36537dacb`, its [full qualification verdict and original reproductions](../slice5-integration-disposition/README.md), and the scoped [paired-order design evidence](../complete-operation-proof/README.md) remain unchanged. B is closed. Runtime recurrence stop and later integration gates remain active.

## Verified findings

| Finding | Evidence and practical consequence |
| --- | --- |
| Final membership event is not a complete installed-operation record | The producer emits only net presence differences and reads a late after-image. Nested removal can eliminate an outer event; nested field edits can enter its payload. Exact event identity alone cannot recover the absent unit or grant the nested payload the outer declaration. |
| Existing value preparation misses membership-only work | `commitRecorded` skips `prepare` for equal retained values, but scalar writers subsequently call re-add. The existing `absent-path-write.spec.ts` explicitly requires equal-value re-add. A new plan must cover membership independently without forcing every equal-present setter to become a value write. |
| One latest fact cannot represent all retained payload contributions | Current admission supersedes the previous fact, and declaration receipt bookkeeping moves to the last revision. A late aggregate payload can still contain an earlier dependent contribution. Retaining all blockers forever is also insufficient: a later complete independent overwrite must release obsolete support. |
| Existing eligibility wake is not a no-event completion path | `link.ts:991–1002` refreshes but returns when `held.size === 0`. A newly completed private projection therefore needs an actual pending-work registration and existing consequence-scheduling mapping, not a bare wake or synthetic public event. |

Root independently checked the cited runtime branches, `absent-path-write.spec.ts:260–267` (equal-value re-add), `464–481` (innermost-first membership then value), and the Link eligibility guard. The review's findings are accepted within their source-inspection limits. None is labeled a newly executed test failure.

## Precise expansion requiring adjudication before runtime

1. **Membership-aware preparation.** Add a private source plan that is triggered by value OR presence work, while preserving callback/equality timing. The additional footprint includes neutral scalar installation, native scalar replace/derive, the structural-write reactivation shortcut, whole branch path reactivation, entity path reactivation and prepared member restoration. The current plan's hidden-collection seam is not blanket permission to change all these writers. A plan allocated after the value was installed does not satisfy preparation-failure atomicity.
2. **Publication support and supersession.** Define which installed facts support a relationship's payload, when complete replacement removes support, when sibling edits retain it, and how presence differs from value support. This belongs to Link publication eligibility, never rollback ownership. Queue reuse, immutable IDs and a native delta do not by themselves answer those questions. The unchanged declaration surface cannot silently assign a new meaning to a declaration over a mixed payload.
3. **Completion delivery.** Map no-event finalization to registered pending Link work, current turn/consequence admission, serialized corrective sends and waiter retirement. Preserve public event counts/order, validation horizons, partial success and connection creation baselines. This is a bounded missing scheduling map, not evidence that a second event bus is required.

The first two change the mechanism/scope under review. The third is a concrete implementation obligation once that mechanism is settled. No runtime authorization is inferred from this report.

## Alternatives and recommendation

- **Event-only annotation:** ruled out by producer source. Do not implement it as the leaf timeout fix.
- **Source-unit admission with publication-support composition:** viable design direction, but materially larger than a private event association. The existing projection queue may carry immutable deltas; native membership must be prepared independently of value equality. Require explicit support replacement/retention rules before selecting the representation. Keep original order/leaf falsifiers and [prewritten discriminators](DISCRIMINATORS.md).
- **Conservative hold for unrepresented composition:** preserves a safety fallback but does not satisfy the approved useful conditional-progress requirement. Adopting it as product scope requires owner authority; it is not a successful implementation result.

Recommendation: retain production and the stop. Do not authorize a native successor from the handoff proposal. If the work continues, adjudicate the two additional internal contracts together, with the mixed-authorship/complete-overwrite pair and equal-value re-add as the discriminators. No further broad inventory, extra policy menu, full-suite run or cost campaign is needed to establish this boundary. There is no evidence yet that a new public API, second canonical state store or different rollback engine is necessary.

## Preserved packet

- [Exact reviewed draft](DESIGN.md), SHA-256 `ab44d268839310eabaca7dca0f0a80cc1424fb0412f7c4bf5fbf517ecc85edc4`; unresolved claims remain visible rather than rewritten as success.
- [Independent review](INDEPENDENT-REVIEW.md), performed without the other new review verdict or a requested conclusion.
- [Producer contract trace](PRODUCER-CONTRACTS.md).
- [Root writer-seam verification](WRITER-SEAM.md).
- [Prewritten sequences and alternatives](DISCRIMINATORS.md).
- [Source identities](IDENTITIES.json), [source hashes](SOURCE-SHA256.txt), and [packet hashes](MEMBERS.sha256).

Raw location: `/private/tmp/membership-admission-design`. The original source remains clean at `/private/tmp/v16-transition-qualification`. Source inspection and documentation verification are the only new evidence. No tests, executable model, runtime patch, build, demo, benchmark or fresh artifact measurement were performed. Prior `79/84` gates, `66` kernel failures and `4` failed budgets remain the rejected candidate's recorded verdict, not a result rerun here.

Source verification: from the frozen source directory, run `shasum -a 256 -c` with this packet's `SOURCE-SHA256.txt`. The original executable replay commands remain in the linked qualification record; their assertions and hashes were not modified. Archive validation and doc-link output are recorded in `ARCHIVE-VALIDATION.txt` and `DOC-LINKS.log` after archival.
