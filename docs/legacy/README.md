# Legacy documentation (`@signaltree/*`, pre-15)

Everything in this folder describes SignalTree **before the v15 package reset**,
when the packages were published under the unscoped-looking `@signaltree/*` name
(no hyphen) and split across `@signaltree/core`, `@signaltree/angular`,
`@signaltree/ng-forms`, `@signaltree/events`, `@signaltree/schema`,
`@signaltree/realtime`, `@signaltree/guardrails`, and earlier standalone
enhancer packages.

**None of this is current API guidance.** The `@signaltree/*` line stopped at
`14.1.1`. SignalTree 15 ships as `@signal-tree/kernel`, `@signal-tree/angular`,
and `@signal-tree/react`.

## If you are migrating

Go to **[`../guides/migration-v14-v15.md`](../guides/migration-v14-v15.md)** —
the single migration target for every earlier version. It covers the rename, the
consolidation to three packages, and every removed API. The per-version guides
below are kept only for the inter-version detail they carry.

## Contents

| File                                                         | Covers                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| [`MIGRATION-v4-v13.md`](MIGRATION-v4-v13.md)                 | v4.0.0 package consolidation into `@signaltree/core`, and the v4–v13 API history         |
| [`migration-v8-v9.md`](migration-v8-v9.md)                   | v8 → v9 removed exports; `memoization` and presets retired in 9.0.1                      |
| [`migration-v11-v12.md`](migration-v11-v12.md)               | v11 → v12 historical EntityMap loader option, deprecated-API sweep                       |
| [`migration-v12-v13.md`](migration-v12-v13.md)               | v12 → v13 RFC 0007 packaging re-slice, `history()`, events↔`entityMap`                   |
| [`migration-v13.2.md`](migration-v13.2.md)                   | 13.2 `signalForm()` `nativeErrors` default flip                                          |
| [`migration-v13-v14.md`](migration-v13-v14.md)               | 13.x → 14.0.0 breaking changes (callable-leaf removal, etc.)                             |
| [`migration-v14-v14.1.md`](migration-v14-v14.1.md)           | 14.0.0 → 14.1.1 renames/removals in a minor                                              |
| [`capability-matrix-14.0.0.md`](capability-matrix-14.0.0.md) | Audit (14.0.0) of competitor capabilities SignalTree lacked; some gaps have since closed |

## Still current, not moved

- [`../guides/migration-v14-v15.md`](../guides/migration-v14-v15.md) — the live migration bridge.
- [`../errors/README.md`](../errors/README.md) — keeps retired-diagnostic rows (`[ST1019]` → `@signaltree/enterprise`, etc.) so old logs stay greppable.
- [`../compare/real-implementations.md`](../compare/real-implementations.md) — benchmark provenance cited from kernel source; its `@signaltree/core` figures are measurement records.
