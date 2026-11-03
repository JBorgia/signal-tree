# Evidence validation

Baseline 3a20d56c7b4dce75bf9b4a50f43f0386cfd75b06. No package source edits.

- Root and independent reviewer replayed frozen first-window and historical delivery bundles. Window:45 pass/1 ABA failure. Historical delivery:32 pass/2 preserved old eligibility-oracle differences. Cross-tree unsafe admission is separate, not counted as a pass.
- Root verified91 original source hashes in first-window receipt and88 in each historical receipt; no mismatch. Exactly Link, PathNotifier and transactions are transformed in memory.
- Standalone private helper strict TypeScript check passes; not a transformed-kernel typecheck.
- Extracted evidence archive and checked its implementation SHA256SUMS: all entries verify.
- `node tools/check-doc-links.mjs`:633 relative links across162 live surfaces, all resolve.
- `git diff --check`:exit0.

No broad runtime/framework suites, benchmark campaign, package/demo build or release acceptance. Unrelated guidance and measurement-contract edits excluded.
