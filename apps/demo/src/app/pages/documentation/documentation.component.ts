import { ViewportScroller } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  OnInit,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import typescript from 'highlight.js/lib/languages/typescript';
import { marked } from 'marked';
import { lastValueFrom } from 'rxjs';

interface DocPackage {
  id: string;
  name: string;
  description: string;
  readmePath: string;
  repositoryPath: string;
}

interface DocQuickLink {
  label: string;
  route: string;
}

@Component({
  selector: 'app-documentation',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './documentation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './documentation.component.scss',
})
export class DocumentationComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly scroller = inject(ViewportScroller);
  private loadSequence = 0;

  packages: DocPackage[] = [
    {
      id: 'kernel',
      name: '@signal-tree/kernel',
      description:
        'Framework-neutral state, EntityMap, causal turns, links, restoration, transactions, batching, and DevTools',
      readmePath: 'assets/docs/core/README.md',
      repositoryPath: 'packages/kernel/README.md',
    },
    {
      id: 'angular',
      name: '@signal-tree/angular',
      description:
        'Native Angular signal leaves, defineStore, and DestroyRef cleanup',
      readmePath: 'assets/docs/angular/README.md',
      repositoryPath: 'packages/angular/README.md',
    },
    {
      id: 'react',
      name: '@signal-tree/react',
      description: 'React external-store observation of canonical tree reads',
      readmePath: 'assets/docs/react/README.md',
      repositoryPath: 'packages/react/README.md',
    },
    {
      id: 'vue',
      name: '@signal-tree/vue',
      description: 'Native Vue ref leaves over kernel-owned state',
      readmePath: 'assets/docs/vue/README.md',
      repositoryPath: 'packages/vue/README.md',
    },
    {
      id: 'solid',
      name: '@signal-tree/solid',
      description: 'Native Solid accessor leaves with root-scoped disposal',
      readmePath: 'assets/docs/solid/README.md',
      repositoryPath: 'packages/solid/README.md',
    },
    {
      id: 'composition-recipes',
      name: 'Composition Recipes',
      description: 'Application patterns composed from existing v15 primitives',
      readmePath: 'assets/docs/guides/composition-recipes.md',
      repositoryPath: 'docs/guides/composition-recipes.md',
    },
    {
      id: 'persistence-guide',
      name: 'Persistence Guide',
      description:
        'External storage acquisition and synchronization through link()',
      readmePath: 'assets/docs/guides/persistence-guide.md',
      repositoryPath: 'docs/guides/persistence-guide.md',
    },
  ];

  readonly quickLinks: DocQuickLink[] = [
    {
      label: 'Architecture',
      route: '/architecture-overview',
    },
    {
      label: 'Fundamentals',
      route: '/examples/fundamentals',
    },
    {
      label: 'Migration',
      route: '/migrate',
    },
    {
      label: 'Restoration',
      route: '/restoration',
    },
  ];

  selectedPackage = signal<DocPackage>(this.packages[0]);
  markdownContent = signal<string>('');
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  constructor() {
    // Register languages for syntax highlighting
    hljs.registerLanguage('typescript', typescript);
    hljs.registerLanguage('javascript', javascript);
    hljs.registerLanguage('json', json);
    hljs.registerLanguage('bash', bash);

    // Configure marked
    marked.setOptions({
      breaks: false,
      gfm: true,
    });
  }

  ngOnInit() {
    // Check if there's a package query parameter
    this.route.queryParams.subscribe((params) => {
      const packageId = params['package'];
      if (packageId) {
        const pkg = this.packages.find((p) => p.id === packageId);
        if (pkg) {
          this.selectPackage(pkg);
          return;
        }
      }
      // Default to first package
      this.loadReadme(this.selectedPackage());
    });
  }

  selectPackage(pkg: DocPackage) {
    this.selectedPackage.set(pkg);
    this.loadReadme(pkg);
  }

  private async loadReadme(pkg: DocPackage) {
    const requestId = ++this.loadSequence;
    this.loading.set(true);
    this.error.set(null);

    try {
      const markdown = await lastValueFrom(
        this.http.get(pkg.readmePath, { responseType: 'text' })
      );

      if (requestId !== this.loadSequence) return;
      if (!markdown) {
        this.markdownContent.set('');
        return;
      }

      const html = await marked.parse(markdown);
      if (requestId !== this.loadSequence) return;
      this.markdownContent.set(this.prepareMarkdown(html, pkg));
      const fragment = this.route.snapshot.fragment;
      if (fragment) {
        afterNextRender(
          () => {
            if (requestId === this.loadSequence)
              this.scroller.scrollToAnchor(fragment);
          },
          { injector: this.injector }
        );
      }
    } catch {
      if (requestId !== this.loadSequence) return;
      this.error.set(`Failed to load documentation for ${pkg.name}`);
      this.markdownContent.set('');
    } finally {
      if (requestId === this.loadSequence) this.loading.set(false);
    }
  }

  private prepareMarkdown(html: string, pkg: DocPackage): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Markdown comes from copied assets, but relative links belong to the
    // original repository document. Package llms.txt is a generated copy of
    // the shared root manifest; it is also served directly by the demo.
    const repositoryRoot = 'https://github.com/JBorgia/signal-tree/blob/main/';
    const sourceUrl = new URL(pkg.repositoryPath, repositoryRoot);
    const routeTo = (target: DocPackage, fragment: string) =>
      this.router.serializeUrl(
        this.router.createUrlTree(['/docs'], {
          queryParams: { package: target.id },
          fragment: fragment || undefined,
        })
      );
    for (const anchor of Array.from(tempDiv.querySelectorAll('a[href]'))) {
      const href = anchor.getAttribute('href') ?? '';
      if (!href || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(href)) continue;
      if (/^llms\.txt(?:[?#]|$)/.test(href)) {
        anchor.setAttribute('href', `/${href}`);
        continue;
      }
      const resolved = new URL(href, sourceUrl);
      const target = this.packages.find(
        (entry) =>
          new URL(entry.repositoryPath, repositoryRoot).pathname ===
          resolved.pathname
      );
      if (target) {
        let fragment = resolved.hash.slice(1);
        try {
          fragment = decodeURIComponent(fragment);
        } catch {
          /* Keep malformed escapes literal. */
        }
        anchor.setAttribute('href', routeTo(target, fragment));
      } else {
        anchor.setAttribute('href', resolved.href);
      }
    }
    for (const image of Array.from(tempDiv.querySelectorAll('img[src]'))) {
      const src = image.getAttribute('src') ?? '';
      if (src && !/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(src)) {
        const base = new URL(
          pkg.repositoryPath,
          'https://raw.githubusercontent.com/JBorgia/signal-tree/main/'
        );
        image.setAttribute('src', new URL(src, base).href);
      }
    }
    const usedIds = new Set(
      Array.from(tempDiv.querySelectorAll('[id]'), (element) => element.id)
    );
    for (const heading of Array.from(
      tempDiv.querySelectorAll('h1,h2,h3,h4,h5,h6')
    )) {
      if (heading.id) continue;
      const base =
        (heading.textContent ?? '')
          .toLowerCase()
          .trim()
          .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
          .replace(/\s/g, '-') || 'section';
      let id = base;
      for (let suffix = 1; usedIds.has(id); suffix++) id = `${base}-${suffix}`;
      heading.id = id;
      usedIds.add(id);
    }

    const codeBlocks = Array.from(tempDiv.querySelectorAll('pre code'));
    for (const block of codeBlocks) {
      const codeElement = block as HTMLElement;
      const languageMatch = /language-(\w+)/.exec(codeElement.className);
      const language = languageMatch?.[1];

      try {
        if (language && hljs.getLanguage(language)) {
          codeElement.innerHTML = hljs.highlight(
            codeElement.textContent || '',
            {
              language,
            }
          ).value;
        } else {
          const result = hljs.highlightAuto(codeElement.textContent || '');
          codeElement.innerHTML = result.value;
        }
        codeElement.classList.add('hljs');
      } catch {
        // Leave unhighlighted on failure.
      }
    }

    return tempDiv.innerHTML;
  }
}
