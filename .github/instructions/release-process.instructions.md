---
applyTo: '**'
---

# SignalTree Release Process

- Never run `nx release`, `npm version`, or package-local `npm publish`.
- Prepare versions and signed tags only through `npm run release:rc`,
  `release:patch`, `release:minor`, or `release:major`.
- `scripts/prepare-release.mjs` must remain incapable of npm publication.
- Registry publication must route through `scripts/publish-candidate.mjs`.
- Tagged CI is the sanctioned publisher and must validate and publish from one
  checkout and one build.
- The canonical ordered package set is `scripts/release-plan.mjs`.
- Resolve workspace dependency specifications only after the final build.
- Before the first registry write, validate artifact entries, tarball hygiene,
  runtime JSDoc stripping, declaration documentation, strict root and adapter
  consumer types, and tarball resolution.
- A rerun may skip an existing package version only when registry integrity
  equals candidate integrity. Any mismatch or lookup failure must abort.
- Never commit npm tokens. CI uses trusted publishing; local token fallback must
  use temporary ignored configuration removed on exit.
- Do not publish, tag, or push unless the user explicitly authorizes an official
  release operation.
