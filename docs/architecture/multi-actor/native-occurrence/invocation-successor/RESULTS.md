# Exact per-effect inverse invocation successor

Candidate: /private/tmp/st-native-invocation-successor/candidate
Predecessor preserved: /private/tmp/st-native-admission-successor/candidate
Scope: Main-authorized correction after independent-review/REVIEW.md. No public activation, alternative planner route, persistent root or global selection index.

## Implemented correction

- Existing applyEffect resolves its normal leaf/row target. For a paired single-field inverse it verifies the target's native publication source/subject/field and wraps only that setter invocation, including the absent-field adjacent row-replacement branch. It still calls the existing setter; no planner selection changes.
- Private write metadata carries a one-use invocation token keyed to source object, subject lifetime and field. updateOne/replaceOne claim it before collection onUpdate interceptors. updateOne also checks the input field domain. A nested write cannot reclaim it. The wrapper closes the token and releases its claim reference in finally on both return and throw; inherited closed metadata cannot revive it.
- The intended setter holds its claimed endpoint locally. After interceptors it validates the actual source/subject and field presence/value, then places only that field in restoredFields. Frame and direct source preparation transport that exact map. Absent-field row replacement does not certify siblings from its one-field endpoint.
- Native enqueue composition uses one helper for endpoint pairing. Earliest baseline follows the actual native baseline decision; latest after comes only from the incoming effect. Missing either side clears the complete pair. The native reactivation exception uses incoming baseline only when native composition selects it. No borrowing late baseline or retaining obsolete after.

This closes the reviewed ordinary per-effect transport omission within the tested scope. It does not complete other pending producer work: structural endpoint context normalization, paired plain-member image production, full native absence-domain/lifecycle qualification, demand capture and staged recipient rendering remain outside this bounded successor.

## Tests written before runtime correction

preregistered.spec.ts preserves the initial six-test fixture. native-admission-handoff.spec.ts is byte-identical to the predecessor (all three failed assertions plus foreign-pass control). The new fixture covers:

1. Missing earlier and missing later endpoint composition; actual special-baseline replacement.
2. Exact-source/lifetime claim, single use before callback, finally cleanup on throw (helper-level identity controls).
3. Actual native rollback to absent field and to own-present undefined; sibling support identity preserved.
4. Actual native same-field onUpdate reentry: nested99 does not borrow baseline0 certificate; outer inverse restores0 with its exact baseline.
5. Actual native throwing interceptor: rollback throws, later ordinary write13 does not inherit inverse baseline support.

No blanket call-scope claim: these tests exercise collection onUpdate callbacks and the ordinary kernel setters. They do not establish every custom location adapter/callback route or new-lifetime callback scenario. Lifetime matching is explicit in source and helper tests; broad lifecycle qualification is still separate.

## Results and commands

Node24.15.0/pnpm10.17.0. Nx commands use NX_DAEMON=false NX_ISOLATE_PLUGINS=false and --skip-nx-cache.

- First runtime: native-admission-handoff.spec.ts + native-invocation-handoff.spec.ts:10pass,0fail (first-runtime.log). The previously failing original four are all green.
- Focused: same two plus native-admission-segments.spec.ts, collection-contributor-core.spec.ts, native-authored-footprint.spec.ts:25pass,0fail (focused.log).
- `corepack pnpm exec tsc --noEmit -p tsconfig.typecheck-all.json`: pass (source-types-final.log).
- `node tools/check-spec-types.mjs`: initial one fixture lib-target error from Object.hasOwn; preserved spec-types-first.log. Replaced with Object.prototype.hasOwnProperty.call without changing the presence assertion. Final spec gate passes (spec-types-final.log); no baseline update or public type weakening. Replayed that six-test fixture:6pass (fixture-final.log).

Focused command from candidate:
PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm nx test kernel --skip-nx-cache native-admission-handoff.spec.ts native-invocation-handoff.spec.ts native-admission-segments.spec.ts collection-contributor-core.spec.ts native-authored-footprint.spec.ts

No diagnostic observation rows count as acceptance. No literal-zero projection counters or enumerating inspect calls were used as work/retention evidence. No broad benchmarks or broader qualification performed. Prior predecessor failures and source remain untouched.

## Independent review handoff

Review the exact per-effect resolved-target transport, claim-before-onUpdate boundary, closed-token cleanup, field-only restoredFields selection and missing-endpoint composition against these native tests. Source.patch is relative to the frozen admission successor. This freeze is review-ready, not a claim of independent review already completed or overall native mechanism acceptance. Main can commission the narrow review using this path/identity.
