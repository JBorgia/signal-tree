# Record validation

Root replay using Node 24.15.0: unchanged window 46/46, final extra 16/16,
historical delivery 32/34 with both original differing assertions preserved.
Strict private helper TypeScript check exited 0. All 91 original bundled source
hashes match baseline e488ca34. Independent review reproduced first and final
controls and added two passing mixed-mode probes.

Archive extracted to /private/tmp/link-responsibility-archive-verify; every entry
in the worker SHA256SUMS verified. Outer SHA256SUMS identifies evidence.tar.gz.
`node tools/check-doc-links.mjs`: 636/636 links resolve.
`git diff --check`: pass. An earlier documentation check ran before archive creation
and reported exactly the two not-yet-created archive/checksum targets; its log is
preserved inside the archive. Final check follows creation and passes.

No runtime files edited. No full suites, artifact builds or performance campaign
executed for this private research record. Unrelated AGENTS.md and measurement
contract edits excluded from staging.
