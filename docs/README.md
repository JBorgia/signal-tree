<div align="center">
  <img src="../apps/demo/public/signaltree.svg" alt="SignalTree Logo" width="80" height="80" style="background: transparent;" />
</div>

# SignalTree Documentation

Use this index to navigate the documentation.

**Current prerelease:** 15.0.0-rc.11 See [CHANGELOG](../CHANGELOG.md).

---

## 📚 Getting Started

| Document                            | Description                                         |
| ----------------------------------- | --------------------------------------------------- |
| [Overview](overview.md)             | High-level project overview and specifications      |
| [Root README](../README.md)         | Main project README                                 |
| [Repository Map](repository-map.md) | Source, validation, history, and artifact ownership |

---

## 🏗️ Architecture

| Document                                                            | Description                                                                                    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Architecture Guide](architecture/signaltree-architecture-guide.md) | Comprehensive patterns and decision frameworks (start with “Recommended Architecture (TL;DR)”) |

---

## 📖 Guides

| Document                                                           | Description                                               |
| ------------------------------------------------------------------ | --------------------------------------------------------- |
| [Migration `@signaltree/*` → `@signal-tree/*` (v15)](guides/migration-v14-v15.md) | **Current migration target for every earlier version** — rename, package consolidation, removed APIs |
| [Composition Recipes](guides/composition-recipes.md)              | Ops-service patterns, entity-CRUD base, optimistic UI     |
| [Legacy docs (`@signaltree/*`, pre-15)](legacy/README.md)          | Per-version migration guides and the 14.0.0 capability audit, quarantined |
| [Persistence and Security](guides/persistence-and-security.md)     | Withdrawn: its subject, the `stored()` marker, is deleted |
| [Typing Patterns](guides/typing-patterns.md)                       | Preferred TypeScript typing patterns                      |
| [Local Development Symlinks](guides/local-development-symlinks.md) | Troubleshooting dual Angular instance issues              |

---

## ⚡ Performance

| Document                                                    | Description                                  |
| ----------------------------------------------------------- | -------------------------------------------- |
| [Benchmarks](../tools/) — `bench-*.mjs`                     | Current performance figures, with generators |
| [Dropping dev code](performance/dropping-dev-code.md)       | What `ngDevMode: false` reclaims, measured   |
| [Bundle Optimization](performance/bundle-optimization.md)   | Bundle size optimization                     |
| [Performance Patterns](performance/performance-patterns.md) | Common performance patterns                  |
| [Hosting Guide](performance/performance-hosting-guide.md)   | Performance hosting considerations           |

---

## 📦 Package Documentation

| Document                                       | Description                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| [Kernel](../packages/kernel/README.md)         | `@signal-tree/kernel` — framework-neutral tree, EntityMap, enhancers  |
| [Angular](../packages/angular/README.md)       | `@signal-tree/angular` — the Angular realization (Angular apps use this) |
| [React](../packages/react/README.md)           | `@signal-tree/react` — owner-bound React observation (`useSignalTree`) |

Historical inter-version migration guides live in [Guides](#-guides); the
[v15 migration guide](guides/migration-v14-v15.md) is the current target.

---

## 🤖 AI/LLM References

| Document               | Description                       |
| ---------------------- | --------------------------------- |
| [LLM Guide](ai/LLM.md) | Quick reference for AI assistants |

---

## 🚀 Deployment

| Document                               | Description                 |
| -------------------------------------- | --------------------------- |
| [Production](deployment/production.md) | Production deployment guide |

---

## 📝 Learnings

| Document                                                                    | Description                                 |
| --------------------------------------------------------------------------- | ------------------------------------------- |
| [Events Improvement Grid](learnings/events-improvement-grid.md)             | Historical: planned improvements for the pre-15 `@signaltree/events` package (no v15 successor) |
| [Swapacado Migration Learnings](learnings/swapacado-migration-learnings.md) | Learnings from real-world integration       |

---

## 🗄️ Archive

Historical documents preserved for reference:

- [archive/](archive/) - Older implementation notes and proposals

---

## 🛠️ Development

| Document                                                                   | Description                  |
| -------------------------------------------------------------------------- | ---------------------------- |
| [Release Process](../.github/instructions/release-process.instructions.md) | How to release new versions  |
| [Validation Guide](../.github/VALIDATION_GUIDE.md)                         | Pre-release validation steps |
| [Scripts](../scripts/README.md)                                            | Build and utility scripts    |
