# Exact C19: 25-control occurrence/recipient-window replay

**All 12 reproduced failures are at recipient-only pre-settlement hold assertions, with exactly one correct current payload already delivered. No native-support leak or lost useful value is demonstrated by these failures.** This supports narrowly adjudicating those assertions; it does not qualify terminal behavior that they prevented the tests from reaching, nor establish the recipient's admission basis. No semantic waiver or runtime correction proposed.

## Identity, command and preservation

Exact /private/tmp/st-native-combined-c19/SNAPSHOT-C19.json SHA-256 `b8eace4025ff735988dee88db512a2e9ceb5ac9e1302683d68d6900acea17576`; all 3065 manifest entries verified while copying to own candidate. Source/spec files unmodified before/after execution. No other worker scratch modified. Only authorized two files executed (16 + 9 tests).

`corepack pnpm nx test kernel --skip-nx-cache occurrence-successor.spec.ts recipient-window-review.spec.ts --maxWorkers=1`

Result: **13 pass / 12 fail**, exactly 25. Raw first log, command/env, result, source identity in runs/exact25; complete failure section also FIRST-FAILURE-STACKS.txt. Pinned Node 24.15.0/pnpm 10.17.0, own Nx/cache/temp, no ST_PREPARED_REVIEW_OUTPUT. A process preload redirects ONLY the legacy hardcoded recipient-traces.jsonl diagnostic append into this scratch; no test/runtime source or assertions changed. Preload source preserved. Diagnostic output is preserved as recipient-traces.jsonl. Existing unrelated audit-tsconfig warnings remain in raw log.

## Actual case mapping

| Original case family | Cases | Exact failure | What executed successfully before it |
| --- | --- | --- | --- |
| occurrence first omission scalar × confirm/rollback | 2 | occurrence-successor.spec.ts:24, expected [], received [undefined] | Initial root dependency held; independent root omission delivered exactly {other:1}. Child cumulative history contains only correct absence, no x7 leak. |
| occurrence first omission empty collection × confirm/rollback | 2 | same line, expected [], received [[]] | Root hold and later {other:1}; child contains only natural empty-array absence, no speculative inserted row. |
| occurrence first omission existing collection × confirm/rollback | 2 | same line, expected [], received [[]] | Root hold and later {other:1}; child contains only natural empty array, no old updated row. |
| occurrence first omission mixed branch × confirm/rollback | 2 | same line, expected [], received [undefined] | Root hold and later {other:1}; child contains only branch absence, no stale scalar/collection snapshot. |
| equal undeclared recipient proof × confirm/rollback | 2 | recipient-window-review.spec.ts:18:263, expected right=[], received [{x:1,y:0}] | Second equal declaration receipt is no-write; left has exactly one correct payload. Right history has exactly one current payload, no duplicate through equal repeat. |
| membership omission × confirm/rollback | 2 | recipient-window-review.spec.ts:38:116, expected right=[], received [{x:1}] | Left has exact {x:1}; right has same complete absence-correct payload, no retained y. |

The confirm/rollback labels do not mean those settlement paths ran: each failure occurs before p/q[outcome](). No final cleanup settles these owners; destruction is not evidence for the intended settlement assertion. These twelve original failures remain failures, unchanged.

## Contract classification

The omission fixtures first install explicitly q-dependent values, then make a separate independent literal omission. The old q-bearing subtree is not selected in the new output. Shared membership evidence certifies the absence; RecipientOccurrences.setPresence replaces its guard and prunes hidden descendant contribution, preserving stored support for reappearance. The child is allowed ordinary surviving delivery from complete selected evidence; it does not borrow the root declaration's permission. The original comment that root declaration does not grant child permission remains true, but does not imply the child must wait.

For pair replacement/equal repetition and y omission, the foreign pending transaction is neither an input nor destination of the supplied literal. Missing a declaration on recipient b is the only claimed additional hold. Current reviewed lifecycle.prepareRevision separates that mismatch from genuine origin/attribution/input incompleteness. Therefore the actual current payloads are consistent with approved recipient-independent surviving progress. No missing source support is evidenced by this run.

Do not generalize this to unscoped writes, metadata-classified compensation, unknown frames, captured possible-owner support, actual pending input, or a surviving field that consumed the omitted subtree. Those have different requirements. Source support is still distinct from declaration permission; endpoint values alone cannot prove admission basis.

## Live safety/progress coverage actually run

The other 13 original controls passed:

- Eight occurrence controls: q consumed into surviving y remains held until confirmation; independent replacement y avoids q; exact slot cancellation/disposal; finalization independent of unrelated sibling count; equal/full reverse-ingress peer isolation (two); hidden unresolved support selection/reappearance; new lifetime at reused key.
- Five recipient-window controls: explicit unknown equal proof preserves predecessor/no-write receipt for scalar and branch (two); actual native input vs recipient-domain uncertainty for known=false/true (two); finalizer throw installs neither authority nor writes.

The known=true case verifies pending native input and contradiction, rather than interpreting every missing recipient declaration as uncertainty. The consumed-y case is a direct counterweight to pruning old subtree support. Their passing status supports this bounded interpretation but does not certify every omitted-child path, structural inverse, or terminal outcome.

Additional live counterparts inspected in the earlier audit remain relevant but were NOT rerun: publication-enrollment-adjudicated (declared primary vs surviving secondary), recipient-source-permission (next unscoped write, actual destination owner, horizon invalidation), recipient-window-independent (genuine captured native windows, later-owner exclusion, disposal), and independent-dynamic-enrollment (consumed subtree moves to surviving member). See /private/tmp/st-c19-recipient-occurrence-audit/REVIEW.md for mappings. Do not report these as new C19 passing runs here.

## Positive counterpart needed before test maintenance

No new runtime mechanism is indicated. The retained original tests need a reviewed positive counterpart, not deletion of their remaining obligations:

1. Omission matrix: preserve initial root hold and root {other:1}; explicitly assert child [] immediately after the initial q-dependent write; then require exactly one natural absence output after independent omission. Record child admission as surviving (not declared), and retain foreign owner inspection/value. After confirm and rollback separately, require unchanged exact root/child output with no duplicate or stale reappearance. Existing cumulative histories already exclude an earlier value leak in this execution; the staged assertion makes that safety contract explicit.
2. Equal-repeat pair: retain second no-write receipt and one left payload; require exactly one right current payload and surviving basis before foreign settlement. Execute the previously unreachable confirm/rollback, final exact output and b.settled assertions. Do not conflate no-write receipt with a new grant.
3. Membership omission: require exact {x:1} on both recipients, secondary surviving basis, unchanged foreign ownership, and no duplicate or restored y after either terminal outcome; retain b.settled.
4. Keep all 13 passing counterweights and existing source-native window controls unchanged. They prevent a replacement from blessing owner loss or indiscriminate early delivery.

These are proposed assertions only. No counterpart was written or run under this 25-control authorization. Independent review before promotion remains appropriate; no test or semantic waiver has occurred.

## Scope limits

No full suite, additional tests, type/build gate, scaling experiment, source patch or original test edit. This replay resolves the earlier missing-stack ambiguity: correct absence/current payloads caused every reported failure. It does not supply the aborted terminal/no-duplicate evidence or per-recipient admission-basis trace. Those are bounded outstanding qualification work, not inferred passes.
