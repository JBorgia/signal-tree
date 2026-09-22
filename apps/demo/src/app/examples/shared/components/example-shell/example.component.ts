import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';

import { CodeTabsComponent } from './code-tabs.component';
import { EmissionLogComponent } from './emission-log.component';
import type {
  CodeFile,
  EmissionEntry,
  StackblitzConfig,
} from './example.types';
import { StackblitzService } from './stackblitz.service';
import { StateInspectorComponent } from './state-inspector.component';

let nextSourceId = 0;

/**
 * `st-example` — the one shell every demo uses.
 *
 * Regions turn on by input, so a demo declares only what it has:
 *   - intro       → `heading` + `intro` (or project `[intro]` for rich markup)
 *   - live demo   → default `<ng-content>` (buttons, inputs, output)
 *   - live state  → `[state]` (bind a `computed()` snapshot)
 *   - emissions   → `[emissions]` (from `trackEmissions(...)`)
 *   - source      → `[code]` (tabbed, highlighted, copyable)
 *   - playground  → `[stackblitz]` (adds an "Edit in StackBlitz" button)
 *
 * @example
 * <st-example heading="Counter" [intro]="…" [state]="snapshot()"
 *             [emissions]="emissions()" [code]="files" [stackblitz]="sb">
 *   <button (click)="inc()">+1</button>
 * </st-example>
 */
@Component({
  selector: 'st-example',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CodeTabsComponent, StateInspectorComponent, EmissionLogComponent],
  template: `
    <section class="st-example">
      <header class="st-example__header">
        @if (heading()) { @if (headingLevel() === 1) {
        <h1 class="st-example__heading">{{ heading() }}</h1>
        } @else {
        <h2 class="st-example__heading">{{ heading() }}</h2>
        } }
        <div class="st-example__intro">
          <ng-content select="[intro]"></ng-content>
          @if (intro()) {
          <p>{{ intro() }}</p>
          }
        </div>
      </header>

      <div class="st-example__toolbar">
        <p class="st-example__preview-label">Live preview</p>
        <div class="st-example__actions">
          @if (stackblitz()) {
          <button
            class="st-example__edit"
            type="button"
            (click)="openStackblitz()"
          >
            Edit in StackBlitz ↗
          </button>
          } @if (code().length) {
          <button
            class="st-example__toggle"
            type="button"
            [attr.aria-expanded]="showCode()"
            [attr.aria-controls]="sourceId"
            (click)="toggleCode()"
          >
            {{ showCode() ? 'Hide code' : 'Show code' }}
          </button>
          }
        </div>
      </div>

      <div
        class="st-example__workspace"
        [class.st-example__workspace--with-code]="code().length && showCode()"
      >
        <div class="st-example__demo">
          <ng-content></ng-content>
        </div>
        @if (code().length) {
        <section
          class="st-example__code"
          [id]="sourceId"
          [hidden]="!showCode()"
          [attr.aria-labelledby]="sourceId + '-title'"
        >
          <h3 class="st-example__code-title" [id]="sourceId + '-title'">
            Source
          </h3>
          <st-code-tabs [files]="code()" />
        </section>
        }
      </div>

      @if (state() !== undefined || emissions() !== null) {
      <details class="st-example__diagnostics">
        <summary>
          @if (state() !== undefined && emissions() !== null) { State and
          emissions } @else if (state() !== undefined) {
          {{ stateLabel() }}
          } @else { Emissions }
        </summary>
        <div class="st-example__reactive">
          @if (state() !== undefined) {
          <div class="st-example__panel">
            <st-state-inspector [value]="state()" [label]="stateLabel()" />
          </div>
          } @if (emissions() !== null) {
          <div class="st-example__panel">
            <p class="st-example__panel-label">Emissions</p>
            <st-emission-log [entries]="emissions() ?? []" />
          </div>
          }
        </div>
      </details>
      }
    </section>
  `,
  styleUrl: './example.component.scss',
})
export class ExampleComponent {
  private readonly stackblitz_ = inject(StackblitzService);

  readonly sourceId = `st-example-source-${nextSourceId++}`;
  readonly showCode = signal(true);

  toggleCode(): void {
    this.showCode.update((visible) => !visible);
  }

  readonly heading = input<string>('');
  /**
   * 1 when the example IS the routed page (its heading is the page title);
   * 2 (default) when embedded alongside other examples.
   */
  readonly headingLevel = input<1 | 2>(2);
  readonly intro = input<string>('');
  readonly code = input<CodeFile[]>([]);
  /** Bind a `computed()` snapshot; `undefined` hides the inspector. */
  readonly state = input<unknown>(undefined);
  readonly stateLabel = input<string>('Live state');
  /** `null` hides the emission log; `[]` shows its empty state. */
  readonly emissions = input<EmissionEntry[] | null>(null);
  /** Presence adds the "Edit in StackBlitz" button. */
  readonly stackblitz = input<StackblitzConfig | null>(null);

  openStackblitz(): void {
    const config = this.stackblitz();
    if (config) this.stackblitz_.open(config);
  }
}
