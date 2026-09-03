<div align="center">
  <img src="../apps/demo/public/signaltree-mark-192.png" alt="SignalTree ST leaf mark" width="80" height="80" />
</div>

# SignalTree Overview and Specifications

This document consolidates the feature overview and technical specifications for the SignalTree ecosystem.

## Release notes

Release notes live in [`CHANGELOG.md`](../CHANGELOG.md) — the single source of truth.
This page previously duplicated a "Latest release" list, which then sat at 7.6.0
while the packages shipped 13.x. Don't reintroduce it; link the changelog instead.

## Overview

- Causal transitions distinguish authored operations from external truth
- Coherent multi-location commits with stable entity identity and explicit authority
- Recursive typing with deep nesting and accurate type inference
- Compile-backed exact leaf typing through the declared 15-branch demo model
- Memory efficiency via proportional causal history and explicit ownership lifetimes
- Three focused packages with strong TypeScript support
- Extensible via the declared `enhancers` set

## Core capabilities

- Hierarchical signal trees with type-safe access and updates
- Framework-neutral causal semantics realized by Angular and React packages
- Deterministic resource release through `destroy()`
- Tree-shakeable: unused enhancers are eliminated by modern bundlers

## Package ecosystem

SignalTree 15 has three public packages:

- **`@signal-tree/kernel`**: framework-neutral state, EntityMap, links,
  restoration, batching, transactions, and DevTools
- **`@signal-tree/angular`**: Angular-native realization and `defineStore`
- **`@signal-tree/react`**: owner-bound React observation

## Technical specifications

- Angular 20, 21, or 22 (see `peerDependencies`), TypeScript 5.5+, Node 18.17+ (development)
- Browser: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Tree-shakeable, own code only, gzip (measured by
  `tools/check-bundle-budget.mjs`, esbuild + minify, Angular/RxJS external).
  Production budgets are 9.7 KB for a bare tree and 21.7 KB with EntityMap;
  development budgets are 11.9 KB and 24.4 KB. The generator reports current
  measured values and enforces both ceilings; see
  [dropping dev code](performance/dropping-dev-code.md).
- Performance targets: operations maintain sub‑millisecond times across common depths

### Operation latency by depth

Reproduce with `node tools/bench-depth-latency.mjs`. Median across 5 sweeps,
each 9 batches of 2,000 operations after a warm-up, on the built output.

| depth | root update through the chain |
| ----- | ----------------------------- |
| 5     | 0.0010 ms                     |
| 10    | 0.0019 ms                     |
| 15    | 0.0028 ms                     |
| 20    | 0.0038 ms                     |

**Read the shape, not the absolutes** — those are hardware-specific. Cost grows
**sublinearly in depth**: 4x the depth costs less than 4x the time, because a
write walks only the path it touches.

**No multiplier is quoted here, deliberately.** An earlier version of this
section said "~3.6x", and the table above it implied 4.8x — two numbers from two
different runs, presented as one fact. The ratio is two sub-microsecond
absolutes divided by each other, and it moves 3.2x-4.8x _within a single run_ of
the generator while the absolutes barely shift. That is the same instability the
ST2018 multiplier was deleted for; quoting a midpoint here would have repeated
the mistake one section after documenting it. The tool prints the spread.

A direct leaf write (`tree.$.a.b.c.set(v)`) does not walk the path at all and
measures at timer resolution, so the tool reports it but declines to quote it.

> Replaced a "Performance targets (Sept 2025)" table for 14.0.0. It claimed
> 0.041 / 0.061 / 0.092 / 0.104 ms at these depths and **nothing in the repo
> produced those figures** — the same defect as the publishable-size rows below.
> Worse, "operation" was never defined, and the two plausible readings differ by
> three orders of magnitude, so the claim could be neither verified nor
> falsified. Both were measured: every real figure is 10x-1000x SMALLER than
> what was published. The numbers understated the library, which is the
> forgiving direction, and were wrong all the same.

### Published package budgets

Run `node tools/check-bundle-budget.mjs` for the current measured values and
enforced ceilings. The tool bundles consumer-shaped entry points with production
and development definitions; raw `dist/` size is not a consumer bundle metric.

### Frequency weighting system

Performance benchmarks can weight each scenario by how often the maintainer judges that operation to occur:

- **Maintainer-estimated multipliers**: hand-chosen judgement calls, not survey findings — see [the disclosure](performance/frequency-weighting-system.md#where-these-numbers-come-from)
- **Neutral comparison available**: the `equal` preset sets every weight to 1.0, which is the setting to use when comparing libraries
- **Real-World Relevance**: Weighted results prioritize operations that apps actually use frequently
- **Comprehensive Analysis**: Reports ranking changes and weight impact alongside raw performance metrics

See [Frequency Weighting System Documentation](performance/frequency-weighting-system.md) for complete methodology and implementation details.

### Enhancers and composition

- Built-in capabilities are selected declaratively:
  `signalTree(state, { enhancers: [...] })`
- Metadata-driven ordering with `requires`/`provides`
- The low-level `Enhancer` function type remains public, but helper,
  dependency-metadata, and custom-marker authoring APIs do not ship in v15

## Integration notes

- Angular applications construct through `@signal-tree/angular`
- React applications observe through `@signal-tree/react`
- Other runtimes can realize the neutral `@signal-tree/kernel` contracts
- Applications own persistence, serialization, and SSR payload policy

---

Source materials consolidated from `FEATURES.md` and `SPECIFICATIONS.md`.
