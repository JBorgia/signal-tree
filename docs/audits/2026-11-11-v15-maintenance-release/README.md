# v15 maintenance release

The owner authorized publication on November 11, 2026, before the separate
automated application comparison. Preparation starts from
`197baa287d12319558886e2298b34ef963801d6f`; the runtime remains
`ef806bef2a71aa48709c2b4cad5e71d1ee359c2f`. The next unused patch is 15.4.5,
checked against remote tags and npm before preparation.

The [preceding qualification](../2026-11-10-v15-retention-followthrough/README.md)
contains the actual-resource retention controls, demand-sensitive allocation
tradeoff, full local normal/mutation registry, installed consumers, production
browser checks and bounded Linux retention/cleanup results. That record is not
a substitute for full tagged release CI on the final versioned candidate.

## Size disposition

Generating commands on the unchanged candidate:

```sh
pnpm run build:all --skip-nx-cache
node tools/check-bundle-budget.mjs
```

The own-code gzip fixture reports production/development bare 10.75/12.85 KB
and entities 24.63/27.49 KB. The entities production ceiling of 24.60 KB fails;
all other ceilings pass. This is a package fixture, not whole-application size.

The owner's existing direction weighs budgets against cost and feasibility and
now explicitly selects release of the qualified repairs. The production
entities ceiling is narrowly adjusted to 24.70 KB. Preserving the reviewed
retention fixes and lazy allocation is preferable to adding runtime changes
solely to recover roughly 30 gzip bytes. The original failure stays recorded.
This is a policy allowance, not a claimed optimization. Development/bare
ceilings and the oversized-artifact mutation proof remain unchanged.

The focused `version-claims`, `release-claims`, `doc-links` and `bundle-budget`
gates pass after this policy change. The canonical bundle-budget self-test
rejects its oversized mutation from that passing baseline and restores the
artifact. A temporary repository using the actual SSH-signing configuration
successfully signs and verifies a throwaway tag. The initial temporary check
omitted the repository-local SSH configuration and attempted unavailable GPG;
that setup failure is preserved separately.

## Release boundary

Changelog preparation normalizes the supported `Unreleased` heading and removes
review-only wording. The documentation index avoids duplicating a version that
the canonical release script does not update. No runtime/public API change is
introduced during publication preparation.

Final versioned qualification, signed tag, tagged CI, registry publication and
fresh registry-consumer verification are pending. Subsequent raw logs remain
outside the frozen source and final receipts will identify exact commits,
artifact hashes and commands. Neither a local version bump nor this record is
evidence of publication.

## Tagged runner compatibility

Canonical preparation passed all 91 ordinary/release gates, validated the five
candidate archives and pushed signed tag `v15.4.5` at
`c207c8e844a1782d055e46e9c4200641453e2eb8`.
[The first tagged release run](https://github.com/JBorgia/signal-tree/actions/runs/43029632736)
failed before tests: `ubuntu-latest` selected Ubuntu 26.04, which locked
Playwright 1.56.1 cannot install Chromium dependencies on. Its bundled
`nativeDeps.js` explicitly supports Ubuntu 24.04.

The isolated `codex/v15-release-ci` control branch pins the release and publisher
jobs to Ubuntu 24.04. Manual dispatch uses this workflow definition while its
existing `release_tag` checkout still selects the immutable signed v15.4.5
source. No runtime, artifact content, gate or signature requirement changes,
and the failed run and original signed tag remain intact. Full tagged-source
validation and publication receipts remain required.
