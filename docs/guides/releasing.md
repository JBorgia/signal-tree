# Releasing SignalTree

SignalTree has two release authorities:

- `scripts/prepare-release.mjs` owns versioning, validation, the release commit,
  signed tag, and pushing that tag.
- `scripts/publish-candidate.mjs` owns candidate construction, exact tarball
  validation, npm dist-tags, idempotence, and registry publication.

The compatibility shell scripts delegate to those Node entry points. They do
not contain independent build, validation, or publish loops.

## Normal Flow

1. Merge the intended source to the release branch.
2. Run `pnpm run release:patch`, `release:minor`, or `release:major`.
3. Confirm the pushed signed tag passes `.github/workflows/release.yml`.
4. Dispatch `.github/workflows/publish.yml` for that tag.
5. Verify npm and a fresh external installation.

The publish workflow uses one tagged checkout and one build. Validation and
publication therefore operate on the same candidate bytes.

## Dry Run

```bash
pnpm run publish:dry-run
```

This builds, validates, packs, and executes `npm publish --dry-run` for all
three packages. It creates no tag, commit, push, or registry version.

## Authentication

CI uses npm trusted publishing with GitHub OIDC and provenance. An explicit
local emergency invocation may use existing `npm whoami` credentials or an
`NPM_TOKEN`; token configuration is written to a temporary ignored candidate
file and removed in `finally`.

## Recovery

Candidate metadata lives under ignored `.release/candidates/<version>/` and
records commit, package order, dist-tag, tarball names, integrity, and state.
Already-published versions are skipped only when npm reports identical
integrity. A mismatch, authentication failure, or registry lookup failure stops
the run before another package is published.
