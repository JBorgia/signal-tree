# R3 state repair: frozen prototype, qualification conflict open

Private two-file successor only. No fixture, public API, root runtime, or frozen R3 edits. Base HEAD 628d302dadb082a48c58528651c9088234d0a777; exact source identity is BASE-MANIFEST.json (e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3), not HEAD alone. All 3095 base files verified at copy and freeze. Candidate differs in precisely the two runtime files listed in RUNTIME-MANIFEST.json. Tests remain byte-identical. Node24.15.0 / pinned pnpm / Nx, root node_modules linkage, separate output/cache/data directories. No broad suites.

## Trace and correction

TRACE.patch is diagnostic-only, applied to the separate trace copy, never candidate. It appends captured primitive metadata/effects to JSONL at terminal preparation, the existing duplicate guard, and materialization. It adds synchronous I/O; it does not rewrite return values, decisions, notifications or exceptions. Commands, process groups, source hashes, raw output and results are under each runs directory; run.py records argv/environment and applies a bounded owned-process deadline.

runs/trace-first: original two controls, three parameterized cases: 2 failures / 1 pass, exit1, no timeout. Raw trace.jsonl confirms (1) synchronous external x2/x1 arrives realized with ambient transaction ID, both discarded by installed-owner dedup; externalEffects empty, compensation x0. Queued counterpart retains ABA effect and passes. (2) left A/middle B/right C all prepare authored under outer ID; middle's later realized notification is discarded, and rollback includes middle. Exact original first failures preserved.

transactions.ts:2855 now exempts realized evidence from the installed own-write notification dedup. Authored notification predicate remains unchanged. tree-realization-adapter.ts:639 wraps frame planning/install/publication in realized context while spreading caller metadata. withWriteContext restores outer metadata on return or throw. The original outer-before/after and throw-restoration controls pass. No whole-context clearing.

## Executed qualification and new counterexample

runs/repaired-two-first: all unchanged tests in transaction-safety.spec.ts and tree-realization-adapter.spec.ts: 65 pass / 1 fail (66 actual cases), exit1, no timeout, source unchanged. Both original state controls pass, including both ABA scheduling variants. Existing callback-throw-undefined, observer error, rollback/refusal/retry, outer authorship and realization-throw controls execute unchanged.

The remaining failure is tree-realization-adapter.spec.ts:4224, `refuses a stale heterogeneous realization before any prepared structural mutation applies`: expected history baseline+1, observed baseline. Its private beginFrame/prepareCommit wrapper injects undoable(other = updated elsewhere) before forwarding to original preparation. The successor's realized context spans that injected callback. The fixture still reaches the stale-preparation throw and verifies other updated, status pending and original membership/name intact before failing history count. The subsequent observedNotifications assertion is unreached, not a pass.

runs/baseline-stale-first: same unchanged case on traced R3 passes (1 actual, 42 filtered), exit0, no timeout. This establishes an introduced fixture-visible difference, not a default public-only reentry reproduction. undoable.ts:65-69 explicitly says external realizations stay outside restoration even inside undoable; undoable itself does not override realized participation. Consequently neither weakening this assertion nor declaring the injection a demonstrated public regression is justified here. The preparation seam/context boundary needs independent adjudication. A narrower tagging mechanism or separately justified fixture boundary would require explicit review; neither was implemented.

runs/source-types-first: exact candidate `pnpm exec tsc --noEmit -p tsconfig.typecheck-all.json`, exit0, source unchanged. No new spec types (all fixtures unchanged), release/build, full suite, or public reproduction of injected preparation reentry run. Nx emitted existing audit-tsconfig resolution warnings; actual test execution/results are present and source typecheck succeeds.

## Disposition

Freeze for Tesla independent review, NOT composition acceptance. The requested two causal hypotheses are confirmed, not contradicted; their minimal context implementation exposes one additional unchanged-control conflict. All first failures retained. No oracle changes, new policy, or speculative further repair. Review actual runtime and the injected boundary independently before any promotion. This packet does not settle other dynamic-admission/cost/receipt failures or release authority.
