# Release Process

SignalTree separates release preparation from npm publication.

## Prepare A Release

These commands change versions, create a commit, sign a tag and push. They
require explicit release authorization; they are not exact-candidate verification
commands. For verification only, follow [.github/VALIDATION_GUIDE.md](.github/VALIDATION_GUIDE.md).

Choose **one** preparation operation from a clean branch that exactly matches
its remote:

```bash
pnpm run release:rc
pnpm run release:minor-rc
pnpm run release:patch
pnpm run release:minor
pnpm run release:major
```

`release:minor-rc` starts an additive minor candidate from a stable version
(for example, `15.0.0` → `15.1.0-rc.1`). Use `release:rc` to advance
an active candidate. Prereleases use the npm `rc` channel.

`scripts/prepare-release.mjs`:

1. verifies the clean synchronized branch and canonical package set;
2. updates workspace and package versions;
3. updates generated demo versions and finalizes the changelog;
4. runs every ordinary and release-only gate;
5. commits the release preparation;
6. creates and validates the exact candidate tarballs;
7. creates and verifies a signed `v<version>` tag;
8. pushes the branch and tag.

It does not publish to npm. Failures before the release commit restore every
release-owned file. Failures after the commit leave local state intact for
deliberate recovery.

## Publish A Tagged Candidate

The sanctioned registry path is `.github/workflows/publish.yml`. It checks out
the tagged commit, installs dependencies, builds, runs the release matrix and
mutation self-tests, then deletes/rebuilds `dist` without cache and verifies the
fresh tarball consumers. Only after that does it call:

```bash
node scripts/publish-candidate.mjs --ci --prebuilt
```

The engine prepares manifests, runs package/declaration/consumer checks, packs
the ordered public artifacts from `scripts/release-plan.mjs`, records SHA-512
integrity, and publishes those tarballs with provenance. A rerun skips an
existing version only when registry integrity matches exactly; any mismatch or
registry lookup failure aborts.

Exercise packaging and consumer checks without registry writes:

```bash
pnpm run publish:dry-run
```


This is not full release verification. Run the full gate registry and mutation
proofs separately under the validation guide; a packaging dry run does not
reproduce the tagged CI environment or establish exact-release qualification.

Do not run `nx release`, `npm version`, or package-local `npm publish`.

## Signing Setup

Release tags must be signed and locally verifiable. Configure either GPG or SSH
signing with Git, then verify the setup in a throwaway repository before release
preparation. For SSH signing, configure `gpg.format=ssh`, `user.signingkey`, and
`gpg.ssh.allowedSignersFile`.

## After Publication

Verify every npm version and dist-tag in `scripts/release-plan.mjs`, install
those exact versions into a fresh external project, confirm runtime and strict
typechecking, then create or
verify the GitHub release notes. Never unpublish a partial release as routine
recovery; inspect candidate and registry integrity and resume the same version.
