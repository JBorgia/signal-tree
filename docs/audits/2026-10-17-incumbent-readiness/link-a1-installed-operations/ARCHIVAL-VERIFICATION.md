# Archive verification

All 208 raw files were read from the archive and matched EVIDENCE-MANIFEST.json.
Archive files matched ARCHIVE-SHA256.json; git bundle verify accepted the
single-commit candidate bundle with f01 as its prerequisite. The isolated source
checkout is clean at d0e7d1659900b18c9a63d280f409c0448a0c1d80.

The first documentation command did not execute checks because the readiness
worktree dependency link could not resolve semver. It is an infrastructure failure,
not a broken-link result. The unchanged checker was then run against the actual
readiness tree with the archived process-local loader resolving only semver from
the candidate dependency installation. No repository dependency link was changed.
Command: node --import /private/tmp/link-a1-doc-loader.mjs tools/check-doc-links.mjs.
Result: 822/822 relative links across 192 live surfaces resolve. This does not
qualify runtime, historical numeric claims or archive Markdown as live docs.

Unrelated AGENTS.md and measurement-contract.md edits were hash-checked unchanged.
No source/runtime, API, ceiling, or production activation accompanies this archive.
