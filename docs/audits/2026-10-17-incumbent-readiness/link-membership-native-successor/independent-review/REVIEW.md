# Independent scalar and ordinary-membership implementation review

Disposition: reject this checkpoint under the approved covered-recurrence stop. One concrete publication-safety failure is demonstrated. Do not repair it as another routine step in this bounded implementation attempt. This is not a finding against the unfinished entity lane.

## Identity and independence

Reviewed checkout `/private/tmp/link-membership-native-successor`, branch `codex/link-membership-native-successor`, HEAD `2d24966cc457529f876b06d950dd181acb5bfb69`, with the five-file scalar/ordinary-membership diff archived here as `LANE.patch`. `SOURCE.json` records SHA-256 identities and `source/` preserves the inspected files. The lifecycle, private publication, and root audit spec hashes exactly match `../010-source.sha256`. The unrelated concurrent entity changes are recorded in `STATUS.txt` but excluded from this verdict.

Governing contract: `392fcf46:docs/audits/2026-10-17-incumbent-readiness/link-membership-successor-contract/SPEC.md`, preserved here as `SPEC-392fcf46.md`. Also read repository AGENTS, contributor contracts, and `docs/review-contract.md`. This is bounded implementation review, not release verification.

I did not implement this lane or change any runtime/test assertion. I inspected source, frozen diffs, test source, and raw logs. Root supplied the additional discriminator and its result; I independently checked its contract premise and source cause. The implementer subsequently acknowledged the same predicate, which is not the basis of this finding. No other new review verdict was used.

## Blocking finding: known native owner suppresses the entire foreign-input window

Location: `packages/kernel/src/lib/experimental-publication/lifecycle.ts:58`, reached from `private.ts:103–119`.

`nativeAuthorship` supplies the authentic target transaction p as a known native lower bound. `prepareNativeRequirement` then sets `captureWindow` false whenever `known.length > 0`. Consequently `finalizeNativeRequirement` at line 73 captures none of the pending foreign owners. The 005→006 archived patch comparison shows this whole-window exemption was introduced to the new mechanism; it is not inherited baseline behavior being blamed on this change.

The existing prewritten witness is `native-window-preparation-audit.spec.ts:64–75`:

1. Source transaction q writes source.x = 7 and remains pending.
2. Target transaction p writes target.x(source.x()) with no declaration.
3. A later unrelated r opens after target authorship.
4. Before p confirms, no send occurs.
5. Confirming p must still hold because q was pending at target authorship.
6. Confirming q should allow fresh ordinary evaluation to send 7 while r remains pending.

Raw `../010-audit4.log` reports **3 passed, 1 failed**. The first divergence is line 72: after p.confirm(), actual sends are `[7]`, expected `[]`; q has not confirmed. Assertions at steps 6 and the final r check were not reached and are not claimed as passing evidence. The generating command is recorded in the log: Nx kernel test of `src/lib/native-window-preparation-audit.spec.ts`, cache skipped. Repository configuration pins Node 24.15.0 and pnpm 10.17.0. I did not rerun this already decisive witness.

The oracle follows the approved text, not a desire for additional safety: Admission 3 says “Unobserved undeclared authored facts capture currently pending instrumented owners”; the following classification explicitly includes raw cross-tree copies and undeclared hidden-input updaters. Authentic p identifies one settlement responsibility, not application-input completeness. No complete declaration exists here. The later r is deliberately outside the fixed window; this oracle does not restore a global delivery-time pending-owner gate.

Counterargument considered: known-p cases must retain their existing held/declared receipts rather than being made unknown merely by duplicating p as a possible owner. That constraint is real, but it only addresses duplicate representation of p. It cannot authorize erasing separate q. This report does not select a replacement deduplication or representation mechanism.

This is a recurrence in the claimed migrated scalar publication path and the newly implemented fixed-window responsibility. It is not an arbitrary-getter instrumentation requirement: the approved possible-owner mechanism exists precisely because this raw callback input is unobserved. Nor is it an unmigrated entity producer. The contract's final stop condition therefore applies.

## What the passing evidence and source do establish

`../006-focused-known-authorship.log` records 78/78 across possible-owner windows, membership input, original isolated omission, and ordinary-member publication facts. `../008-registration-reentry.log` records two passing selected cases, four skipped; it is not six passes. `../010-audit4.log` independently exercises preparation failure/retry, owner opening during preparation without replaying the updater, and owner settlement during preparation. Those three pass. None discriminates the newly demonstrated known-p plus foreign-q exemption.

The source has a concrete pre-install finalization seam: scalar composition prepares optional participants before `nativeUnit.finalize()` (`intrinsic-mutation.ts:306–320`); membership composition prepares every participant, then finalizes and composes installation (`:350–363`). Existing scalar slot code checks the committed revision after preparation before installing internal records (`tree-scalar-slot-runtime.ts:254–289`). Thus the successful reentry tests have a source explanation; the failure is not merely that all owner windows are sampled too early.

For absence, `private.ts:88–95` stops at an absent ancestor and includes the source-owned negative domain, instead of using only visible values. Membership installation updates its child/domain records independently of recipient enumeration (`:141–151`). These are meaningful mechanisms for the original missing-absence evidence; recipient enrollment is not the only source of a descriptor. Disposal still removes recipient operations/reverse links, while source maps use weak source keys. These observations are bounded source inspection, not a universal cleanup or retention proof.

`../007-composition-first.log` records 103/105. I inspected both failures, but do not count them as newly established regressions: one concerns the previously disputed wider-input fallback oracle, the other the previously adjudicated after-callback contradiction from actual native lower bounds. Their red records remain preserved. They do not explain away 010's distinct raw-copy failure.

## Remaining limits, not additional demonstrated runtime failures

The physical snapshot certificate mapping still needs a discriminating P/O correspondence check in any separately authorized successor. `private.ts:121–122` chooses a fresh versus mutable `NativeView` using `mutation.changed`. That flag denotes ordinary semantic change in an ordinary scalar write, whereas `tree-scalar-slot-runtime.ts:263–289` explicitly separates semantic and physical change after inspection. A physical restoration to the unchanged ordinary value can therefore take the mutable-cell branch; conversely adoption of an already displayed value can take the new-cell branch. The comment promising a new cell on every changed physical view is not established by this flag alone. The cheapest falsifier must expose an actual cached native updater argument across inspection/restoration/support replacement and assert its matching evidence, without substituting a fresh reader or treating a saved application object as an instrumented native input. I did not execute that falsifier and do not claim observed stale-payload leakage from this mapping.

No broad suite, framework composition, types, work/retention measurement, or release gate was executed by this review. Indexed wake/disposal source checks do not establish all churn, recovery, abandoned-source, cached-view, symbol-domain, or ABA obligations. Those remain qualification requirements; they are not extra reasons to continue this rejected checkpoint. Unfinished entity selection/publication work is explicitly outside the finding.
