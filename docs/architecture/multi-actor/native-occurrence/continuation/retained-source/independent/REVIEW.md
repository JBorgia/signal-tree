# Independent exact retained-source successor review

Disposition: ACCEPT the bounded adapter delta. No blocker demonstrated in the reviewed wiring. The unchanged Vue hidden-row regression independently passes through Nx. This is not full integration acceptance, and does not certify all structural/member routes or new post-construction collection owners.

## Exact artifact

Input: /private/tmp/st-retained-source-successor/candidate. Copied the 2941 files identified by frozen d3b's manifest into independent/candidate, with a symlink to the existing qualification dependencies. Comparison with d3b found exactly one changed manifest-listed file: packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts. No runtime, test, or configuration source was edited.

Adapter SHA-256: 5bba3901a0cb5dc115a4acc87dfbe67ae579202af1af022c8f8f28be00ad8272.
Independent snapshot manifest SHA-256: 87faced095f784b3925518ac5a592a17c8b6b0f391a4dc09472802977f75ea91.
Predecessor manifest: d3b6da2906ae9cef72e5623b35eb6de3dee73d64b12f5c9bd408352aa627e73b.
All copied and input manifest-listed files were rehashed after execution: no changes. This identity check covers the manifest-listed files, not arbitrary extra unlisted files. Root HEAD remains 628d302dadb082a48c58528651c9088234d0a777. Review contract and previously read relevant lifecycle/source contracts applied; no release verification claimed.

## Source findings

1. Exact proposed seam implemented. TreeRealizationPort:340–347 adds optional internal prepareSelectedUnit. createTreeRealizationAdapter:480–485 implements it with the adapter's captured options.tree and structuralOwnerPaths. admitSelectedOperation:710–725 keeps whole-operation shape admission and obtains the port attached to the supplied tree's state root, falling back to its tree attachment. It invokes the method with the correct receiver. prepareSelectedOperation now receives the retained owner index rather than rebuilding the visible facade index. No new global source map, public payload, or barrel export is introduced.

2. Missing port is inapplicability, not success. At :723 a missing preparer returns undefined before any selected preparation or mutation. transactions.ts:3793 onward then follows the incumbent complete route, including normalization/validation/application; it does not mark selected completion or claim settlement merely because the method is absent. This is source evidence, not an executed synthetic missing-port test. The normal transactions attachment obtains/creates one adapter and installs it on tree and root (:1658–1666). Restoration likewise shares the port (:2687–2702 and :5315 onward). No production constructor found here supplies a stripped replacement port. Deliberately forging an internal attachment from another tree is not a public supported path; there is no new runtime namespace assertion against such private tampering.

3. Retained discovery does not replace active-subject validation. resolveCurrentSubjectTarget still asks the indexed collection's __findKeyBySubjectId before accessing the row. entity-signal.ts:2384 resolves only an active subject. Same-key removal/re-add must therefore not select the new row for an old subject. Selected binding source/subject/field checks, endpoint validation and active-key revalidation after equality remain unchanged (entity-signal.ts:2228–2239); preparePointValues checks active subject/key (:545 onward). No hiding bypass or lifetime check was removed. Direct collection initialization occurs before enhancers; later rows do not require a new collection index entry. The design review's qualification on genuinely new late collection owners remains.

4. Whole-unit/reentry and terminality unchanged. The preparer still stages all effects, groups row plans, prepares scalar installation, verifies the physical revision, and verifies it again before install. All installation precedes publication. Getter/interceptor-driven revision changes still refuse the stale unit; the source delta does not touch those conditions. Exceptions from the selected preparer propagate through the existing caller rather than triggering a second realization attempt. Existing physical-row/exposed-publication scopes and destroyed-tree settlement guards remain in force. No claim is made that the private preparer independently enforces every public lifecycle precondition when invoked outside its caller.

5. Cleanup representation unchanged. This method shares the adapter's already retained collection index; it adds no per-row cache. d3b forwarding edge clearing remains byte-identical. An active prepared unit retains its installation obligations; an explicitly held adapter/tree can retain its collections transitively. No new GC result or universal leak-free guarantee follows from this source review.

## Independent execution

COMMAND.json and replay.py record the complete reproducible command/environment. Node 24.15.0; dependencies resolved from /private/tmp/v16-transition-qualification/node_modules. Executed in the isolated copy:

    corepack pnpm nx test vue --skip-nx-cache '--testNamePattern=a rollback writing hidden rows runs no effect that could see them' --reporter=json --outputFile=/private/tmp/st-retained-source-successor/independent/vitest.json --maxWorkers=2

Nx exit 0. The Vue target includes its ordinary spec TypeScript check before Vitest; that command chain completed successfully. Vitest: 1 passed, 0 failed, 182 skipped/pending. Exact passing case: “absent collection — Vue sync effects (v16 8e) a rollback writing hidden rows runs no effect that could see them”. Its source is unchanged from d3b and the previously preserved 057c/c47b fixture. The test asserts successful rollback and absence-safe synchronous reads; it does not independently inspect the hidden physical baseline after rollback.

Preserved raw first.log includes tsconfig-paths warnings about an archived docs fixture referring to missing /private/tmp/st-unknown-access-candidate/tsconfig.typecheck-all.json. These did not fail the target. No warnings were hidden or configuration changed. Raw Vitest result, extracted CASE.json, exit/identity RESULT.json, DELTA.json, and source.patch are adjacent.

## Run / not-run falsifiers and limits

RUN: the exact previously failing unchanged public Vue fixture, through Nx with cache skipped, on an independently copied exact source; pre/post source identity checks.

SOURCE-REVIEWED ONLY: missing-port branch, adapter attachment sharing, subject lookup, selected endpoint validation, revision refusal, destroy guards and forwarding cleanup.

NOT RUN here: synthetic missing-port attachment; hidden direct-collection omission variant; ABA/removal/reentry controls; late collection-owner acquisition; GC probes; full kernel or framework suites; root typecheck. Main's parallel checks are separate evidence and are not counted as this review's passes. Existing same-key/reentry/cleanup controls remain appropriate finite gates; no new guard list or repair is proposed.

The independent replay resolves the narrow observed c47b hidden-collection refusal for this exact successor. It does not retroactively qualify c47b, frozen 87f, or the remaining broad differential.
