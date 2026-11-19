# Frozen structural semantic admission successor — not accepted

Candidate: `/private/tmp/st-structural-admission-successor/candidate`.

- Frozen source/test manifest SHA-256: `c5bc23c33106f0ba39223c9ac27665732dad087bf65f1342159c9c5093b77221`.
- Predecessor manifest: `45f6d1d91c7a51bd51a1d715d2fe7514b5b2158e846bf7a97439c265ba9b4574`, copied from `/private/tmp/st-row-source-successor/candidate` and reverified unchanged after work.
- Runtime patch: `source.patch`, SHA-256 `36b8479649d0ecd38ecbb2d1e5b41cd77a1fbbd501817c9dee11624458ff1c76`.
- Added test files: `tests.patch`; hashes in SOURCE-SHA256.json and EVIDENCE-SHA256.json. No existing assertions, public exports/types, or predecessor files changed.

## Implemented native slice

Only two runtime files changed: entity-signal.ts and causal-runtime/tree-realization-adapter.ts.

The collection source validates original structural effects against the effective ordinary view before lowering. The sparse temporary subject/key maps preserve explicit vacancy, recheck physical fallback against ordinary state, and simulate preceding effects. Rekey checks its original semantic key and ordinary destination vacancy. Remove remains subject-based, without a new recorded-key equality rule. Add requires ordinary absence/vacancy plus the adapter's original restore/backing evidence.

The adapter records admission against the exact returned operation array and current physical revision; validateEffects refuses invalid/stale admission before physical validation. applyAtomically also checks physical validity/revision and consumes the admission. A second revision check precedes member installation after preparation. Both existing restoration and transaction prepareOrdinaryEffects callers receive this shared contract; no caller-specific guard or planner substitution was introduced.

The heterogeneous route now recognizes retained ordinary structural work even if lowering produced no physical effect. This is intended to preserve ordinary-only installation obligations. Its added completion control is unresolved below, so this path is not claimed qualified.

## Exact runs

Pinned Node 24.15.0 / pnpm 10.17.0 and the predecessor dependency link `/private/tmp/v16-transition-qualification/node_modules`; Nx daemon/plugins disabled. Every command, first log and exit is preserved in `runs/<name>/COMMAND.json`, `first.log`, `RESULT.json`. No timeout changes.

| Gate | Result |
|---|---|
| `before-runtime`: new six paired controls + eight sequence controls on unchanged predecessor copy | 6 pass / 8 fail, exit 1 |
| `after-runtime-first`: same unchanged 14 controls | **12 pass / 2 fail**, exit 1 |
| `unchanged-adapter-restoration`: tree-realization-adapter.spec.ts, opaque-leaf-restoration.spec.ts, p0c-divergence.spec.ts | **67 pass**, exit 0 |
| `unchanged-transactions`: transactions.spec.ts | **43 pass**, exit 0 |
| `source-types`: tsc --noEmit -p tsconfig.typecheck-all.json | Pass, exit 0 |
| `spec-types`: tsc --noEmit -p tsconfig.typecheck-specs.json | Exit 2: **202 inherited diagnostics**, none added; normalized output byte-identical to preserved anchor-control baseline |

Runtime commands: `corepack pnpm nx test kernel --skip-nx-cache <listed spec files> --reporter=verbose --maxWorkers=1`. Types use `corepack pnpm exec tsc --noEmit --pretty false -p <config>`.

All six paired inspection/external controls pass: both scalar-first and structural-first orders, useful inspection undo/redo, coherent nonempty successful delivery, external refusal with unchanged physical values/history/redo, no refused delivery, and stable sampled source support/revision. The original opaque-leaf refusal and adjacent source-identified adapter atomicity/ordered-positive controls pass unchanged.

The 43 transaction tests are existing regression coverage, not a claim that every structural ordinary-lowering branch was dynamically covered. The additional sequence tests use the actual adapter attached by transactions, but are direct private-port tests; do not describe them as public transaction compensation tests.

## Remaining two failures and freeze boundary

**1. Ordinary remove under physical absence: support-identity assertion.** The new test validates and applies the semantic remove but expects `evidence.member(subject,'ordinary')` to change object identity. It remains the same object on both predecessor and candidate. Runtime changes stopped at this first postpatch result. Source evidence exports a requirement object, not the member's `present` bit (`experimental-publication/entity.ts:29`); missing members also return the shared `missing` requirement. Therefore this exact assertion needs independent oracle/causal disposition: unchanged requirement identity alone is not a complete readback of ordinary membership. Do not silently waive it, nor claim the intended ordinary-only completion succeeded. A stronger discriminator would establish meaningful before membership/obligation, then read producer-owned ordinary presence or a nonvacuous downstream ordinary result; it must preserve the original failure as history. No such follow-up runtime change or oracle replacement was made here.

**2. Numeric/string key control: pre-existing physical key-handoff preparation refusal.** The sequence removes the numeric-2 subject, then rekeys another subject to numeric 2 while string '2' remains. Semantic/physical validation succeeds; direct adapter installation throws `Cannot change id to 2: already in use` from `planRekey`, because physical plan preparation still sees the not-yet-installed removal. This was present before the runtime patch with the identical stack. Public complete-operation selection normally recognizes a remove/rekey key handoff as requiring the existing declarative target (`requiresDeclarativeStructuralTarget`); this test directly invokes the lower private adapter. Whether to promote this as an adapter completeness obligation or replace it with a supported typed-key discriminator needs review. No planner expansion, rerouting, fallback waiver or test change was made to obtain green.

Both failures remain in the executable frozen fixture. They are not silently skipped. The first may falsify ordinary-only completion or its new oracle; the second is an unchanged direct-route limitation. Neither is treated as acceptance.

## Review handoff

Main should commission independent replay of this exact freeze and disposition of both failures before a successor. No local subagent facility was available; no external review CLI was used. Review should also challenge complete semantic admission across both callers, all effective ordinary occupancy fallbacks, one-use/revision lifetime, and whether the existing callback-bearing preparation can invalidate the source state before install. Existing source finalizers are not newly claimed universally callback-free.

`FINAL-VERIFICATION.json` confirms frozen candidate hashes and untouched row-source predecessor. `PREREGISTERED.md` preserves the preimplementation scope, tests and stop boundary. The original six-control harness correction is separately preserved at `/private/tmp/st-structural-admission-controls`; the corrected fixture was copied byte-for-byte into this candidate before runtime work.

No production activation or integration. This is a concrete, typed native patch with passing primary refusal controls and two explicitly unresolved test boundaries, not a completed acceptable candidate.
