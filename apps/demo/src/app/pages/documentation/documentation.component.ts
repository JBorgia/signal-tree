
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
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

  packages: DocPackage[] = [
    {
      id: 'kernel',
      name: '@signal-tree/kernel',
      description:
        'Framework-neutral state, EntityMap, causal turns, links, restoration, transactions, batching, and DevTools',
      readmePath: 'assets/docs/core/README.md',
    },
    {
      id: 'angular',
      name: '@signal-tree/angular',
      description: 'Angular observation, defineStore, and explicit native-signal bridging',
      readmePath: 'assets/docs/angular/README.md',
    },
    {
      id: 'react',
      name: '@signal-tree/react',
      description: 'React external-store observation of canonical tree reads',
      readmePath: 'assets/docs/react/README.md',
    },
    {
      id: 'vue',
      name: '@signal-tree/vue',
      description: 'Vue dependency observation for direct universal-location reads',
      readmePath: 'assets/docs/vue/README.md',
    },
    {
      id: 'composition-recipes',
      name: 'Composition Recipes',
      description: 'Application patterns composed from existing v15 primitives',
      readmePath: 'assets/docs/guides/composition-recipes.md',
    },
    {
      id: 'persistence-guide',
      name: 'Persistence Guide',
      description: 'External storage acquisition and synchronization through link()',
      readmePath: 'assets/docs/guides/persistence-guide.md',
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
    this.loading.set(true);
    this.error.set(null);

    try {
      const markdown = await lastValueFrom(
        this.http.get(pkg.readmePath, { responseType: 'text' })
      );

      if (!markdown) {
        this.markdownContent.set('');
        return;
      }

      const html = await marked.parse(markdown);
      this.markdownContent.set(this.highlightCodeBlocks(html));
    } catch {
      this.error.set(`Failed to load documentation for ${pkg.name}`);
      this.markdownContent.set('');
    } finally {
      this.loading.set(false);
    }
  }

  private highlightCodeBlocks(html: string): string {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

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
