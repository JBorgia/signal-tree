# v15 legacy boundary cleanup

Baseline: `fc279c279b3f1a9d6a9ac17330f5dcf9d0ccdba4`, runtime
`4d1142d6166b2d5b2874715e38097665545864dc`. Owner authorized legacy cleanup
and a specific audit of whether supported v15 responsibilities belong elsewhere.
Stable v15 compatibility remains binding.

## Disposition

Remove the unexported legacy audit implementation, its sole-use change diff,
and the unreachable serialization/storage-adapter implementation. Remove empty
barrel reexports and retire the historical defect runner explicitly; it no longer
pretends to validate deleted APIs. This is source maintenance, not an asserted
runtime speedup or permission to remove supported APIs.

Preserve the surviving Link authority, egress, drain, commit boundary and ordering
contracts in named Link suites. Keep meaningful marker, walker, atomicity,
rollback, enhancer typing and Angular SSR transfer checks through current public
operations. Retention tests exercise scalar/root Links, a root endpoint that
captures its owner, positive delivery, bare/live/destroyed controls, and a disposed
endpoint while its owner remains usable. The independent derived-chain test
continues to cover the old finalizer strong-hold defect fixed by `713f8a458`.

Independent source review found no supported public capability that should be
removed or moved to a new package. Kernel imports remain framework-neutral;
framework lifecycle and forms integration stay in facades. Transactions,
restoration and DevTools are optional enhancer implementations. Link accepts
application endpoints rather than embedding network/storage policy. Public
observation interfaces project kernel facts; they do not embed the private Studio
recorder, sessions or query engine. Held setters require construction-time kernel
interception even when Link is attached later. No new feature flag was justified.
Disconnected experimental/validation sources are not evidence of shipped cost.

## Development verification

The cleanup kernel run passed 427 files: 7,826 tests passed, 7 expected failures,
13 skips and 1 todo. Strict kernel types and spec-type ratchet passed. The bare
module identity control passed. Subsequent strengthened post-throw Link delivery,
Angular SSR transfer and both selected retention gates passed. Independent review
found no supported-API removal or runtime blocker. Full committed-candidate gates,
artifact equivalence and production demo checks are recorded separately when
complete; these development checks alone are not release sign-off.

Evidence is generated under
`artifacts/publication-activation-2026-11-17/` by the central study's
`tools/publication-activation/run-command.py`. Commands, exact source patches,
logs, exits and hashes are retained. The central publication-activation study
records both v15 cleanup and the separate v16 experiment. No tag, registry
publication or deployment is selected by this cleanup.
