# Independent finally successor review

Bounded accept: no blocker demonstrated for the frozen, one-function control-flow correction. This resolves the inherited no-unsafe-finally error without changing exception policy. Not acceptance of C15 enrollment, sibling equal-progress, or any combined candidate. No runtime, author fixture, frozen input, or root edits performed.

## Identity and contract

Frozen packet /private/tmp/st-c14-finally-successor, confirmed via FREEZE.json and REVIEW-REQUEST.md after they appeared; no verdict used provisional source. Manifest `76dc7e600928ee36331a15674baa9a25960a78b2f97bee637dd693cac28fcb28`; predecessor `4b48ad0640fa4b480c072f0f8c05a72898422a5c3067d90e7a9bc40ccb701e30`. Runtime patch `acf6f4b98434f743721fe1311b3aaeb1af9d3d27b315cecbced62c539daeaf92`; complete patch `617a4cf605d9473c211139c9bd038a2fc1e9c8096c16a51acb92630ec17e20ba`.

Verified every predecessor entry (3059) and successor entry (3060) before copying and after tests. Only lifecycle.ts changes and declaration-finally-precedence.spec.ts is added. Lifecycle hashes: predecessor `7c024f1fc84721e5d42d0f20ac4860fd8426b5d5cab6bd831abc33ef7d591114`; successor `2c4a98173d299a30087678d31ba4aa547712cb235e3a5144361d7e2a54fb5b79`. Prewritten fixture hash `0f1f563cdf04df7d6f92af7a83474835e7deb503ee017852332f35be3fe2e3ca` matches PREWRITE-IDENTITIES and both author/own copies. Matrix hash likewise verified. The recorded prewrite sequence is author provenance, not an independently witnessed timestamp guarantee.

Read docs/review-contract.md and previously reviewed contributor ownership contract. Root HEAD remains 628d302dadb082a48c58528651c9088234d0a777 with unrelated dirty files preserved. Public exports, lint configuration, ordinary tests and discovery are unchanged by the manifest comparison. The C15 decision(channel)/hasDeclaration warning remains applicable: do not transfer the older unused-parameter rename mechanically.

## Control-flow adjudication

References below are in candidate/packages/kernel/src/lib/experimental-publication/lifecycle.ts.

- Lines 394–402 retain every catch throw. Setting exitingError before error reporting means callback object, primitive, or undefined remains the exact primary; validation-generated errors retain their previous identity/wrapping. Reporter exceptions remain swallowed and reporting reset in its own finally. The post-finally statements cannot run after those catch throws.
- Lines 404–408 still pop the stack and decrement the horizon before completion. The same finish call and secondary-reporting branch execute in the same order. A completion error with an exiting primary is still reported only when not already reporting; it never replaces that primary. No new catch surrounds the final completion throw.
- Lines 376, 406 and 410 use a boolean separate from the unknown error value. An unopposed finish throw, including undefined, is recorded and rethrown after cleanup. A truthiness or undefined-sentinel implementation would be wrong; this patch uses neither.
- A synchronous wake throw at :408 still overrides a pending receipt, primary throw, or completion error. Queued callback failures occur later and cannot rewrite the synchronous return/throw. Standard queueMicrotask schedules work rather than throwing it synchronously; the test stub's capture-then-throw is explicitly host fault injection, not public product behavior.
- Successful return moves from inside try to :411. Receipt is an immutable local reference; no getter/evaluation was relocated. No user code runs between completion of finally and the final branch/return. The only newly executed statements before wake are local assignments without getters or callbacks. Nested declarations during finish receive their own completion flags; stack and horizon behavior is unchanged. Unchanged cleanup throws would retain their original overriding behavior as well.

The equivalence argument covers arbitrary values thrown from the unchanged paths; tests sample representative values rather than claim exhaustive execution of all JavaScript values. Catch-level contradiction reporting, nested reporting suppression, then-getter errors, and pre-try disposed/unsupported errors remain source-unchanged and were not each newly replayed. This is no license to redesign their policy.

## Tests and useful assertions

Own isolated copies use the already isolated copied dependency tree, Node 24.15.0 and corepack pnpm 10.17.0. Nx executions were sequential, cache skipped, one worker:

```
python3 prepare.py > prepare.log
python3 run.py predecessor-controls predecessor corepack pnpm nx test kernel declaration-finally-precedence independent-finally-controls --skip-nx-cache --maxWorkers=1
python3 run.py successor-controls candidate corepack pnpm nx test kernel declaration-finally-precedence independent-finally-controls --skip-nx-cache --maxWorkers=1
python3 final-audit.py > final-audit.log
```

Working directory for these script commands is this review directory; each COMMAND.json records actual test cwd, argv and pinned PATH. Both runs exit 0: **18/18 tests, 2/2 files**, no skip/filter or oracle adjustment. Original 16 prewritten cases execute the actual lifecycle/installed requirement/readiness seam, not a hand-written control-flow imitation. They assert explicit caught flags, error identity, all observers delivered despite the first throwing, zero active frames, wake/reentry and subsequent declaration usability. Their undefined assertions cannot confuse success with throw undefined.

One non-blocking coverage limitation was addressed independently: a later no-write declaration alone does not establish that reporting was reset after a reporter threw. Added scratch-only independent-finally-controls.spec.ts exercises two consecutive secondary failures with a reporter throwing undefined; reports must equal [undefined, undefined], and both primary object/undefined identities must survive. A second control makes scheduling throw undefined over a non-undefined completion failure. Both require all exported diagnostics to return to baseline after disposal. These controls passed unchanged on predecessor and successor. They establish these bounded registry counts, not universal GC freedom. Supplemental fixture is retained for review but is not part of the proposed patch.

First harness invocation failed before Nx because copied run.py expected a runs parent directory. Preserved in HARNESS-FIRST-FAILURE.txt; created that scratch directory and retried unchanged command. Both raw test logs also preserve Nx tsconfig-paths warnings from archived historical configs pointing at absent /private/tmp/st-unknown-access-candidate; no suppression added and the selected tests actually ran/passed.

Author raw logs independently inspected and archived under author-evidence: predecessor/successor 16/16; affected lint exit 0 with 0 errors/26 warnings; source and spec types exit 0; six original focused specs 55 pass/1 preserved retained-collection failure. These are author runs, not independent reruns here. EVIDENCE-SHA256.json hashes commands/results/logs and supplemental fixture. identity.json carries exact source hashes; final-audit.log confirms source preservation.

No broad suite, new spec-type run for the scratch-only additions, GC, performance, release, or C15 combined replay performed. Recommend composing only this frozen control-flow correction and its prewritten test, then replaying the eventual semantic merge. The unrelated retained-collection and C15 sibling equal-progress issues remain open.
