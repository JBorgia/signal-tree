# Archival verification

The archive contains1571 raw files,18548530 uncompressed bytes. Each file was
reread from the completed gzip tar and SHA-256 compared to its source manifest.
`raw-evidence.tar.gz` is4772321 bytes. These are evidence-storage sizes, not
production bundle measurements. `EVIDENCE-MANIFEST.json` records each entry.

The local Git bundle verifies successfully and contains final experimental
HEAD2d71d73305fea23173b3b681c2a897ef1a7dffba, requiring preserved ancestor
d0e7d1659900b18c9a63d280f409c0448a0c1d80. Its source worktree is clean. All698
files in the final combined-test source manifest match the frozen commit;
the two independent additions have their own exact-source first-run records.

Documentation verification ran:

```sh
node --import /private/tmp/link-a1-doc-loader.mjs tools/check-doc-links.mjs
```

The dependency loader is preserved; it supplies the installed semver dependency
from the isolated checkout without modifying the repository checker. Full output
is in DOC-LINKS.log. Git diff/staged-diff whitespace checks passed. No runtime,
framework, artifact, performance or collectibility qualification was rerun for
archival. The unrelated dirty AGENTS.md and measurement-contract.md retain their
preexisting hashes; they are excluded from the evidence commit.
