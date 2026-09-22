import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChildren,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import scss from 'highlight.js/lib/languages/scss';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';

import type { CodeFile, CodeLang } from './example.types';

// Register grammars once (tree-shaken core, same pattern as the docs page).
let registered = false;
function ensureRegistered(): void {
  if (registered) return;
  hljs.registerLanguage('typescript', typescript);
  hljs.registerLanguage('javascript', javascript);
  hljs.registerLanguage('xml', xml); // highlight.js highlights HTML as `xml`
  hljs.registerLanguage('scss', scss);
  hljs.registerLanguage('css', css);
  hljs.registerLanguage('json', json);
  hljs.registerLanguage('bash', bash);
  registered = true;
}

/** highlight.js grammar name for a given CodeLang. */
function grammar(lang: CodeLang): string {
  return lang === 'html' ? 'xml' : lang;
}

/**
 * Read-only, syntax-highlighted, tabbed source viewer with per-tab copy.
 * The single replacement for the `.code-example` block redefined across ~9
 * demo stylesheets (none of which highlighted or offered copy).
 */
@Component({
  selector: 'st-code-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (files().length) {
    <div class="code-tabs">
      @if (files().length > 1) {
      <div
        class="code-tabs__bar"
        role="tablist"
        aria-label="Example source files"
      >
        @for (file of files(); track file.label; let i = $index) {
        <button
          #fileTab
          class="code-tabs__tab"
          [id]="id + '-tab-' + i"
          [attr.aria-controls]="id + '-panel'"
          [tabIndex]="i === selectedIndex() ? 0 : -1"
          (keydown)="onTabKeydown($event, i)"
          role="tab"
          type="button"
          [class.code-tabs__tab--active]="i === selectedIndex()"
          [attr.aria-selected]="i === selectedIndex()"
          (click)="select(i)"
        >
          {{ file.label }}
        </button>
        }
      </div>
      }

      <div
        class="code-tabs__body"
        [id]="id + '-panel'"
        [attr.role]="files().length > 1 ? 'tabpanel' : 'region'"
        [attr.aria-labelledby]="
          files().length > 1 ? id + '-tab-' + selectedIndex() : null
        "
        [attr.aria-label]="files().length === 1 ? current().label : null"
      >
        <button
          class="code-tabs__copy"
          type="button"
          (click)="copy()"
          [attr.aria-label]="'Copy ' + current().label"
        >
          {{ copied() ? 'Copied' : 'Copy' }}
        </button>
        <pre
          class="code-tabs__pre"
          tabindex="0"
          [attr.aria-label]="current().label + ' source code'"
        ><code [innerHTML]="highlighted()"></code></pre>
      </div>
      <p class="code-tabs__status" role="status">{{ copyStatus() }}</p>
    </div>
    }
  `,
  styleUrl: './code-tabs.component.scss',
})
export class CodeTabsComponent {
  private static nextId = 0;
  readonly id = `example-source-${CodeTabsComponent.nextId++}`;
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tabs =
    viewChildren<ElementRef<HTMLButtonElement>>('fileTab');

  readonly files = input<CodeFile[]>([]);

  readonly active = signal(0);
  readonly copied = signal(false);
  readonly copyStatus = signal('');
  readonly selectedIndex = computed(() =>
    Math.min(this.active(), Math.max(0, this.files().length - 1))
  );

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.copyResetHandle));
  }

  select(index: number): void {
    this.active.set(index);
    this.copied.set(false);
    this.copyStatus.set('');
    clearTimeout(this.copyResetHandle);
  }

  onTabKeydown(event: KeyboardEvent, index: number): void {
    const last = this.files().length - 1;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = index === last ? 0 : index + 1;
        break;
      case 'ArrowLeft':
        next = index === 0 ? last : index - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = last;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.select(next);
    this.tabs()[next]?.nativeElement.focus();
  }

  private copyResetHandle: ReturnType<typeof setTimeout> | undefined;

  readonly current = computed<CodeFile>(
    () =>
      this.files()[this.selectedIndex()] ??
      this.files()[0] ?? { label: '', language: 'typescript', source: '' }
  );

  readonly highlighted = computed<SafeHtml>(() => {
    ensureRegistered();
    const file = this.current();
    const html = hljs.highlight(file.source, {
      language: grammar(file.language),
      ignoreIllegals: true,
    }).value;
    return this.sanitizer.bypassSecurityTrustHtml(html);
  });

  async copy(): Promise<void> {
    const file = this.current();
    this.copied.set(false);
    this.copyStatus.set('');
    clearTimeout(this.copyResetHandle);
    try {
      await navigator.clipboard.writeText(file.source);
      if (this.destroyRef.destroyed || this.current() !== file) return;
      this.copied.set(true);
      this.copyStatus.set(`${file.label} copied.`);
      clearTimeout(this.copyResetHandle);
      this.copyResetHandle = setTimeout(() => {
        this.copied.set(false);
        this.copyStatus.set('');
      }, 1500);
    } catch {
      if (this.destroyRef.destroyed || this.current() !== file) return;
      this.copyStatus.set(
        'Copy unavailable. Select the code and copy it manually.'
      );
    }
  }
}
