# Archive checks

The runtime is a clean local conceptual commit75416029be1e0c1d9735ed3bdc0f4e8e6c02f775. Every committed source/test hash matches the frozen final qualification manifests. Source types pass; spec-types ratchet passes with existing diagnostics, without --update. No assertion edit, lifecycle rewrite, production runtime change, API enabling or budget change.

Raw evidence archive:98 files,1,561,231 compressed bytes. Each decompressed file was compared byte-for-byte with its original under /private/tmp/link-authored-removal-evidence. An initial verification script completed comparisons but then attempted a count on a closed tar handle; the corrected verification completed successfully. This was archival tooling, not runtime/test evidence. Original files remain available.

Documentation generator: node --import /private/tmp/link-a1-doc-loader.mjs tools/check-doc-links.mjs; exit0,913/913 relative links resolve across205 live surfaces. The loader only supplies the existing dependency environment. Documentation-only work does not inherit release sign-off.

Unrelated AGENTS.md and docs/performance/measurement-contract.md changes remain unstaged and byte-identical to their pre-task SHA256 values recorded in the controller worktree check. Local archive/controller commit excludes them. No approval-review rejection occurred. Tests not executed due earlier shell/script issues remain separately recorded, not reported as tested.

Raw patch context and CRLF tool logs produced staged whitespace warnings when duplicated as plain archive files. Their byte-exact originals remain inside raw-evidence.tar.gz; redundant plain copies were removed rather than altering evidence. The final staged diff check passes.
