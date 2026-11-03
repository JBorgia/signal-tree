# Validation

Node24.15.0, standalone model at repository baseline9b5aa72f. Initial18 scenarios
match their expectations (17 positive + one intentional unsafe hidden-omission
witness). First then-getter reentry failure preserved independently by root/reviewer.
Correction retains scope through return-shape validation. Final original18, unchanged
getter falsifier and three error-priority controls execute successfully. This is not
22 production safety passes: one case intentionally demonstrates a leak.

Extracted archive to /private/tmp/link-declaration-extract-check; every internal
manifest entry verifies, and all three fixed scripts rerun successfully from extraction.
Outer SHA256SUMS identifies compressed archive. Independent review includes exact
first/final model hashes and scope limits.

`node tools/check-doc-links.mjs`: 653/653 resolve; `git diff --check`: pass.
No production runtime edits, Nx/package suites, framework tests, builds or benchmarks.
Unrelated AGENTS.md and measurement-contract edits preserved and excluded.
