# Closed selected forwarding cleanup — bounded successor

Candidate: `/private/tmp/st-selected-forwarding-cleanup-successor/candidate`.
Predecessor: frozen `/private/tmp/st-prepared-paired-successor/candidate`, manifest `c47b821c5a805f5b37d6c0f5707098d9871fdf2575d22dcc3e12f4a4c93c81db`.
All 2934 predecessor manifest files were verified before copying and again against the frozen predecessor after implementation. Frozen/root sources were not edited. `SOURCE-VERIFICATION.json` lists the three runtime differences and added test/harness files; all predecessor specs remain byte-identical.

This implements the authorized private cleanup and Hume's exact proposal, preserved as `REVIEWED-PROPOSAL.md`. It is a bounded result for independent implementation/execution review, not broad-suite acceptance, API activation, release qualification, or a universal retention claim. The separate predecessor/successor broad comparison was not rerun here.

## Mechanism and ownership

- `selected-write-operation.ts`: each forwarding registration requires an open invocation/request, creates an edge containing the downstream function, and registers that edge with the invocation. A separate module-level factory receives only invocation and edge. The returned wrapper does not capture the original downstream factory parameter or dispatch receipt.
- Forwarding checks phase/edge, takes downstream into a synchronous local, and clears edge.next BEFORE entering downstream. Reentrant/saved replay refuses before another preparation. Terminal consume still clears request and changes phase to consumed; it does not close the whole dispatch prematurely.
- Close marks closed first, clears every registered edge including unforwarded edges, clears/detaches the inventory, and detaches request/outcome. Fail records the first error into the dispatch-owned receipt, then performs the same idempotent close. No callback executes as cleanup. No global registry, permanent graph, or runtime WeakRef is added.
- `location-runtime.ts`: dispatch owns `{failed,error}` locally. If an interceptor catches inner failure and returns, dispatch still throws that exact error, including undefined. A directly escaping replacement error still propagates as before; no new global first-error priority rule. Finally clears the local receipt's error and closes the invocation.
- `tree-realization-adapter.ts`: the row-shaped direct owner uses the same invocation/receipt construction and finally cleanup. It still consumes directly, without another interceptor pass. These are the only two open/close ownership sites; the other fail site is the existing interceptor wrapper, plus forwarding's catch.
- Whole-operation builder ownership is unchanged: staged edits/plans/deliveries retain required preparation independently of the invocation; existing abort and delivery-finally cleanup remain in place. Clearing a callback edge does not erase pending transaction authority, live source obligations, staged edits, or user-owned values. Ordinary public replace/derive/proceed implementations are unchanged.

## Executed behavioral and type gates

Pinned Node24.15.0/pnpm10.17.0; `NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false`. Commands, working directory, exits and captured environment are stored per run in `*.command.json`, `*.exit`, `*.log`; exact output-directory correction is below.

| Gate | Result / evidence |
|---|---|
| New forwarding controls | 9 passed, `forwarding-first.log`, exit0 |
| Unchanged predecessor gate | 139 passed /14 files, `unchanged139-output-fixed.log`, exit0 |
| Source types | `source-types.log`, exit0; final identity checked by `freeze-source-types.log/.exit` |
| Spec types | Corrected probe types exit0, `spec-types-probes-fixed.log`; freeze gate `freeze-spec-types.log/.exit` |

The nine controls cover two saved edges for success, skip, throw-before, throw-after, caught error, caught undefined, direct outer replacement error, and reentrant same callback; plus ordinary public saved-proceed behavior. Refused units preserve value/support and allow a fresh rollback after interceptor removal. Every saved callback refuses both before and after a later ordinary write. Existing139 includes unchanged saved-success/throw/skip, duplicate invocation, independent-write reentry, paired ordinary/physical support, callback timing and actual synchronous batching controls. No assertion was weakened.

Exact139 arguments after `corepack pnpm nx test kernel --skip-nx-cache`:
```
independent-prepared-unit.spec.ts independent-prepared-boundary.spec.ts batching.behavior.spec.ts batching-context-safety.spec.ts batching-semantic-scopes.spec.ts batching-adversarial.spec.ts external-baseline-coalescing.spec.ts batching-detachment.spec.ts batching-ownership.spec.ts main-invocation-scope.spec.ts native-invocation-handoff.spec.ts native-explicit-handoff.spec.ts selected-real-batching-review.spec.ts selected-ordinary-domain-removal.spec.ts
```
The successful replay additionally sets `ST_PREPARED_REVIEW_OUTPUT=/private/tmp/st-selected-forwarding-cleanup-successor/focused-observations` (created empty for this run). The initial command recorder omitted that variable from its selected-env list; the explicit invocation and output path are recorded here rather than pretending it was in the original JSON.

Types: `corepack pnpm exec tsc --noEmit -p tsconfig.typecheck-all.json`; `node tools/check-spec-types.mjs`. No ratchet/baseline changes or suppressed diagnostics.

## Matched retention observations

The unchanged prior GC probe and its collector/12 real-task-boundary samples per phase were reused through the isolated Nx target. The pre-edit c47b held run (`baseline-held.*`) reproduced the reviewed retention: tree, field, publication binding, native publication source and baseline requirement reachable while only proceed was held; row and transaction collected; all sampled targets collected after dropping proceed.

On the successor, `matched-drop-proceed.*` and `matched-hold-proceed.*` both show every sampled library target collected during held sampling. Saved callback replay still refuses. `matched-hold-row.*` retains the explicit row and associated sampled receiver/source graph while held, then releases them. Positive and negative sentinels behave as intended. Original success probe bytes are unchanged.

Extended typed probes use two saved edges and an object-valued array leaf; they run success, unforwarded skip, and caught receiver-bearing Error, each with drop/hold-proceed arms. Setup asserts failure/success, exact caught cause, atomic values, retry after detachment, teardown and GC availability. Every sampled tree/row/field/binding/source/transaction/baseline requirement/error/operation-value collected in callback-only arms after unwind/teardown. Both saved callbacks refuse. `typed-explicit-value.*` instead holds operation.value: that exact value survives while explicitly held and collects after release. No receiver is weakened to achieve this.

Use `GC-SUMMARY.json` for all round stability and endpoint booleans; raw JSON files preserve every sample. Final extended evidence is `typed-extended-{success,skip,caught}-{drop-proceed,hold-proceed}.*` and `typed-explicit-value.*`. Earlier extended runs are preserved but are not the final strict-type fixture identity.

Commands (all via Nx; no new direct Vitest execution outside Nx):
```
NODE_OPTIONS=--expose-gc ST_GC_ARM=<drop-proceed|hold-proceed|hold-row> ST_GC_OUTPUT=<fresh-json> corepack pnpm nx run held-continuation-probe:retention --skip-nx-cache
NODE_OPTIONS=--expose-gc ST_GC_SCENARIO=<success|skip|caught> ST_GC_ARM=<drop-proceed|hold-proceed|hold-value> ST_GC_OUTPUT=<fresh-json> corepack pnpm nx run held-continuation-probe:extended --skip-nx-cache
```
`run-gc.py` and `run-gc-typed.py` preserve the executed arms. The ephemeral Nx project/config/probe files are validation fixtures, not public package changes. These GC specs require --expose-gc and are not a claim that an untargeted default full-suite invocation is qualified with the ephemeral fixtures present. No original Vitest/project/gate configuration was edited.

## First failures preserved

1. `unchanged139.log`, exit1: required observation-directory environment was missing. Six tests failed opening `undefined/...`; seventeen failed the explicit fresh-directory guard. Do NOT credit downstream assertions from those failures or classify them as runtime counterexamples. No runtime/test change fixed this; successful replay uses the fresh directory above.
2. `spec-types.log`, exit1: original isolated collector import lacked a declaration; the new extended probe used a nested plain-object entity field as though its type were a writable leaf. Fixed with an accurate `collect():void` tooling declaration and an array-valued leaf, without casts weakening the location type. `FIRST-forwarding-retention-probe.spec.ts` preserves the pre-correction fixture. All seven affected extended GC arms were rerun using the corrected fixture; original matched success probe is unchanged.

No runtime failure occurred in the executed cleanup controls. No broad/runtime-suite/build/framework/size gate is claimed. Finite WeakRef collection observations do not establish zero retained bytes, universal release of all internal objects, or behavior across native frameworks/engines. User-retained operation values/receivers remain legitimate owners.

## Review artifacts

`source.patch`: three runtime files only. `tests-and-harness.patch`: added validation files. `successor.patch`: combined reconstructible patch. `SOURCE-SHA256.json`: exact successor manifest including harness. `PREDECESSOR-SHA256.json`: original c47b manifest. `SOURCE-VERIFICATION.json`: predecessor preservation and changed-path inventory. `FREEZE.json` binds source, patch and final gate exits. First logs and observations are not overwritten.
