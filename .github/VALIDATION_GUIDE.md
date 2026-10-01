# Release validation

The active candidate and scope are recorded in [RELEASE-CURRENT.md](../RELEASE-CURRENT.md).
A version in `package.json` is not evidence of publication. The canonical gate registry is
[`tools/verify-gates.mjs`](../tools/verify-gates.mjs); the public package set and
build order come from [`scripts/release-plan.mjs`](../scripts/release-plan.mjs).
Use those sources rather than a copied gate count or package inventory.

## Verify the candidate

Use the repository's Node version and pnpm version, a frozen lockfile install,
and Playwright Chromium for browser checks. Run from the intended checkout;
`NX_WORKSPACE_ROOT_PATH` must not point to another checkout.

Run these steps **serially**, with no concurrent edits, builds, gate runs, or
artifact readers during mutation self-tests:

1. Run the full registry, including release-only measurements:

   ```bash
   node tools/verify-gates.mjs --release
   ```

   The runner builds packages when selected gates consume `dist/`. It covers
   source and typing checks, package/demo tests, lint budgets, public API and
   documentation checks, package artifacts, consumer checks, bundle budgets,
   and release-only performance/memory harnesses. Use `--list` to inspect the
   actual registry. `--fast` or a partial `--only` run is not release sign-off.

2. Prove the gates can reject their seeded defects:

   ```bash
   node tools/verify-gates.mjs --self-test --release
   ```

   This temporarily mutates files and restores them, verifying restoration by
   hash. Inspect failures and any unproven or vacuous coverage in the summary;
   an ordinary green run alone does not establish that a gate can fail.

3. After all mutations finish, delete the generated `dist/` directory from
   the repository root, then rebuild from restored source before the final
   artifact checks. `dist/` is ignored output: a clean Git status and ordinary
   `git clean` do not prove that mutation residue is absent.

   ```bash
   rm -rf -- dist/
   pnpm run build:all --skip-nx-cache
   node tools/verify-tarball-consumer.mjs
   node tools/verify-consumer-typecheck.mjs
   node tools/verify-angular-aot-consumer.mjs
   ```

   Tarball resolution is not enough: strict consumers compile with
   `skipLibCheck: false` under `bundler` and `node16`. The Angular consumer
   installs tarballs, builds production AOT, and runs in Chromium without a
   runtime compiler. Do not reuse output from a failed or interrupted mutation
   run. Re-run affected artifact gates after any source or build change.

4. Validate the production demo and its served routes:

   ```bash
   pnpm nx build demo --configuration=production
   pnpm run smoke:routes
   ```

   The smoke suite serves the already-built demo and checks route resolution,
   rendered content, and browser errors. A package build or unit test pass does
   not establish that the production demo works.

5. Check version/release documentation and inspect the final checkout:

   ```bash
   node scripts/verify-version-claims.js
   node scripts/verify-release-state.js
   bash scripts/verify-changelog-entry.sh "$(node -p 'require("./package.json").version')"
   git diff --check
   git status --short
   git rev-parse HEAD
   ```

   An untagged candidate may remain unreleased. Release preparation finalizes
   its changelog and version metadata. Record commands, exits, limitations,
   and the exact source SHA. A dirty-tree result is development evidence, not
   proof of the final release commit: validate the exact committed/tagged SHA
   and candidate bytes used for publication. Later edits require corresponding
   revalidation.

## Coverage targets versus enforced gates

The historical documented targets are **80% statements, 75% branches,
80% functions, and 80% lines**. These percentages are **not currently enforced
by the canonical gate registry**. A green registry run must not be reported as
meeting them. Report a separate coverage run with its command, source SHA,
package scope, exclusions, and measured results; a kernel-only measurement is
not whole-workspace coverage. This guide records no current coverage result.

## Publication and recovery

Validation does not authorize pushing, tagging, merging, or publishing. Those
actions require explicit owner authorization. Release preparation and registry
publication have separate authorities; see [Release Process](../RELEASE_PROCESS.md).
Only the canonical [`scripts/publish-candidate.mjs`](../scripts/publish-candidate.mjs)
publisher may publish packages, through the authorized
[`publish.yml`](workflows/publish.yml) workflow for the exact tag/SHA. It records
candidate package order and integrity and verifies candidate artifacts; do not
substitute package-local `npm publish` or publish newly rebuilt, unverified bytes.

A failed check does not authorize a Git reset, tag deletion, or cleanup of
someone else's work. Inspect the failure and checkout, restore only known
mutation residue if necessary, rebuild, and repeat the relevant verification.
Release preparation's own recovery behavior is documented in the release
process; it is not a blanket automatic rollback of the working tree.
