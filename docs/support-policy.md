<div align="center">
  <img src="../apps/demo/public/signaltree-mark-192.png" alt="SignalTree ST leaf mark" width="80" height="80" />
</div>

# SignalTree support policy

SignalTree currently has **two supported release lines under two independent npm
scopes**. Neither scope is an alias, a redirect, or a dist-tag bridge for the
other — the import specifiers are different packages.

| Line    | Scope             | npm `latest` | License                      | Status                         |
| ------- | ----------------- | ------------ | ---------------------------- | ------------------------------ |
| **v15** | `@signal-tree/*`  | `15.0.0`     | Apache-2.0                   | **Active** — features + fixes  |
| **v14** | `@signaltree/*`   | `14.1.3`     | Apache-2.0 (from `14.1.2`)   | **Maintenance** — fixes only   |

`@signal-tree/*` v15 ships four packages: `@signal-tree/kernel`,
`@signal-tree/angular`, `@signal-tree/react`, `@signal-tree/vue`. The
`@signaltree/*` v14 line is the pre-reset multi-package surface
(`@signaltree/core`, `@signaltree/angular`, `@signaltree/ng-forms`,
`@signaltree/events`, and earlier standalone packages).

## What the v14 line receives

- **Bug fixes** for defects reproducible against the latest `14.1.x`.
- **Security fixes.**
- Published as `14.1.x` patch releases on the `@signaltree/*` scope.

## What the v14 line does not receive

- New features, new APIs, or new capability packages.
- Backports of v15 architecture (framework-native carriers, the kernel/adapter
  split, the four-package consolidation).
- Support for Angular versions newer than its existing `peerDependencies` range,
  beyond what is required for a security fix.

## End of life

No EOL date is set. When one is chosen it will be announced in `CHANGELOG.md`,
the GitHub releases, and this page with at least **6 months** notice. Until then,
staying on v14 is a supported choice — you are not racing a deadline.

## Pinning

```bash
# v14 (maintenance line)
npm install @signaltree/core@^14.1
npm install @signaltree/core@v14      # dist-tag tracking the newest 14.x

# v15 (active line)
npm install @signal-tree/angular      # or @signal-tree/react / vue / kernel
```

## Reporting an issue

File it at <https://github.com/JBorgia/signal-tree/issues> and **state the
version and scope** (`@signaltree/core@14.1.3` vs `@signal-tree/kernel@15.0.0`).
A defect that reproduces on both lines is fixed on v15 first, then assessed for a
v14 backport.

## Moving to v15

When you are ready, see
[Migration `@signaltree/*` → `@signal-tree/*` (v15)](guides/migration-v14-v15.md).
It is the single migration target for every earlier version; the historical
inter-version guides under [`legacy/`](legacy/README.md) are kept for provenance.
