# Current work — incumbent v16 readiness

Updated October 18, 2026. Branch `codex/v16-incumbent-readiness`.
Baseline: `8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`.
Accepted new-key runtime checkpoint: `9917c92fbbdc9dfdd14601f1f5fb7ce21799be71`.
Version **16.0.0-dev**. **Not release-ready; no final candidate freeze yet.**

## Scope and authority

Complete the finite incumbent release contract and its required verification.
No release, merge, push, activation, tag, publication or unrelated architecture
change. B's replacement track is closed at `17e1a76f` and is not a repair queue.
Original checkouts, rejected checkpoints and first-failure evidence are preserved.

Owner decisions:

- Ordinary whole-value writes may create supplied new keys. Internal inspection
  replay retains its separate unknown-key policy; stable v15 remains unchanged.
- Four new-key artifact ceilings are approved and verified. This is artifact-cost
  acceptance, not performance neutrality or release readiness.
- Owner-authorized string-Record migration: arbitrary direct access is unknown;
  known/hybrid children and whole-value writes retain their types. The reviewed
  type-only patch is applied. No lookup export or deferred-handle runtime is added.
  Other index-signature forms remain outside this bounded migration.
- Documented newest-open-first settlement is v16 scope: atomic retryable refusal,
  retained authority, useful retry, truthful inspection/errors and independent
  progress remain required. Server reconciliation policy belongs to applications.
  Arbitrary-order surgical success and canonical authority projection remain
  preserved advanced capability targets, not claimed release capabilities.

## Current acceptance checklist

[Reconciliation and exact evidence](docs/audits/2026-10-17-incumbent-readiness/reconciliation/README.md)
are the current detailed disposition. The original
[inventory and row classification](docs/audits/2026-10-17-incumbent-readiness/README.md)
remain historical evidence at their stated source.

| Item | Status | Next acceptance requirement |
| --- | --- | --- |
| Whole-value new keys / capture | Complete for checkpoint | Preserve passing retention, reentry, recovery, inspection and four-framework controls |
| Artifact cost | Approved, four budgets pass | New source changes need fresh affected artifact validation; no further size campaign without changes/evidence |
| String-Record direct access (K2 bounded migration) | Reviewed typing patch applied; source hashes match verified copy | Unknown arbitrary access, known/hybrid children and whole writes preserved; migration guidance saved; no lookup/deferred API implemented |
| Two composed-restoration failures | Proven defects; six desired assertions fail | Supply complete-turn order/frontier evidence without weakening drift guards; pass undo/redo, identity, interleaving and publication controls |
| Independent Link progression | Ten failures reproduced on current source | Preserve shared consequence safety while allowing actual independent work; no tree-gate bypass |
| Stronger semantic matrix | Scope disposition recorded, not passed | Preserve 188 held / 68 violated / 168 unsupported record and test supported public contract separately |
| Final exact-SHA qualification | Not yet eligible | Close supported blockers, freeze source, then complete required verification |

## Verified evidence and limits

- [Applied string-Record typing migration](docs/audits/2026-10-17-incumbent-readiness/unknown-dynamic-access/README.md)
  records exact destination hashes, reused verification, independent review and
  [consumer migration guidance](docs/guides/open-record-typing-v16.md).

- [Paired capture repair](docs/audits/2026-10-17-incumbent-readiness/paired-membership/README.md)
  preserves runtime `89bfca62` and evidence `96a54e6a`.
- [Artifact attribution](docs/audits/2026-10-17-incumbent-readiness/artifact-cost/README.md)
  identifies the separately verified helper optimization `9917c92f`.
- [Approved artifact decision and receipt](docs/audits/2026-10-17-incumbent-readiness/ARTIFACT-ACCEPTANCE.md)
  records ceilings implemented at `4dfc3576`; 248 identified artifact hashes
  remained unchanged. Prior failed budget runs are preserved, not relabelled.
- [Preregistered representative cost](docs/audits/2026-10-17-incumbent-readiness/representative-cost/README.md)
  leaves timing direction and large pending-owner attribution unresolved. Corrected
  cleanup supports sampled tree collectibility, not universal absence of leakage.
- Current focused reconciliation: restoration **71 ordinary passes / 6 expected
  failures**; unchanged Link cases **10 violated / 2 unsupported**. Vue shape
  counterexample strictly typechecks and its populated controls execute.
- [Exact baseline qualification](docs/research/v16-candidate-acceptance-0/RESULT.md)
  applies to `8d220643`, not a future runtime. Existing successful gate runs do not
  close current supported-behavior failures or certify another source/artifact.

## Final verification boundary

Once supported requirements are satisfied, obtain independent review and freeze
the final runtime/source. Run the required affected suites, runtime/spec types,
lint and documentation checks, then the complete release registry, mutation proofs,
fresh package/demo builds, installed-artifact consumers and framework/browser
checks against identified final source/artifacts. Rebuild after mutation tests.
Record ordinary passes, expected failures, skips and unexecuted checks separately.
Do not declare the stronger matrix fulfilled or add APIs merely to observe it.
Verification grants no publication authority.

### Preserved runtime counterexamples after typing migration

See the [separate boundary evidence](docs/audits/2026-10-17-incumbent-readiness/runtime-boundaries/README.md).
Compound rollback restores rows but history retry fails ST1034; the one-removal
repair is not general compensation support. The [bounded Link publication repair](docs/audits/2026-10-17-incumbent-readiness/link-order-repair/README.md)
now passes queued/in-flight and reentry controls with independent review. Original
Link failure remains archived. Compound restoration and independent Link progress
remain blockers; this is not final runtime qualification.
