import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

import {
  CodeTabsComponent,
  type CodeFile,
} from '../../examples/shared/components/example-shell';

interface HomeLinkCard {
  title: string;
  description: string;
  route: string;
  cta: string;
  queryParams?: Record<string, string>;
}

interface HomeCta {
  label: string;
  route: string;
  variant: 'primary' | 'secondary' | 'ghost';
}

interface FitItem {
  title: string;
  items: string[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterModule, CodeTabsComponent],
  templateUrl: './home.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly primaryCtas: HomeCta[] = [
    {
      label: 'Take the 5-minute tour',
      route: '/start',
      variant: 'primary',
    },
    {
      label: 'Read the docs',
      route: '/docs',
      variant: 'secondary',
    },
    {
      label: 'See benchmarks',
      route: '/benchmarks',
      variant: 'ghost',
    },
  ];

  readonly evaluationCards: HomeLinkCard[] = [
    {
      title: 'Learn the model',
      description:
        'Start with the fundamentals page to see how SignalTree models nested state as data, not reducers and selectors.',
      route: '/examples/fundamentals',
      cta: 'Open fundamentals →',
    },
    {
      title: 'Check the architecture',
      description:
        'See the recommended “one runtime tree, typed slices, root-level enhancers” architecture in context.',
      route: '/examples/fundamentals/recommended-architecture',
      cta: 'View recommended architecture →',
    },
    {
      title: 'Read package docs',
      description:
        'Browse the Angular realization, framework-neutral kernel, and React observation packages.',
      route: '/docs',
      cta: 'Browse documentation →',
    },
    {
      title: 'Inspect proof points',
      description:
        'Use benchmarks, DevTools, and bundle visualisation as proof—not as the first thing you have to believe.',
      route: '/benchmarks',
      cta: 'Review benchmarks →',
    },
    {
      title: 'Migrating from another store?',
      description:
        'Concept maps and side-by-side examples for @ngrx/signals, classic NgRx, NGXS, Elf/Akita, ComponentStore, @rx-angular/state, and BehaviorSubject services — plus an AI-assistable playbook.',
      route: '/migrate',
      cta: 'Open migration guide →',
    },
  ];

  readonly packageCards: HomeLinkCard[] = [
    {
      title: '@signal-tree/angular',
      description:
        'Angular-native construction, signals, dependency injection, and lifecycle.',
      route: '/docs',
      cta: 'Read Angular docs →',
      queryParams: { package: 'angular' },
    },
    {
      title: '@signal-tree/kernel',
      description: 'Framework-neutral state and causal semantics.',
      route: '/docs',
      cta: 'Read kernel docs →',
      queryParams: { package: 'kernel' },
    },
    {
      title: '@signal-tree/react',
      description: 'Owner-bound React observation.',
      route: '/docs',
      cta: 'Read React docs →',
      queryParams: { package: 'react' },
    },
  ];

  readonly proofCards: HomeLinkCard[] = [
    {
      title: 'DevTools',
      description:
        'Inspect state changes, path-based actions, and time-travel support through the Redux DevTools integration.',
      route: '/devtools',
      cta: 'Open DevTools demo →',
    },
    {
      title: 'Benchmarks',
      description:
        'Compare SignalTree against other Angular state approaches, with current version metadata shown in the UI and methodology visible in the app.',
      route: '/benchmarks',
      cta: 'Review benchmarks →',
    },

    {
      title: 'Extreme Depth',
      description:
        'Stress-test deep typing and path access to see where SignalTree’s model remains readable and precise.',
      route: '/extreme-depth',
      cta: 'See deep typing demo →',
    },
  ];

  readonly advancedRoutes: HomeLinkCard[] = [
    {
      title: 'Removed async marker archive',
      description:
        'The old async marker page is retained as an RC tombstone so the demo does not advertise removed public APIs.',
      route: '/async',
      cta: 'View archive →',
    },
    {
      title: 'Serialization',
      description: 'Export and import state with explicit serialization.',
      route: '/serialization',
      cta: 'Explore serialization →',
    },
  ];

  readonly coreFeatures = [
    {
      name: 'State stays data-shaped',
      description:
        'Model nested state as plain data, then let SignalTree layer reactivity on top.',
      highlight: true,
    },
    {
      name: 'Dot-notation access',
      description:
        '`tree.$.user.profile.name()` stays direct, type-safe, and IDE-discoverable.',
    },
    {
      name: 'One runtime tree',
      description:
        'The recommended architecture is one runtime tree with typed slices and root-level enhancers.',
    },
    {
      name: 'Invisible reactivity',
      description:
        'Think in data paths instead of subscriptions and state-management ceremony.',
    },
    {
      name: 'Optional power, not required ceremony',
      description:
        'Add DevTools, restoration, serialization, or forms only when you need them.',
      highlight: true,
    },
    {
      name: 'Proof you can inspect',
      description:
        'Benchmarks, DevTools, and bundle tooling support evaluation instead of replacing it.',
    },
  ];

  readonly fitGuidance: FitItem[] = [
    {
      title: 'Great fit for',
      items: [
        'Angular apps with deep or evolving nested state',
        'Teams that want state to look like data, not framework ceremony',
        'Apps that benefit from root-level DevTools, restoration, serialization, and entity maps',
      ],
    },
    {
      title: 'Probably not the point',
      items: [
        'Very small apps with shallow local state only',
        'Teams that explicitly want action/reducer workflows as the primary abstraction',
        'Use cases where the benchmark story matters more than the day-to-day modeling ergonomics',
      ],
    },
  ];

  readonly quickStartCode: CodeFile[] = [
    {
      label: 'install.sh',
      language: 'bash',
      source: `# Install the Angular realization
    npm install @signal-tree/angular@15.0.0-rc.1
`,
    },
    {
      label: 'quick-start.ts',
      language: 'typescript',
      source: `// Create one root tree for app state
import {
  signalTree,
  batching,
  devTools,
  restoration
} from '@signal-tree/angular';

const appTree = signalTree({
  user: {
    profile: {
      name: 'Ada Lovelace',
      email: 'ada@example.com'
    }
  },
  settings: {
    theme: 'dark' as 'dark' | 'light',
    notifications: true
  },
  cart: {
    items: [] as Array<{ id: string; quantity: number }>
  }
}, { enhancers: [batching(), devTools({ name: 'App State' }), restoration()] });

// Read nested values directly
console.log(appTree.$.user.profile.name());
console.log(appTree.$.settings.theme());

// Write individual leaves
appTree.$.user.profile.name.set('Grace Hopper');
appTree.$.settings.theme.set('light');

// Update with one root-level operation when needed
appTree.$((current) => ({
  ...current,
  cart: {
    ...current.cart,
    items: [...current.cart.items, { id: 'book-1', quantity: 1 }]
  }
}));

// Read the full unwrapped snapshot
const snapshot = appTree.$();`,
    },
  ];

  readonly beforeCode: CodeFile[] = [
    {
      label: 'before.ts',
      language: 'typescript',
      source: `// Typical nested-state ceremony
const displayName = selectUserDisplayName(state);

dispatch(updateUserProfile({
  id: userId,
  changes: { name: 'Grace Hopper' }
}));`,
    },
  ];

  readonly afterCode: CodeFile[] = [
    {
      label: 'after.ts',
      language: 'typescript',
      source: `// SignalTree
const displayName = appTree.$.user.profile.name();

appTree.$.user.profile.name.set('Grace Hopper');`,
    },
  ];

  readonly extremeDepthCode: CodeFile[] = [
    {
      label: 'extreme-depth.ts',
      language: 'typescript',
      source: `import { signalTree } from '@signal-tree/angular';

// Deep nested state with strong type inference
const extremeDepth = signalTree({
  enterprise: {
    divisions: {
      technology: {
        departments: {
          engineering: {
            teams: {
              frontend: {
                projects: {
                  signaltree: {
                    releases: {
                      v1: {
                        features: {
                          recursiveTyping: {
                            validation: {
                              tests: {
                                extreme: {
                                  status: 'passing',
                                  depth: 15,
                                  performance: 'sub-millisecond'
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
});

// Type inference still holds at this depth
const status = extremeDepth.$.enterprise.divisions.technology
  .departments.engineering.teams.frontend.projects.signaltree
  .releases.v1.features.recursiveTyping.validation.tests
  .extreme.status(); // TypeScript knows this is a string signal

// Update at extreme depth with full type safety
extremeDepth.$.enterprise.divisions.technology.departments
  .engineering.teams.frontend.projects.signaltree.releases.v1
  .features.recursiveTyping.validation.tests.extreme.depth.set(20);`,
    },
  ];
}
