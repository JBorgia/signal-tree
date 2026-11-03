# Structural fault-test premise review

Read-only source/history and supplied run-log review. No runtime/test edits or new executions.

The three failures in faults-first.log do **not establish three runtime atomicity regressions**. Each stops at an unsupported expectation about getter error propagation, before its state/recovery assertions execute. Preserve all three original red results and identify the unexecuted downstream assertions.

## Source evidence

`deep-clone.ts:13–22` deliberately tries structuredClone, catches any failure, then invokes the manual fallback. The fallback at105–119 reads property descriptors and copies accessors without evaluating their getters. Its bytes are identical in frozen slice1 successor and slice2 candidate (SHA2564d4052a19f5bc484792d3cfc2d821890ce255d69d0640565ccbeda18b81b2635). History identifies a5553796 as utility consolidation; no slice2 change to this behavior. shared-utils.spec.ts67–79 explicitly exercises fallback after structuredClone throws, though it does not itself prescribe every accessor behavior.

A new-row `get n(){throw error}` is therefore not a reliable escaping preparation-fault injection: structuredClone may evaluate and throw, deepClone catches it, and the fallback can produce a row preserving that accessor. With no structuredClone available the getter might not execute during this clone at all. Continued staging is consistent with this existing substrate. Later reads of the retained getter can still throw; this review does not declare such rows broadly safe or their behavior newly supported.

In the reentry case the getter mutates native state before throwing into the clone fallback. The existing enclosing revision validation then rejects the outer plan with `Entity frame responsibility preparation reentered installation`. Requiring the swallowed getter error to replace this guard invents error precedence. Existing setAll staging tests286–355 require preserving completed nested work and rejecting stale topology where necessary; they do not guarantee every reflection exception escapes a cloner. Their field-only interceptor case also shows that callback position matters: do not generalize all reentry into compulsory refusal.

## Classification

- upsert/setAll missing throw: **test fault-boundary mismatch**, supported by unchanged clone source, not a demonstrated candidate regression. Exact incumbent execution was not performed by this reviewer.
- reentry wrong error: **test error-precedence mismatch** at this clone boundary. The observed guard is not itself a failure. Nested state preservation/retry remain unverified by that test because assertion execution stops at the error mismatch.
- occupied rekey: reported ordinary pass remains valid separately.

Root's separate interceptor-controlled throw regressions are appropriate: they test a real supported escaping callback boundary and can assert state, retained baseline, usable rollback and exact original error where that callback contract requires it. Keep originals intact; do not count newly passing controls as making those unchanged tests green. No getter-policy redesign, catch narrowing or new error wrapper is justified by these three results alone.
