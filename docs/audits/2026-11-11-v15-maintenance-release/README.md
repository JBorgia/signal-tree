# v15.4.8 published and registry-verified

Signed tag `v15.4.8` identifies `37ef1788f6bac61678fc312f391b180bd7a6bbd7`.
All five packages are on npm `latest`; their downloaded SHA-512 integrities
match the qualified candidate. Provenance binds the exact tag, commit, workflow,
publisher run and package subject. Fresh registry installation, all-five-facade
runtime checks, cryptographic signatures/attestations, strict `bundler`/`node16`
consumers and production Angular AOT pass. See [the exact receipt](v15.4.8-receipt.json).

Local preparation and exact tagged Linux verification passed all 91 normal gates
and all 91 mutation proofs, followed by clean rebuilds and installed consumers.
Local final demo smoke passed 146/146. Commands, artifact identities, raw-log
hashes and the retained earlier failures are in the receipt. Neither coverage
percentages nor unlimited retention boundedness are established by these checks.

- [Tagged Linux qualification](https://github.com/JBorgia/signal-tree/actions/runs/43051882864)
- [Canonical npm publisher](https://github.com/JBorgia/signal-tree/actions/runs/43054521673)
- [Published release notes](https://github.com/JBorgia/signal-tree/releases/tag/v15.4.8)

The initial registry read still omitted the kernel version after CI reported
publication. The four facades appeared first; kernel metadata subsequently
updated, and exact archive/consumer verification then passed. The original 404
and stale metadata remain evidence. This establishes observed visibility delay,
not a proven internal npm cache mechanism.

The exact-commit demo preview serves 15.4.8 and passes edit/server-update/undo.
**Production-demo promotion remains pending Vercel email identity verification.**
The email connector masks the one-time code; the owner has been asked to complete
Vercel's challenge. npm release completion is separate from live-site completion.

The release is the v15 retention and lazy entity-field maintenance update.
Transaction, observer-delivery and settlement behavior remain v15's. Fully
materialized rows retain extra getter/cache bookkeeping; no universal memory or
speed improvement is claimed. Superseded signed preparations 15.4.5–15.4.7 remain
intact and were never published to npm. The 15.4.6 GitHub entry is labeled accordingly.

---

## Preparation history


The owner authorized publication on November 11, 2026, before the separate
automated application comparison. Preparation starts from
`197baa287d12319558886e2298b34ef963801d6f`; the runtime remains
`ef806bef2a71aa48709c2b4cad5e71d1ee359c2f`. Initial patch 15.4.5 was checked
against remote tags and npm before preparation. It remains an unpublished,
superseded signed attempt. The subsequent 15.4.6 preparation also remains
unpublished after runner connectivity failures. The next candidate is 15.4.7
for the supported-container reasons below.

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

The isolated `codex/v15-release-ci` branch pins the release and publisher jobs
to Ubuntu 24.04. A proposed manual dispatch against the old tag was rejected
with HTTP 403 (repository administrator rights required), before any run was
created. Independent review also identified that npm's automatic provenance
uses the workflow ref/SHA, while the candidate journal uses checked-out git HEAD.
A control-branch dispatch against the old tag would therefore have two source
identities. Rather than overwrite environment claims or rewrite a signed tag,
prepare 15.4.6 with the runner fix included, and execute from that exact tag.
The failed run, signed 15.4.5 tag and prepared archives remain intact; no npm
publication of 15.4.5 occurred. Full exact-tag validation and registry verification
remain required. Runtime behavior and all gate/signature requirements are unchanged.

## Ubuntu DNS failure and supported-container successor

Signed `v15.4.6` at `d78dc2377ad8f6cfae77d89f925d73591455532a` passed
[full exact-tag release CI](https://github.com/JBorgia/signal-tree/actions/runs/43031952720):
91/91 ordinary/release gates and 91/91 mutation proofs (15 indirect, zero blind,
vacuous, unproven or errored), followed by clean rebuilds and installed consumers.
The GitHub release was created. All three attempts of
[its npm publisher](https://github.com/JBorgia/signal-tree/actions/runs/43035473289)
failed to acquire browser system dependencies because Ubuntu mirror hostnames
could not resolve. Attempt one was cancelled after preserving repeated DNS
errors; attempts two and three failed naturally. No attempt reached publication.

The [read-only runner diagnostic](https://github.com/JBorgia/signal-tree/actions/runs/43040810114)
attempted to resolve and fetch each mirror independently. Azure, archive.ubuntu.com and
security.ubuntu.com all failed DNS and bounded HTTPS transfer on that runner.
This disproves treating a different mirror alone as a demonstrated remedy.
A [separate supported-container probe](https://github.com/JBorgia/signal-tree/actions/runs/43042033281)
checked out unchanged `d78dc2377`, installed locked dependencies, asserted
Playwright 1.56.1, launched Chromium, built the packages and passed the existing
packed production Angular AOT consumer.

The official Playwright 1.56.1 Noble image supplies its browsers and system
libraries. Its registry index digest is
`sha256:f1e7e01021efd65dd1a2c56064be399f3e4de00fd021ac561325f2bfbb2b837a`.
The repository still installs its locked JavaScript dependency and verifies the
version match. This is a supported environment change, not omitted browser
verification. See the [versioned vendor Dockerfile](https://raw.githubusercontent.com/microsoft/playwright/v1.56.1/utils/docker/Dockerfile.noble).

The successor preparation is 15.4.7. Both verification/publisher jobs use that
pinned container; every normal gate, mutation proof, clean rebuild and consumer
check remains. New signed-tag qualification and registry receipts are required;
prior passes establish supporting evidence only. Runtime, lockfile and public
API are unchanged by this environment correction. No tag is rewritten.

## Container checkout ownership

Signed `v15.4.7` at `0b29a189798b65ba0a243da349036d5b1e1b7168` passed
91/91 local gates and 91/91 mutation proofs, followed by clean rebuilds,
strict packed consumers, production Angular AOT, the demo and all 146 browser
checks. All five rebuilt archives match the signed preparation's integrity.
[Tagged container CI](https://github.com/JBorgia/signal-tree/actions/runs/43045228144)
passed browser setup and package tests, but finished 85/91: four gates explicitly
reported Git's dubious-ownership rejection; two artifact wrappers failed their
initial source-HEAD command in the same environment. The shared ownership cause
for those two is an inference from source and execution order, pending the probe.

Checkout's action configured trust under a temporary HOME; ordinary container
steps use `/github/home`. The mounted checkout is owned by the host runner.
The successor adds only the exact `GITHUB_WORKSPACE` to that container user's
`safe.directory`, then checks HEAD against the selected tag. It does not trust
arbitrary directories or alter the checkout identity. The
[complete no-publication probe](https://github.com/JBorgia/signal-tree/actions/runs/43047329100)
uses immutable `0b29a1897`, full history, every normal/mutation gate, clean
consumers and canonical `--prepare-only` packaging. Its completion is required
before signing 15.4.8; focused environment feasibility is insufficient.

The 15.4.7 tag remains intact and unpublished. Runtime behavior, public API,
budgets and gates are unchanged by the checkout configuration repair.

Independent review found that comparing two inline Git substitutions could
accidentally accept two empty outputs after both commands failed. The successor
captures each `git rev-parse --verify` in a separate assignment before comparing,
so Bash's error handling stops on either failure. The shell control reproduced
the old false acceptance, rejected each failed lookup with the corrected form,
and accepted equal successful results. This correction precedes signed freeze.

The complete container probe passed: all normal gates, all mutation proofs,
clean rebuilds, strict tarball consumers, production Angular AOT and canonical
prepare-only packaging on immutable `0b29a1897`. All six formerly failing gates
now pass with the exact checkout trust configuration. This resolves the observed
environment cause; it does not substitute for fresh 15.4.8 tagged qualification
or registry verification. The raw run remains linked above.
