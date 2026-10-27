# Final checks for the frozen rejected entity draft

Identity: f7a0ffd9e2e34a23ceae85bff3cd8fa45ecaa82d, worktree clean.
FINAL-SOURCE-IDENTITY.json verifies every path/hash recorded by020's exact source
manifest still matches that commit. This confirms source identity, not acceptance.

## Verified source types

```sh
PATH=/private/tmp/link-membership-pinned-bin:$PATH COREPACK_ENABLE_NETWORK=0 corepack pnpm exec tsc --noEmit -p tsconfig.typecheck-all.json > /private/tmp/link-entity-obligation-evidence/FINAL-SOURCE-TYPES.log 2>&1
```

Workdir: /private/tmp/link-entity-obligation-integration.
Actual tsc process exit: **0** (exec session26646); diagnostics log: **0 bytes**.
The shell ran only tsc, so no following command masks its exit. Details are in
FINAL-SOURCE-TYPES-EXIT.json. No source edits or tests were performed.

Correction retained:020 had an empty tsc log, but its shell subsequently generated
a source manifest, so that command did not separately persist tsc's status. The
verified final check above resolves that evidence gap against the same source.
The earlier record remains unchanged and is not retrospectively relabeled.

## Finite verification disposition

020-IMPLEMENTATION-RESULT.md records every vector, exact predecessor comparison,
first failures and causal limits. Framework evidence is24 passing cases: new
native obligation controls017 (three per framework) and original declaration
composition019 (three per framework); neither substitutes for the other.

The source-type pass does not qualify the rejected runtime. In particular, the
authored remove of a relationship-baseline inspection lifetime is lost when O has
no delta; unchanged selected rich capture still sees partial inverse state; and
new metadata retirement is not qualified. Historical W evidence means the foreign
negative zero-count oracle needs interpretation rather than automatic leak labeling.
The four inherited semantic failures remain failures with source-derived causal
interpretations, not waived requirements.

No later suites, new runtime correction, artifact/cost campaign, API activation,
merge, push, tag, publication or release occurred in this lane.

## Root checks and framework replay

Root ran `node tools/check-spec-types.mjs` with pinned PATH/COREPACK_ENABLE_NETWORK=0: exit0, unchanged ratchet (`019-spec-types.log`). Existing spec diagnostics remain; no baseline update. Root's020 boundary replay reproduces3 policy-hold failures and2 introduced removal failures, with3 passes. `git diff --cached --check` passed before the exact20-file research commit. Original assertion hashes and every staged file matched the tested020 source (`STAGED-VERIFICATION.json`). The local rejected-research commit skipped Git hooks; no hook/lint/full-suite qualification is claimed.

Framework replay from the candidate, using the same environment as README:

```sh
corepack pnpm nx test angular --skip-nx-cache -- src/lib/entity-native-obligation-composition.spec.ts src/lib/declared-publication-composition.spec.ts
corepack pnpm nx test react --skip-nx-cache -- src/lib/entity-native-obligation-composition.spec.tsx src/lib/declared-publication-composition.spec.tsx
corepack pnpm nx test vue --skip-nx-cache -- src/lib/entity-native-obligation-composition.spec.ts src/lib/declared-publication-composition.spec.ts
corepack pnpm nx test solid --skip-nx-cache -- src/lib/entity-native-obligation-composition.spec.ts src/lib/declared-publication-composition.spec.ts
```

The original017/019 logs ran each file separately; the commands above combine the same six cases per framework for replay, not an additional claimed run.
