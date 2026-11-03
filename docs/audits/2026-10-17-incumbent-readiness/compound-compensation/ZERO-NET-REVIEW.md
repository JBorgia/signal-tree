# Zero-net compensation independent interpretation — 2026-10-18

Inspected zero-net-probe.mjs and zero-net-first.log; no independent rerun. Both reported arms reproduce earlier undo failing ST1034 after transaction-owned add/remove temp has successfully rolled back. No-blocker undo succeeds; ordinary independent ABA refuses. Same visible keys are not the evidence for repair: exclusive rejected-transaction ownership and exact interval continuity are.

This is an uncovered instance of the accepted complete-compensation invariant. LAWS.md L3 removes the rejected contribution, L9 requires complete disposition, and L14 requires honest terminality. These laws do not literally guarantee arbitrary historical undo after every rollback. The conclusion is bounded to a journal-proven, exact contiguous same-owner interval with no surviving independent topology. Retaining that rejected interval as the sole reason for refusal leaves an unresolved structural influence after successful terminal rollback. Ordinary ABA has independent authorship and remains intentionally guarded.

Current source returns early in applyRollbackCompensation at transactions.ts:2874, before interval analysis. Current eligibility also requires nonempty expected dispositions. Successful rollback later deletes the operation journal and expected disposition map. Thus physical final equality and empty public inspection do not discharge the structural interval. descriptor-retention.spec.ts:237 explicitly permits pruning net-zero structural capture; public history/effects need not retain temporary subject contributions to fix this.

Requirements, without selecting an implementation:
1. Prove a real journal-backed structural interval; empty effects alone are insufficient. Distinguish missing expected record from known empty net disposition.
2. Keep contiguous same-owner ownership, exact current endpoint, and exclusion of unrepresented frames and explicit order changes. Account for entire net disposition, including empty disposition.
3. Include the certified owner in a complete prepared compensation unit even when its visible target is unchanged. Any other owners/fields remain in the same completion boundary.
4. Revalidate after preparation; install recovered token with that prepared target before completion/public delivery. Failure before install retains authority/evidence; terminal journal cleanup follows successful completion.
5. Do not revive temp handles or synthesize row changes for unchanged visible state. Do not weaken ST1034 or infer safe rewind from key equality.
6. Preserve confirm versus rollback distinction, repeated/opposite settlement behavior, later independent fields/topology, and ordinary ABA refusal.

Discriminating controls: no-write empty transaction; rejected versus confirmed add/remove cancellation; zero-net owner plus nonempty second owner; independent and interleaved topology; preparation reentry/failure then useful retry; held temp detached; full earlier undo+redo, not only no throw.

This finding supersedes any broad reading of the prior no-blocker verdict: prior verdict covered inspected nonempty prepared compensation cases, not universal completeness. No production edits made.

## Final extension review

Inspected actual transactions.ts extension and seven zero-net tests. No concrete correctness blocker found in this bounded mechanism. Current inspected transactions.ts SHA256 c8eafde4b0b43ff19cffdc9d128dc62e48e5aa3ed17e4b988d01214de281640b; zero-net-compensation.spec.ts SHA256 f4cf4383474d34c85c5b371d9cfba9aa975706e2cb2fdb7ada3d727c2122f2bf. Final receipt refresh is author-owned; prior final-source.sha256 still described the previous candidate when inspected.

Known-empty is distinguished from missing journal disposition. Exact contiguous interval/current-frontier checks remain. Shared point/token-only completion installs certified tokens before completion/publication, advances revision when no value frame exists, and preserves existing compensation context. Declarative completion includes canceled owners lacking row targets after all actual targets install and before their publication. This adds no public effects or synthetic entity/order captures; the pre-existing owner invalidation wrapper remains.

Inspected author zero-net-nx-first.log reports7/7. Parent reports prior9/9 retained. Tests assert full undo/redo state, held temporary handle remains detached, zero row/order captures, confirm/rollback distinction, independent ABA refusal, preinstall failure/retry, mixed-owner restoration and scalar compensation. Tests are meaningful rather than merely no-throw. No reviewer suite rerun. Optional capture subscription in the first test relies on installed runtime presence; source inspection independently confirms no synthetic capture call in extension.

Keep original index regression unchanged/red pending owner approval; automatic approval rejection is not a runtime verdict. R1/R2 explicit-order composition limitations remain. This is bounded source-and-carrier acceptance, not full qualification, universal rollback atomicity, or a new public semantic contract.

## Frozen final receipt verification

Verified final-zero-net-source.sha256 with shasum -a 256 -c against the actual readiness checkout: all nine entries OK (six runtime files, three specs). Inspected the final checked-local lookup replacing the non-null assertion and the updated RESULT.md; no new runtime semantic change identified. Prior reports are superseded only where final zero-net support removes their stated zero-net/fallback limitation.

Final bounded verdict: no concrete correctness blocker found in this complete-compensation mechanism under its explicit eligibility restrictions. Final author receipts report16 ordinary focused passes, strict three-spec compilation and clean changed-file lint; parent broader checks remain separate. Original index assertion remains red after automatic approval rejection and pending owner disposition. R1/R2 explicit-order/structural endpoint composition remains open. This is not release or full readiness sign-off.
