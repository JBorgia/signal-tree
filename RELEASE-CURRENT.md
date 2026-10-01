# Current work — development checkout

Updated October 1, 2026. This checkout is `fix/d1-d2-forward-port` at baseline
`148d57c5b5fe07437f1b4a07ec335d23ba826c9f`, version **16.0.0-dev**.
It is not the current v15 release candidate. The unrelated untracked `frontier`
file is not owned by the guidance cleanup.

## Scope

The authorized task here is guidance consolidation and correction of generated
demo version labels to the already-declared development version. The active public v15
implementation/performance verification is in the separate
`fix/v15-link-settlement-diagnostics` worktree, currently 15.4.0 unreleased.
That worktree has its own RELEASE-CURRENT.md and artifact evidence. Do not copy
its runtime, API claims, candidate status or verification result into this branch.
No v16 publication or new product architecture is authorized by this controller.

## Continue safely

Use [AGENTS.md](AGENTS.md) for task routing and [support policy](docs/support-policy.md)
for compatibility. Before resuming code or release work on this branch, establish
its intended scope from the current user task and verify implementation differences
against the intended baseline. A historically completed gate is not evidence for
this checkout's current artifacts.

Use [validation](.github/VALIDATION_GUIDE.md) and [release tooling](RELEASE_PROCESS.md)
when release verification is actually requested. Exact-source/artifact checks and
explicit push/tag/publication authorization remain mandatory.

## Preserved records

[RELEASE-1.0.md](RELEASE-1.0.md), [TODO.md](TODO.md), and the
[architecture context](docs/architecture/SIGNALTREE-15-CONTEXT.md) retain historical
findings, decisions and unresolved reservations. Their old current-phase/next-step
headings are not an automatic work queue. Frozen product constraints remain
indexed in [contributor contracts](docs/contributor-contracts.md).

## Guidance checkpoint validation

The short entry points, scoped contracts and historical banners are applied.
Import, semantic-discoverability and numeric-claim checks passed. Documentation
examples: 29 checked across 25 live documents. The production demo build first
aborted in native LMDB inside the sandbox; the same uncached build outside the
sandbox passed. Both results are preserved in the local October 1 audit logs.
No kernel/framework behavior, package version or public export changed. The demo
version generator corrected stale 16.0.0 labels to existing 16.0.0-dev; those two
generated files are included in this checkpoint. The unrelated `frontier` file
remains untouched. This is not release qualification.
