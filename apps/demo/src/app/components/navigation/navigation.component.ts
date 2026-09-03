import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SIGNALTREE_VERSION_SUMMARY } from '../../version';

interface DemoLink {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly route: string;
  readonly queryParams?: Readonly<Record<string, string>>;
  readonly fragment?: string;
}

interface NavigationSection {
  readonly id: string;
  readonly label: string;
  readonly items: readonly DemoLink[];
}

interface ExternalLink {
  readonly label: string;
  readonly url: string;
  readonly title: string;
}

@Component({
  selector: 'app-navigation',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './navigation.component.html',
  styleUrl: './navigation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationComponent {
  readonly versionSummary = SIGNALTREE_VERSION_SUMMARY;
  readonly mobileMenuOpen = signal(false);

  readonly sections: readonly NavigationSection[] = [
    {
      id: 'learn',
      label: 'Learn',
      items: [
        {
          id: 'start',
          title: 'Start here',
          description: 'A five-minute tour of the current v15 model',
          route: '/start',
        },
        {
          id: 'architecture',
          title: 'Architecture',
          description: 'Verified ownership, causality, identity, and Link',
          route: '/architecture-overview',
        },
        {
          id: 'fundamentals',
          title: 'Fundamentals',
          description: 'Interactive construction and state grammar',
          route: '/examples/fundamentals',
        },
        {
          id: 'migration',
          title: 'Migration',
          description: 'Move application ownership toward the v15 model',
          route: '/migrate',
        },
      ],
    },
    {
      id: 'core',
      label: 'Core concepts',
      items: [
        {
          id: 'state-derived',
          title: 'State & derived',
          description: 'Shape, $ access, writes, and computed state',
          route: '/examples/fundamentals',
          fragment: 'signals-basics',
        },
        {
          id: 'batching',
          title: 'Coherent operations',
          description: 'Batching and grouped publication',
          route: '/batching',
        },
        {
          id: 'entities',
          title: 'EntityMap',
          description: 'Keyed identity and queries',
          route: '/entities',
        },
        {
          id: 'restoration',
          title: 'Restoration',
          description: 'Designated undo and redo',
          route: '/restoration',
        },
        {
          id: 'external',
          title: 'External truth & Link',
          description: 'Ingress authority and persistent relationships',
          route: '/external-truth',
        },
      ],
    },
    {
      id: 'frameworks',
      label: 'Frameworks',
      items: [
        {
          id: 'angular',
          title: 'Angular',
          description: 'Native signals, DI, and owned construction',
          route: '/docs',
          queryParams: { package: 'angular' },
        },
        {
          id: 'react',
          title: 'React',
          description: 'Owner-bound external-store observation',
          route: '/docs',
          queryParams: { package: 'react' },
        },
        {
          id: 'kernel',
          title: 'Kernel / Plain TypeScript',
          description: 'Framework-neutral state and causal semantics',
          route: '/docs',
          queryParams: { package: 'kernel' },
        },
      ],
    },
    {
      id: 'advanced',
      label: 'Advanced',
      items: [
        {
          id: 'devtools',
          title: 'DevTools',
          description: 'State inspection integration',
          route: '/devtools',
        },
        {
          id: 'depth',
          title: 'Type system',
          description: 'Compiled 15-branch proof',
          route: '/deep-typing',
        },
        {
          id: 'adapter-sdk',
          title: 'Adapter SDK',
          description: 'Kernel authority and framework realization',
          route: '/architecture-overview',
          fragment: 'foundation-heading',
        },
      ],
    },
    {
      id: 'archive',
      label: 'Archive',
      items: [
        {
          id: 'legacy-changelog',
          title: 'Pre-v15 releases',
          description: 'Historical APIs and release notes',
          route: '/legacy-changelog',
        },
        {
          id: 'benchmark-history',
          title: 'Benchmark history',
          description: 'Archived harness submissions',
          route: '/realistic-benchmark-history',
        },
      ],
    },
  ];

  readonly externalLinks: readonly ExternalLink[] = [
    {
      label: 'GitHub',
      url: 'https://github.com/JBorgia/signal-tree',
      title: 'View source code on GitHub',
    },
    {
      label: 'npm',
      url: 'https://www.npmjs.com/org/signaltree',
      title: 'View packages on npm',
    },
  ];

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update((isOpen) => !isOpen);
  }

  openMobileMenu(): void {
    this.mobileMenuOpen.set(true);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
