# C0 plus lazy optional responsibility capture

Baseline C0 f80a70476d3e110db83242f7a17ef02964d7bb7dcb5c071de7d89151e2547e26. Adds only the independently reviewed lazy capture helper and its two call sites. Exact composition conflict and first failed run preserved in COMPOSITION-NOTE.md; a missing helper from a failed patch hunk produced40 ReferenceErrors, not40 independent semantic defects. The helper was inserted verbatim without replacing the placement-enhanced surrounding function.

Completed composition run:84 passes across12 files. Source-types exit0. Source/log identities and commands under runs. Full source qualification and costs remain open. No production change or activation.

Spec-type ratchet also passes unchanged. Frozen manifest: bac3ad33b8eee7bd0e5851461de9b95fd3144d26e3f6db70d84193a70c76179f.
