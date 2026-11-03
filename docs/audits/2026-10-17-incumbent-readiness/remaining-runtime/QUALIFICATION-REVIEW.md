# Independent qualification gap review

Inspected HEAD: `d832058c120f560bfb995fc55de3fd43d99d40ed`.
Worktree: `/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree`.
Read-only source/document audit. No tests, builds or repository edits executed.

## Acceptance map

- Atomic older-overlap refusal, newest-first useful retry, disjoint settlement: transactions/transaction-safety.spec.ts, including successful retry, state and pending-count assertions.
- Plan-conflict and installation-refusal retain authority/durable hold: transactions/rollback-refusal-scope.spec.ts.
- Truthful errors and inspection, terminal snapshot freeze: rollback-refusal-legibility.spec.ts, settlement-inspection-terminality.spec.ts, proposal-inspection-safety.spec.ts, queued-inspection-review.spec.ts.
- Failed abort recovery, thrown-value handling, reentry and destruction: recovery-handle-0.spec.ts, reentrant-order-v16-controls.spec.ts, transaction-safety.spec.ts, confirmed-destroy.spec.ts.
- Capture safety/new keys: kernel whole-value-new-keys.spec.ts, incremental-materialization.spec.ts, e-membership-reachability.spec.ts and existing paired-capture controls.
- Four-framework native timing/coherent SignalTree projections: each facade transaction-realization.spec uses packages/kernel/src/transaction-realization-contract.ts; Vue also has settlement/entity-projection/prepared-selection publication controls.
- K2 typing: source typecheck, spec-types, installed strict consumers; preserve exact-unknown, known/hybrid, readonly and whole-write controls.

The supported semantic workflow already has meaningful tests. Preserve the historical 424-row matrix and its 188 held / 68 violated / 168 unsupported result; establish supported contracts separately on final source, not by relabelling historical rows.

## Final qualification

Per .github/VALIDATION_GUIDE.md, serially after source freeze and independent review:

1. node tools/verify-gates.mjs --release
2. node tools/verify-gates.mjs --self-test --release
3. Remove generated dist and pnpm run build:all --skip-nx-cache.
4. Run verify-tarball-consumer.mjs, verify-consumer-typecheck.mjs, verify-angular-aot-consumer.mjs.
5. Fresh production demo build and pnpm run smoke:routes.
6. Version/release-state/changelog verification, final diff/status/SHA and artifact hashes.

Registry test:all covers kernel, Angular, React, Vue, Solid, demo and react-reference. Release-only measurements remain required; no additional exploratory campaign is implied. Historical coverage percentages are not registry-enforced and cannot be claimed from registry success.

## Concrete documentation inconsistencies found

1. RELEASE-CURRENT points to reconciliation/README as current detailed disposition, but that historical record says K2 requires deferred handles and narrowing is unauthorized. Add superseded-status pointer to applied unknown-access migration; preserve historical evidence.
2. docs/guides/time-travel-in-production.md table near lines 233–236 teaches getCurrentIndex as undo/redo depth and snapshot-jump as optimistic undo. jump-undo-equivalence.spec.ts:104–105 states causal undo does not move that index. Teach canUndo/canRedo and transaction rollback, without runtime cursor change.
3. Controller Updated October 18 predates its October 19 correction entry; refresh in final reconciliation.

## Limits

No final-source full qualification exists. Focused restoration, Link-publication, K2 and earlier incumbent results do not certify the forthcoming combined runtime. No additional runtime defect established by this audit. Parent subsequently reported applying superseded pointer and index teaching corrections, with 585 documentation links resolving; that report is not an independently executed check in this review.
