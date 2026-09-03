import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./components/home/home.component').then((c) => c.HomeComponent),
  },

  // Opinionated 5-minute evaluation path
  {
    path: 'start',
    loadComponent: () =>
      import('./pages/start-here/start-here.component').then(
        (c) => c.StartHereComponent
      ),
    data: {
      title: 'Start here · 5-minute tour',
      description:
        'Evaluate SignalTree in five minutes: the mental model, a side-by-side comparison with NgRx, the recommended architecture, and where to go next.',
    },
  },

  {
    path: 'whats-new-14',
    redirectTo: 'legacy-changelog',
    pathMatch: 'full',
  },
  {
    path: 'does-it-fit',
    redirectTo: 'architecture-overview',
    pathMatch: 'full',
  },

  // =========================================================================
  // V7 Feature Demos
  // =========================================================================
  {
    path: 'stored-versioning',
    redirectTo: 'docs',
    pathMatch: 'full',
  },
  {
    path: 'external-truth',
    loadComponent: () =>
      import(
        './examples/features/fundamentals/examples/async/async-demo.component'
      ).then((c) => c.AsyncDemoComponent),
    data: {
      title: 'External truth & Link',
      description:
        'One-shot external ingress, persistent endpoint relationships through Link, and application-owned request policy.',
    },
  },
  {
    path: 'async',
    redirectTo: 'external-truth',
    pathMatch: 'full',
  },
  {
    path: 'marker-zoo',
    redirectTo: 'markers',
    pathMatch: 'full',
  },
  {
    path: 'entity-collection',
    redirectTo: 'entities',
    pathMatch: 'full',
  },
  {
    path: 'benchmark',
    redirectTo: 'benchmarks',
    pathMatch: 'full',
  },
  // rxMethod was removed; application orchestration now lands resolved truth
  // through external() or maintains an ongoing relationship through Link.
  {
    path: 'rxmethod',
    redirectTo: 'external-truth',
    pathMatch: 'full',
  },

  // Fundamentals examples page (embedded demos on one page)
  {
    path: 'examples/fundamentals',
    loadComponent: () =>
      import(
        './examples/features/fundamentals/pages/fundamentals-page/fundamentals-page.component'
      ).then((c) => c.FundamentalsPageComponent),
    data: {
      title: 'Fundamentals',
      description:
        'Working playground for SignalTree construction, derived state, transactions, restoration, and EntityMap collections.',
    },
  },

  // Redirect old core route to new examples
  {
    path: 'core',
    redirectTo: '/examples/fundamentals',
    pathMatch: 'full',
  },

  // Redirect examples root to fundamentals
  { path: 'examples', redirectTo: '/examples/fundamentals', pathMatch: 'full' },

  // Core SignalTree modules - now under examples/features
  {
    path: 'batching',
    loadComponent: () =>
      import(
        './examples/features/fundamentals/examples/enhancers/batching-demo/batching-demo.component'
      ).then((c) => c.BatchingDemoComponent),
    data: {
      title: 'Batching — coherent publication',
      description:
        'Three synchronous writes compared across separate and grouped framework publication boundaries.',
    },
  },
  {
    path: 'batching/compare',
    redirectTo: 'batching',
    pathMatch: 'full',
  },
  {
    path: 'entities',
    loadComponent: () =>
      import(
        './examples/features/fundamentals/examples/entities/entities-demo.component'
      ).then((c) => c.EntitiesDemoComponent),
    data: {
      title: 'EntityMap',
      description:
        'Normalized keyed identity, stable ordinary-update handles, reactive queries, and structural mutation boundaries.',
    },
  },
  {
    path: 'entity-sort-comparer',
    loadComponent: () =>
      import(
        './examples/features/fundamentals/examples/entity-sort-comparer/entity-sort-comparer-demo.component'
      ).then((c) => c.EntitySortComparerDemoComponent),
  },
  {
    path: 'granular-reactivity',
    loadComponent: () =>
      import(
        './examples/features/fundamentals/examples/granular-reactivity/granular-reactivity-demo.component'
      ).then((c) => c.GranularReactivityDemoComponent),
  },
  {
    path: 'linked-derived',
    redirectTo: 'examples/fundamentals',
    pathMatch: 'full',
  },
  {
    path: 'serialization',
    redirectTo: 'docs',
    pathMatch: 'full',
  },
  {
    path: 'restoration',
    loadComponent: () =>
      import(
        './examples/features/fundamentals/examples/restoration/restoration-demo.component'
      ).then((c) => c.RestorationDemoComponent),
  },
  {
    path: 'markers',
    loadComponent: () =>
      import(
        './examples/features/fundamentals/examples/markers/markers-demo.component'
      ).then((c) => c.MarkersDemoComponent),
  },
  {
    path: 'devtools',
    loadComponent: () =>
      import(
        './examples/features/fundamentals/examples/enhancers/devtools-demo/devtools-demo.component'
      ).then((c) => c.DevtoolsDemoComponent),
  },
  {
    path: 'examples/fundamentals/recommended-architecture',
    loadComponent: () =>
      import(
        './examples/features/fundamentals/examples/recommended-architecture/recommended-architecture.component'
      ).then((c) => c.RecommendedArchitectureComponent),
    data: {
      title: 'Recommended architecture',
      description:
        'The recommended SignalTree pattern: one runtime tree, typed feature slices, and root-level enhancers.',
    },
  },
  {
    // Canonical lives at /migrate (shorter, more discoverable).
    // Keep this path as a 301 redirect to avoid duplicate content / split SEO weight.
    path: 'examples/fundamentals/migration-recipe',
    redirectTo: '/migrate',
    pathMatch: 'full',
  },
  // Top-level alias for the multi-source migration guide
  {
    path: 'migrate',
    loadComponent: () =>
      import('./pages/migration-recipe/migration-recipe.component').then(
        (c) => c.MigrationRecipeComponent
      ),
    data: {
      title: 'Migrate from NgRx',
      description:
        'How to migrate an NgRx codebase to SignalTree: actions become setters, reducers become updates, selectors become computed signals.',
    },
  },
  // Performance comparisons
  {
    path: 'benchmarks',
    loadComponent: () =>
      import('./pages/benchmarks/v15-benchmarks.component').then(
        (component) => component.V15BenchmarksComponent
      ),
    data: {
      title: 'Recurring application-state performance',
      description:
        'Checked point access, conditional complete projection, and restoration workloads across capability-matched state libraries.',
    },
  },
  // Redirect old route to new one
  {
    path: 'realistic-comparison',
    redirectTo: 'benchmarks',
    pathMatch: 'full',
  },

  // Existing pages
  {
    path: 'deep-typing',
    loadComponent: () =>
      import('./components/extreme-depth/extreme-depth.component').then(
        (c) => c.ExtremeDepthComponent
      ),
    data: {
      title: 'Deep typing',
      description:
        'A compile-backed exact writable leaf and runtime update through one declared 15-branch state path.',
    },
  },
  {
    path: 'extreme-depth',
    redirectTo: 'deep-typing',
    pathMatch: 'full',
  },
  {
    path: 'realistic-benchmark-history',
    loadComponent: () =>
      import(
        './pages/realistic-benchmark-history/realistic-benchmark-history.component'
      ).then((c) => c.RealisticBenchmarkHistoryComponent),
    data: {
      title: 'Benchmark history — archived pre-v15 submissions',
      description:
        'Submitted results from the retired realistic-comparison harness, preserved for provenance and not current performance guidance.',
    },
  },

  // Architecture overview (renamed from /architecture for clarity vs. /examples/.../recommended-architecture)
  {
    path: 'architecture-overview',
    loadComponent: () =>
      import(
        './pages/architecture-overview/architecture-overview.component'
      ).then((c) => c.ArchitectureOverviewComponent),
    data: {
      title: 'Architecture overview',
      description:
        'Verified SignalTree v15 ownership, state grammar, causal authority, operation coherence, entity identity, Link, and explanation boundaries.',
    },
  },
  // Backwards-compat redirect from the old path
  {
    path: 'architecture',
    redirectTo: 'architecture-overview',
    pathMatch: 'full',
  },
  // Bundle Visualizer removed — Architecture page covers bundle data
  // Undo/Redo removed — Time Travel demo covers this with richer UX

  // Pre-15 release history, split out of the "What's New" example
  {
    path: 'legacy-changelog',
    loadComponent: () =>
      import('./pages/legacy-changelog/legacy-changelog.component').then(
        (c) => c.LegacyChangelogComponent
      ),
    data: {
      title: 'Release history — v14.0.0 and earlier (@signaltree/*)',
      description:
        'Pre-15 SignalTree release history. Historical APIs, kept for provenance — not current guidance.',
    },
  },

  // Documentation
  {
    path: 'docs',
    loadComponent: () =>
      import('./pages/documentation/documentation.component').then(
        (c) => c.DocumentationComponent
      ),
    data: {
      title: 'Documentation',
      description:
        'SignalTree package documentation for the kernel, Angular, and React packages.',
    },
  },

  // Redirect any unknown routes to home
  {
    path: '**',
    redirectTo: '',
  },
];
