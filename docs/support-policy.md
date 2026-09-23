<div align="center">
  <img src="../apps/demo/public/signaltree-mark-192.png" alt="SignalTree ST leaf mark" width="80" height="80" />
</div>

# SignalTree support policy

SignalTree currently has **two supported release lines under two independent npm
scopes**. Neither scope is an alias, a redirect, or a dist-tag bridge for the
other — the import specifiers are different packages.

| Line    | Scope            | License                    | Status                        |
| ------- | ---------------- | -------------------------- | ----------------------------- |
| **v15** | `@signal-tree/*` | Apache-2.0                 | **Active** — features + fixes |
| **v14** | `@signaltree/*`  | Apache-2.0 (from `14.1.2`) | **Maintenance** — fixes only  |

See the [release history](https://github.com/JBorgia/signal-tree/releases) and
[npm package listing](https://www.npmjs.com/org/signal-tree) for current published
versions.

`@signal-tree/*` v15 ships five packages: `@signal-tree/kernel`,
`@signal-tree/angular`, `@signal-tree/react`, `@signal-tree/vue`, and
`@signal-tree/solid`. The
`@signaltree/*` v14 line is the pre-reset multi-package surface
(`@signaltree/core`, `@signaltree/angular`, `@signaltree/ng-forms`,
`@signaltree/events`, and earlier standalone packages).

## Versioning commitment

**Starting with 15.2, SignalTree follows ordinary SemVer for its public API.**

- **PATCH** — fixes. No intentional public API breakage.
- **MINOR** — additive capabilities. No intentional public API breakage.
- **MAJOR** — breaking public API changes.
- A deprecated API gets a documented migration path before removal, except
  where keeping it would preserve a correctness or security defect. When that
  exception is used, the release notes say so explicitly and say why.

The public API is what the package barrels export. `@signal-tree/kernel/adapter`
and `@signal-tree/kernel/internals` are versioned the same way, but they are
seams for adapter authors and tooling rather than application surface.

### One recorded exception — 16.0.0

**16.0.0 removes `transaction()` without a deprecation cycle.** It is renamed to
`transact()`, and no alias ships.

The MAJOR rule is honoured: this is a breaking change in a MAJOR release. What
it skips is the _deprecate-then-remove_ path the bullet above implies. That is
stated here rather than left to a research note, because a policy contradicted
somewhere else is not a policy.

Why the owner chose it: SignalTree is early enough that carrying a known-wrong
public name purely for compatibility would create permanent surface debt, and
breaking outright makes every missed call site a compile error instead of a
silent deprecation warning. The migration is mechanical and total —
`tree.transaction(fn)` becomes `tree.transact(fn)`.

**This is a one-time reset, not a loosening of the rule.** From 16.0.0 the
corrected surface is the compatibility baseline and the deprecation path above
applies normally. Full reasoning:
[`docs/research/api-breaking-reset-0.md`](research/api-breaking-reset-0.md).

This commitment is new, and it is a response to a real history. Earlier
releases did not behave this way: 14.0.0 was deprecated within about a day,
14.1.0 shipped a packaging defect that was superseded immediately, and 15.0.0
carried a long RC tail. A MINOR once carried a BREAKING section because the
prior version had been deprecated. That is not a pattern to repeat, and the
gates built in response — mutation-tested release gates, packed-tarball install
verification under real export conditions — now run on the exact tagged commit
before anything reaches npm.

### The scope rename

`@signaltree/*` → `@signal-tree/*` is **complete**. `@signal-tree/*` is the
stable namespace going forward. The old scope remains only as the v14
maintenance line described above; it is not an alias and will not become one.

## Framework support and maturity

Every supported framework passes the same semantic conformance suite — that is
what "supported" means here. It does not mean every adapter is equally
exercised or equally characterized.

| Framework | Status    | Realization                | Characterization                               |
| --------- | --------- | -------------------------- | ---------------------------------------------- |
| Angular   | Supported | Native signals             | Most established adapter; memory characterized |
| Vue       | Supported | Native refs                | Memory characterized                           |
| React     | Supported | External-store integration | Memory characterized                           |
| Solid     | Supported | Native signals             | New in 15.2; memory not yet characterized      |

React integrates through an external store rather than a native per-field
primitive, because that is React's own model — it is a different physical
shape, deliberately, not a lesser one.

### The cost of specializing per framework

Specializing per framework produces more adapter code than one
lowest-common-denominator abstraction would. SignalTree accepts that
maintenance cost to keep each framework's own behaviour intact.

A framework stays supported only while its adapter passes the shared semantic
conformance suite and the packed-consumer gates against its declared peer
range. If an adapter cannot be kept passing as a framework's reactivity
evolves, its support status changes here rather than degrading silently.

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
