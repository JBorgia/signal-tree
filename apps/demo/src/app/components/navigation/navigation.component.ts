import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SIGNALTREE_VERSION_SUMMARY } from '../../version';

interface DemoLink {
  readonly id: string;
  readonly title: string;
  readonly route: string;
  readonly queryParams?: Readonly<Record<string, string>>;
  readonly fragment?: string;
}

interface NavigationSection {
  readonly id: string;
  readonly label: string;
  readonly collapsed?: boolean;
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
          route: '/start',
        },
        {
          id: 'causality',
          title: 'Why SignalTree?',
          route: '/why-causality',
        },
        {
          id: 'architecture',
          title: 'Architecture',
          route: '/architecture-overview',
        },
        {
          id: 'fundamentals',
          title: 'Fundamentals',
          route: '/examples/fundamentals',
        },
        {
          id: 'migration',
          title: 'Upgrade to v15',
          route: '/migrate',
        },
      ],
    },
    {
      id: 'core',
      label: 'Examples',
      collapsed: true,
      items: [
        {
          id: 'state-derived',
          title: 'Nested state',
          route: '/examples/fundamentals',
          fragment: 'signals-basics',
        },
        {
          id: 'batching',
          title: 'Update several fields',
          route: '/batching',
        },
        {
          id: 'entities',
          title: 'Live collections',
          route: '/entities',
        },
        {
          id: 'restoration',
          title: 'Undo user edits',
          route: '/restoration',
        },
        {
          id: 'external',
          title: 'Server updates',
          route: '/external-truth',
        },
      ],
    },
    {
      id: 'frameworks',
      label: 'Frameworks',
      collapsed: true,
      items: [
        {
          id: 'frameworks-overview',
          title: 'Overview',
          route: '/frameworks',
        },
        {
          id: 'angular',
          title: 'Angular',
          route: '/docs',
          queryParams: { package: 'angular' },
        },
        {
          id: 'react',
          title: 'React',
          route: '/docs',
          queryParams: { package: 'react' },
        },
        {
          id: 'vue',
          title: 'Vue',
          route: '/docs',
          queryParams: { package: 'vue' },
        },
        {
          id: 'solid',
          title: 'Solid',
          route: '/docs',
          queryParams: { package: 'solid' },
        },
        {
          id: 'kernel',
          title: 'TypeScript',
          route: '/docs',
          queryParams: { package: 'kernel' },
        },
      ],
    },
    {
      id: 'advanced',
      label: 'Advanced',
      collapsed: true,
      items: [
        {
          id: 'benchmarks',
          title: 'Browser benchmarks',
          route: '/benchmarks',
        },
        {
          id: 'devtools',
          title: 'DevTools',
          route: '/devtools',
        },
        {
          id: 'depth',
          title: 'Type system',
          route: '/deep-typing',
        },
        {
          id: 'adapter-sdk',
          title: 'Adapter SDK',
          route: '/architecture-overview',
          fragment: 'foundation-heading',
        },
      ],
    },
    {
      id: 'archive',
      label: 'Archive',
      collapsed: true,
      items: [
        {
          id: 'legacy-changelog',
          title: 'Pre-v15 releases',
          route: '/legacy-changelog',
        },
        {
          id: 'benchmark-history',
          title: 'Benchmark history',
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
      url: 'https://www.npmjs.com/org/signal-tree',
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
