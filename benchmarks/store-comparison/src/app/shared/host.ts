import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { ARM, GRID } from './tokens';
import { GridComponent } from './grid';
import { FooterComponent } from './footer';
import { EditorComponent } from './editor';
import { EditorRegistry } from './editor-registry';
import { BenchDriver } from './driver';

/**
 * The grid route component, identical for every arm. It creates the arm's store in its own
 * injection context, destroys it with the component, and installs the in-page driver as
 * `window.__bench` while it is alive.
 */
@Component({
  selector: 'bench-host',
  imports: [GridComponent, FooterComponent, EditorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    EditorRegistry,
    {
      provide: GRID,
      useFactory: () => {
        // Runs in the host's injection context (first injected below).
        const grid = inject(ARM).createGrid();
        inject(DestroyRef).onDestroy(() => grid.destroy());
        return grid;
      },
    },
  ],
  template: `
    <bench-grid />
    <bench-footer />
    <div class="editors" data-editors>
      @for (e of registry.stack(); track e.key) {
      <bench-editor [seed]="e.seed" [editorKey]="e.key" />
      }
    </div>
  `,
})
export class BenchHost {
  protected readonly registry = inject(EditorRegistry);

  constructor() {
    const grid = inject(GRID);
    const ready = new Promise<void>((resolve) =>
      afterNextRender(() => resolve())
    );
    const driver = new BenchDriver({
      arm: inject(ARM),
      grid,
      registry: this.registry,
      appRef: inject(ApplicationRef),
      router: inject(Router),
      ready,
    });
    window.__bench = driver;
    inject(DestroyRef).onDestroy(() => {
      if (window.__bench === driver) delete window.__bench;
      driver.dispose();
    });
  }
}
