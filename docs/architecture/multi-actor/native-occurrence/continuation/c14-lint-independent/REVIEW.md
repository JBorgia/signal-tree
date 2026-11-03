# Independent C14 lint cleanup review

Bounded accept for composition of the frozen four-file cleanup. No behavioral or public-symbol blocker demonstrated. This is NOT a passing lint gate: `no-unsafe-finally` remains at lifecycle.ts:407, with 26 warnings. No approval of C15 enrollment/declared:false composition is implied.

## Exact inputs

Author packet: /private/tmp/st-c14-lint-cleanup; candidate manifest SHA256 `4b48ad0640fa4b480c072f0f8c05a72898422a5c3067d90e7a9bc40ccb701e30`; FROM-C14.patch SHA256 `b3c188fd18a5451a68345cf3bae558994ebf2aafb2ffb9ff0563f05787734169`.
Base: /private/tmp/st-native-combined-c14/candidate; manifest SHA256 `3f6ebe5bab4f82766422810aca4d710eb9f720ee16216dfa8e20c1a4bb03bae8`.
Independently verified all 3,059 manifest entries in EACH tree and exactly the four declared changed paths. `identity.json` records individual changed source hashes and raw evidence hashes. Root HEAD inspected: 628d302dadb082a48c58528651c9088234d0a777; unrelated dirty root preserved. Reviewed docs/review-contract.md and contributor-contracts.md. No release sign-off requested.

## Findings and reasoning

1. Deliberate error precedence is preserved, not rewritten or suppressed. Candidate experimental-publication/lifecycle.ts:393–410 catch/finally block is byte-identical to C14. A callback primary error remains primary even when validation/completion fails; secondary errors go to the guarded reporter. If the main path has no exiting error, a finish failure must escape instead of returning a receipt. The remaining finally throw supplies this behavior. Removing it to appease lint would lose a real failure. `wake(channel)` remains in the nested finally and schedules asynchronous refresh (line 16); no synchronous user callback was newly introduced. This review establishes unchanged behavior, not a new proof of every inherited exception path. Leave this lint gate explicitly open; a future rewrite needs focused callback/validation/completion/reporter error identity and ordering tests before acceptance.

2. Shared structural guards preserve the old value domains. lifecycle.ts:378 explicitly excludes functions from declaration input, while :391 retains callable thenables. private.ts:55 still traverses objects/functions only. The imported node-shape helper uses only null/typeof checks, no getters or framework import; its only import is type-only. Independent executable comparisons covered 17 representative values, including a throwing proxy and revoked proxy, and triggered no traps. No newly accepted callable declaration or skipped thenable behavior was demonstrated.

3. `const binding` is safe at private.ts:403: RecipientOccurrences constructor (recipient-occurrence.ts:32) only stores callbacks; first enrollment occurs after binding initialization. Closure capture does not evaluate binding at constructor time. Actual trie insertion (:431), removal (:461), occurrence disposal, pending resolution, connection cleanup and projection release remain. Removed helpers are private, unused declarations; indexedBindings was write-only. Its removal does not remove the index or a reported diagnostic. Local `own` arrays and index.exposed calls are unrelated to removed private helpers.

4. No public symbol removal or lint weakening. Independently compared exported declaration names/signatures and non-function export statements in both runtime files. Exported inert attachRevision and complete remain, with explanatory comments. All package entrypoints, lint configurations, budgets, discovery and registries are unchanged by full-manifest comparison. Both fixture files emit byte-identical JavaScript with comments stripped: assertions, callbacks, cleanup and fixtures retain their behavior.

## Falsifiers run and not run

Own commands (exit 0; scripts and raw stdout saved alongside this report):

```
python3 /private/tmp/st-parent-freshness-implementation-independent/c14-lint-independent-review/audit.py > /private/tmp/st-parent-freshness-implementation-independent/c14-lint-independent-review/identity.log
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node /private/tmp/st-parent-freshness-implementation-independent/c14-lint-independent-review/equivalence.cjs > /private/tmp/st-parent-freshness-implementation-independent/c14-lint-independent-review/equivalence.log
```

These independently check full frozen identities, changed-file scope, exports, fixture emission, catch/finally bytes, and predicate equivalence. TypeScript is loaded from the local installed package, no external service. No runtime/test/config edits, no execution inside frozen candidate, no external submission.

Author raw evidence inspected, NOT independently rerun: runs/cleaned-lint/first.log and RESULT.json show exit 1, one no-unsafe-finally error and 26 warnings; source-types and spec-types logs/results show exit 0 (spec baseline unchanged, three existing improvements); scalar-composition log shows 55 passed, one failed, six files. Failure is native-certificate-successor.spec.ts “omission then restored retained collection selects matching payload and support,” preserved rather than hidden. This matches the Main-reported C14 count; equivalence cleanup does not authorize correcting its oracle. Author exact commands/results and first logs are copied under author-evidence for archival.

No independent Nx suite rerun: comment-only test changes and unchanged catch/finally were checked directly, while the guard and initialization changes have bounded equivalence evidence. No C15 replay, broad suite, GC rerun, performance or release verification. Main should replay the eventual composition; keep the remaining lint failure visible.
