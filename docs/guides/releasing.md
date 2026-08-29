# Releasing SignalTree

> Added with the release-pipeline hardening (v12 audit intake, 2026-07-24).
> The sanctioned publish path is **CI** (`.github/workflows/publish.yml`);
> `scripts/release.sh` remains for emergencies only.

## Sanctioned path: publish from CI

1. Land the release on `main`: version bumps in all `package.json`s
   (`node tools/generate-version-env.cjs` for the demo constants) and a
   `## <version> (YYYY-MM-DD)` CHANGELOG heading — the changelog gate blocks
   otherwise.
2. Create and push a **signed** tag for the exact commit: `git tag -s -m "Release vX.Y.Z" vX.Y.Z && git push origin vX.Y.Z`.
3. The tag push runs `release.yml`, which first **verifies the tagged
   commit** (frozen install, lint budget, typecheck, tests, builds,
   built-barrel resolution, README/API checks, version-claims,
   tarball-consumer and publish-artifact gates, changelog entry) and only then creates the GitHub
   release.
4. Actions → "Publish to npm (CI)" → Run workflow with the tag. This runs
   `publish.yml`, which **reruns the same full gate set against the tag**,
   builds production, and publishes all **3** publishable packages through npm
   trusted publishing (`scripts/ci-publish.sh`, provenance enabled). Re-runs are safe:
   already-published versions are skipped. (Note: releases created by
   `release.yml` do not auto-trigger `publish.yml` — `GITHUB_TOKEN` events
   never trigger other workflows — so the dispatch step is deliberate.)

## Owner setup (one-time)

- **npm trusted publishing** — for each publishable package, configure npm →
  Package → Settings → Trusted publishing with GitHub Actions, repository
  `JBorgia/signal-tree`, workflow filename `publish.yml`, and allowed action
  `npm publish`.
- **Tag protection** — Settings → Rules → Rulesets: a tag ruleset for `v*`
  restricting creation to the owner.
- **Required check** — branch protection on `main` requiring the
  `Validate` workflow, so only gated commits can become tags. The publish
  workflow's own `verify` job is the last line regardless.

## Emergency path: local release.sh

`./scripts/release.sh [major|minor|patch] [skip-tests]` still performs the
full local flow (validate → bump → build → changelog gate → signed tag →
publish → push).

- `skip-tests` **no longer bypasses validation**: it sets `FAST_VALIDATE=1`,
  which skips only unit tests, coverage, and benchmarks. All correctness
  gates (builds, barrel + export parity, tarball-consumer, README/API checks,
  version-claims, size, release-state, package hygiene)
  still run and still block. There is no flag that skips them.
- `npm run publish:all` now runs the full `npm run validate` suite first —
  no publish path dodges the gates.

### What the emergency path costs you

**Provenance.** `publish.yml` grants `id-token: write`, installs npm CLI
11.5.1+, and `ci-publish.sh` publishes without `NPM_TOKEN` on GitHub Actions so
npm can exchange the workflow OIDC identity for a short-lived trusted-publisher
credential. A local emergency publish can still use `NPM_TOKEN`, but it produces
no trusted-publishing attestation and that cannot be added to the version later.

The rest of the safety still survives: `ci-publish.sh` is the same script CI
runs, resolves the `workspace:*` specs npm will not rewrite, verifies every
declared `files` entry, checks tarball hygiene, and derives the dist-tag from
the version string rather than letting `npm publish` default a prerelease onto
`latest`.

### Tags are required, not optional

`release-claims` diffs the public API against the last **stable** version tag,
so the checkout must have tags. `validate.yml` and `publish.yml` both use
`fetch-depth: 0` with `fetch-tags: true`. Without them the gate exits 1 with
"No prior version tag found" — a failure that reproduces on no developer machine,
which is how it went unnoticed while `Validate` sat red for twelve consecutive
commits.
