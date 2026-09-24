# Authority conformance evidence

Both candidates produce **0 held, 1 violated, 10 unsupported, 0 errors**. This is supplemental evidence, not a whole-law or release verdict. No production, adapter, prototype, retention, or frozen-law changes were made by this slice.

| Candidate | Identity | Violated | Unsupported |
|---|---|---|---|
| Immutable HEAD | `7ade0e3ecb25ff0d06da4355b5f7d67844e147b7` production sources | A1 | A2–A6, T18–T22 |
| Current | Working-source hashes recorded in `current.json` | A1 | A2–A6, T18–T22 |

A1 directly measures visible `y=7` after an unrelated snapshot where the frozen law expects the pending `y=1`. The independent settlement reader still reports pending with authority. The canonical reader throws the adapter's explicit `UnsupportedSemantic`; that missing capability neither hides the visible violation nor becomes a pass.

A2/A3/A4/T20 stop at unsupported correlated authority ingress. A5/A6/T18/T19/T21 stop at unsupported revision ingress. T22 records pending/retained-authority facts, then reports unsupported canonical reading. Thus T22 does **not** claim conformance merely because a pending handle survives. No revision ordering or canonical/pending overlay was synthesized in an adapter.

## Preregistration and provenance

`PREREGISTRATION.md` states every operation and expected checkpoint. `FROZEN.json` was written before the first selftest or candidate execution and hashes the oracle, its selftest, preregistration, and frozen semantics-2 documents. All hashes still match. Both evidence files report `changedInputs: []`. The immutable run loads candidate production sources directly with `git show` at the recorded commit; only the shared test harness stays current. Runner integration belongs to Mencius; this slice did not edit it.

## Exact validation

- `node tools/run-core-vitest.mjs src/enhancers/transactions/semantics-authority-selftest.spec.ts` — **28 passed**, exit 0. These are scripted instrument controls, not candidate conformance. They cover assertion reachability, corrupted canonical/visible/settlement evidence, unsupported readers/ingress, refused successful settlement, unexpected operation/construction/disposal failures, and numeric event checkpoints.
- `node tools/run-semantics-supplemental.mjs current docs/audits/2026-09-23-semantics-authority/current.json authority` — expected exit **1**, totals above.
- `node tools/run-semantics-supplemental.mjs baseline docs/audits/2026-09-23-semantics-authority/baseline.json authority` — expected exit **1**, identical per-case classifications.
- `pnpm exec eslint packages/kernel/src/enhancers/transactions/semantics-authority.ts packages/kernel/src/enhancers/transactions/semantics-authority-selftest.spec.ts` — exit 0.
- `pnpm exec tsc -p /private/tmp/semantics-authority-tsconfig.json --noEmit` — exit 0. Strict targeted check includes both new files and their imports; it extends the repository source-check config and explicitly includes the selftest instead of relying on Vitest's type stripping.

Raw local logs: `/private/tmp/semantics-authority-{selftest,current,baseline,lint,types}.log`. Machine-readable candidate evidence is preserved beside this report. No commits.
