import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

import {
  SIGNALTREE_CORE_VERSION,
  SIGNALTREE_VERSION_SUMMARY,
} from '../../version';

export interface DemoExample {
  id: string;
  title: string;
  description: string;
  route: string;
  queryParams?: Record<string, string>;
  category: 'learn' | 'packages' | 'examples' | 'advanced' | 'benchmarks';
}

export interface ExternalLink {
  label: string;
  url: string;
  icon: string;
  title: string;
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './navigation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './navigation.component.scss',
})
export class NavigationComponent {
  readonly coreVersion: string;
  readonly versionSummary: string;
  readonly mobileMenuOpen = signal(false);

  constructor() {
    this.coreVersion = SIGNALTREE_CORE_VERSION;
    this.versionSummary = SIGNALTREE_VERSION_SUMMARY;
  }

  examples: DemoExample[] = [
    {
      id: 'whats-new-14',
      title: '14.0.0 retrospective',
      description: 'Historical release page; not current v15 API guidance',
      route: '/whats-new-14',
      category: 'learn',
    },
    {
      id: 'does-it-fit',
      title: 'Does SignalTree fit?',
      description:
        'The trade, measured both ways — where it wins, where it loses, and what each library provides',
      route: '/does-it-fit',
      category: 'learn',
    },
    {
      id: 'docs',
      title: 'Documentation',
      description: 'Browse package docs and READMEs',
      route: '/docs',
      category: 'learn',
    },
    {
      id: 'fundamentals',
      title: 'Fundamentals',
      description: 'Interactive core examples and mental model',
      route: '/examples/fundamentals',
      category: 'learn',
    },
    {
      id: 'recommended-architecture',
      title: 'Recommended Architecture',
      description: 'One runtime tree, typed slices, root-level enhancers',
      route: '/examples/fundamentals/recommended-architecture',
      category: 'learn',
    },
    {
      id: 'migration-recipe',
      title: 'Migration Recipe',
      description: 'Practical path from more ceremonial state patterns',
      route: '/examples/fundamentals/migration-recipe',
      category: 'learn',
    },
    {
      id: 'angular-package',
      title: 'Angular Package',
      description: 'Angular-native construction, DI, and lifecycle',
      route: '/docs',
      queryParams: { package: 'angular' },
      category: 'packages',
    },
    {
      id: 'kernel-package',
      title: 'Kernel Package',
      description: 'Framework-neutral state and causal semantics',
      route: '/docs',
      queryParams: { package: 'kernel' },
      category: 'packages',
    },
    {
      id: 'react-package',
      title: 'React Package',
      description: 'Owner-bound React observation',
      route: '/docs',
      queryParams: { package: 'react' },
      category: 'packages',
    },
    {
      id: 'batching',
      title: 'Batching',
      description: 'Batch multiple updates without losing clarity',
      route: '/batching',
      category: 'examples',
    },
    {
      id: 'entities',
      title: 'Entities',
      description: 'CRUD ergonomics for collection-heavy state',
      route: '/entities',
      category: 'examples',
    },
    {
      id: 'serialization',
      title: 'Application-Owned Serialization',
      description: 'Why v15 leaves payloads and hydration to applications',
      route: '/serialization',
      category: 'examples',
    },
    {
      id: 'restoration',
      title: 'Restoration',
      description: 'Designated undo/redo and retained history',
      route: '/restoration',
      category: 'examples',
    },
    {
      id: 'async-markers',
      title: 'Async state (RxJS + external)',
      description:
        'Application-owned requests with external-truth writes',
      route: '/async',
      category: 'examples',
    },
    {
      id: 'marker-zoo',
      title: 'Marker zoo (surviving markers)',
      description:
        'EntityMap and current marker behavior at nested paths',
      route: '/marker-zoo',
      category: 'examples',
    },
    {
      id: 'entity-collection',
      title: 'EntityMap collections',
      description:
        'Normalized local identity with application-owned loading',
      route: '/entity-collection',
      category: 'examples',
    },
    {
      id: 'benchmark',
      title: 'AI-codegen benchmark scorecard',
      description:
        '720-cell measured result — SignalTree 49% cold → 98% primed (+49pp). Per-library, per-agent breakdowns.',
      route: '/benchmark',
      category: 'learn',
    },
    {
      id: 'devtools',
      title: 'DevTools',
      description: 'Redux DevTools integration',
      route: '/devtools',
      category: 'examples',
    },
    {
      id: 'markers',
      title: 'Markers',
      description: 'Understand the marker model and built-in primitives',
      route: '/markers',
      category: 'advanced',
    },
    {
      id: 'extreme-depth',
      title: 'Extreme Depth',
      description: 'Test recursive typing at 15+ levels',
      route: '/extreme-depth',
      category: 'advanced',
    },
    {
      id: 'benchmarks',
      title: 'Library Comparison',
      description: 'Compare SignalTree with other Angular state approaches',
      route: '/benchmarks',
      category: 'benchmarks',
    },
    {
      id: 'benchmark-history',
      title: 'Benchmark History',
      description: 'View historical results across machines',
      route: '/realistic-benchmark-history',
      category: 'benchmarks',
    },
  ];

  categories: DemoExample['category'][] = [
    'learn',
    'packages',
    'examples',
    'advanced',
    'benchmarks',
  ];

  externalLinks: ExternalLink[] = [
    {
      label: 'GitHub',
      url: 'https://github.com/JBorgia/signal-tree',
      icon: '🔗',
      title: 'View source code on GitHub',
    },
    {
      label: 'npm',
      url: 'https://www.npmjs.com/org/signaltree',
      icon: '📦',
      title: 'View packages on npm',
    },
  ];

  getExamplesByCategory(category: DemoExample['category']): DemoExample[] {
    return this.examples.filter((example) => example.category === category);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((isOpen) => !isOpen);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  getCategoryLabel(category: DemoExample['category']): string {
    const labels: Record<DemoExample['category'], string> = {
      learn: '🚀 Learn',
      packages: '📦 Reference',
      examples: '🧪 Examples',
      advanced: '🔧 Advanced',
      benchmarks: '📊 Benchmarks',
    };
    return labels[category];
  }
}
