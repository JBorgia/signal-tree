# Independent frozen collection-egress review

Disposition: ACCEPT the bounded natural-array selection correction. No blocker demonstrated in the exact runtime delta. Independently replayed all 63 scoped controls successfully and three additional contract-correct pending/terminal controls successfully. No full integration, broader oracle adjudication, release or universal staleness claim.

## Identity and scope

Reviewed /private/tmp/st-collection-egress-successor/candidate; source manifest SHA-256 010d069cabb8c020758fdc50f7b477655504bd9961ff99bf79becc2e1cfe18ca. Compared manifest entries against predecessor a801391e26f62d725a99bda9deb1267020482604d67202e810687811fb017b38: exactly one existing source changed, packages/kernel/src/lib/experimental-publication/private.ts, and two specs added. Reviewed source.patch and the actual source/test assertions. Root task HEAD 628d302dadb082a48c58528651c9088234d0a777. Read review contract; relevant ownership/lifecycle constraints retained.

Isolated replica created from all 2945 manifest entries. Pre/post hash verification confirms frozen and copied manifest-listed files unchanged (FINAL-IDENTITY.json). Added only independent probe specs in the replica; no runtime, Main, frozen configuration or original tests modified. A second verified predecessor copy was used only for differential diagnosis.

## Mechanism

private.ts:211–227 prevents generic membership payload adoption when b.source itself has a registered CollectionSupport. That is the correct representation discriminator: a direct collection recipient publishes its selected natural array; a containing branch's membership image may instead contain {all: ...}. The previous relative-[] adoption overwrote the correctly selected array with that wrapper.

The existing source-owned ownCollection.payload remains selected only when collectionSelected reports the occurrence exposed. For own collection omission or an omitted ancestor, occurrence presence is still updated first, proof support is still recomposed, and ready's final projection still chooses [] for an unexposed direct collection. Skipping generic adoption while unexposed does not grant visibility or discard the hidden collection's retained ordinary payload.

A branch/root recipient has no ownCollection for its source, so generic membership image adoption and explicit nested composition remain active. Nested collections still enter their relative address as {all: collection.payload}. Row/field recipients also do not become direct collections through this predicate. This is identity-based source selection, not an Array.isArray payload heuristic or a mutable public-key lookup.

No new physical read occurs. Collection payloads originate in the existing prepared projection units and reduce in their existing pending order. The patch adds no callback, changes no unit readiness/order, and leaves current-revision/noop handling intact. The endpoint-new-write controls directly cover a newer publication during endpoint delivery, both with normal return and a thrown error. These controls constrain one concrete staleness risk; they do not prove every possible reentry schedule.

## Permission and negative-proof interpretation

The patch does not change occurrence enrollment, exclusions, setPresence requirements, projectionSupport, proof composition, lifecycle.projectRevision, decision, admit, allowed, or started. Payload shape selection is therefore still subordinate to native proof and the existing consequence scheduler. Source review alone is not treated as a complete permission proof; the dynamic controls below test actual sends.

The existing 63 controls include dependent hold until confirmation and independent publication despite an unrelated pending owner, for both ancestor and own-collection omission. They also retain membership provenance across recipient disposal/re-enrollment and inspection non-hitchhiking controls for nested collections.

Additional probes established pending suppression for re-exposure and for a useful independent edit after a foreign negative removal. My initial post-rollback expectation was too strong: I expected permanent suppression/conservative receipt. That is NOT the current contract. private.ts:399–409 preserves the existing scheduler's surviving grant once captured blockers no longer remain pending; allowed and started distinguish that grant from declared early permission. Existing publication-terminal-horizon-independent.spec.ts and entity-negative-publication-retirement.spec.ts explicitly assert this terminal surviving behavior.

The initial three probes failed only at their post-rollback no-send expectations; all three also fail on the verified predecessor. They are preserved as invalid-oracle diagnostic runs, not hidden, not counted as passing, and not reported as new permission regressions. Separate contract-correct successor probes require no pending send, then exactly the expected array with receipt basis 'surviving' after rejection. All three pass. Unknown/rejected proof is not asserted to become clean or declared; the scheduler's separate grant is what permits the terminal send.

## Assertion review

The 12 new source controls assert useful nonempty results: same-turn omit/re-add final arrays; exact root/branch versus direct representation; exact dependent/independent delivery counts; started receipt at endpoint entry; newer callback write and the subsequent corrective payload. Assertions are outside callbacks, so swallowed callback assertions cannot produce a false green. Teardown is in finally.

The two root/branch aggregate probes deliberately use @ts-expect-error for marker-bearing source types. They are runtime representation tests, not evidence of newly admitted public aggregate types. Their passing runtime results do not relax TruthfulLinkSource.

One reporting precision: the callback-error assertion uses toEqual([failure]), not a strict toBe identity assertion. It verifies the recorded expected error shape/count and successful newer delivery; it alone does not prove reference identity. The patch changes no error propagation code, so this is a limit on the evidence description, not a demonstrated regression or a reason to modify the frozen tests.

## Independent execution and raw artifacts

Node24.15.0 and existing /private/tmp/v16-transition-qualification/node_modules. All package tests run through Nx, cache skipped, daemon/plugins disabled. Exact argv/cwd/environment are in replay.py and command records.

- COMMAND.json / first.log / vitest.json / RESULT.json: collection-natural-egress, link-absent-locations, row-source-independent, link-nested-collection, link-native-address, publication-membership-provenance. 63 passed, 0 failed, exit 0.
- NEGATIVE-COMMAND.json / negative-first.log / negative-vitest.json: three initial overly strict terminal expectations, 0 passed/3 failed, exit 1. Original probe saved as independent-egress-negative.spec.ts.
- PREDECESSOR-NEGATIVE-COMMAND.json / predecessor-negative-first.log / predecessor-negative-vitest.json: exact same probe against verified predecessor, 0 passed/3 failed, exit 1. replay-negative-predecessor.py preserves copying and command procedure.
- TERMINAL-COMMAND.json / terminal-first.log / terminal-vitest.json: separate corrected contract controls, 3 passed/0 failed, exit 0. Source preserved as independent-egress-terminal-contract.spec.ts. Checks pending hold/unknown suppression and terminal surviving receipt/payload; no runtime edits used to obtain green.

Existing archived-doc tsconfig warnings remain in raw logs. No source/spec typecheck rerun independently. No inherited foreign commit-boundary or branch oracle repair was attempted. Their dispositions remain separate and the broader author runs are not counted as this review's green suite.

The exact delta is acceptable as a representation correction with the tested permission/freshness boundaries. It does not fix the separately traced later fallback-project overwrite or qualify unrelated structural/retirement successors.
