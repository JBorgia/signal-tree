# Evidence-record validation

- `node tools/check-doc-links.mjs`: 620 relative links across 160 live surfaces; 620 resolve.
- `git diff --check`: exit 0.
- Archive extracted independently; both delivery and model `shasum -a 256 -c SHA256SUMS` checks exit 0.
- Root replay: 34/34 targeted delivery checks, 13/13 model adversarial checks and 42/42 setup-corrected model observations; ticket mutation rejected. Original fixture conflict and inherited witness failures remain separate.
- Three source receipts each verify 88 original kernel inputs against source baseline 65dd717fcda88663d0200c5b254784aec37f9239; no mismatch. Strict standalone helper/model typechecks pass. Raw root outputs are archived.

No package source changed. No full suites, benchmarks, package/demo build or release sign-off was executed for this evidence-only change. Unrelated AGENTS.md and measurement-contract.md edits were excluded.
