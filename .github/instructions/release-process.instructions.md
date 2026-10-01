---
applyTo: 'scripts/*release*,scripts/*publish*,.github/workflows/*release*,.github/workflows/*publish*,packages/**/package.json'
---

# Release routing

Read [RELEASE-CURRENT.md](../../RELEASE-CURRENT.md) for the active candidate and
[RELEASE_PROCESS.md](../../RELEASE_PROCESS.md) for the canonical procedure.
The ordered public package set is `scripts/release-plan.mjs`; do not maintain a
second list. `scripts/prepare-release.mjs` cannot publish to npm;
`scripts/publish-candidate.mjs` is the sole registry publisher.

Never use `nx release`, `npm version` or package-local `npm publish` to bypass
that path. Tagged CI validates and publishes the same candidate artifacts.
A registry version can be skipped only when its integrity matches the candidate;
lookup failure or mismatch aborts. Never commit credentials.

User authorization for publication, tagging and pushing is separate from passing
validation. See [the exact-artifact checks](../VALIDATION_GUIDE.md).
