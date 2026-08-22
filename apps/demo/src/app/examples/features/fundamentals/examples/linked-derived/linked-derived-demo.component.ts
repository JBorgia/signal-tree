import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-linked-derived-demo',
  standalone: true,
  imports: [RouterModule],
  template: `
    <section class="demo">
      <h1>linked() Removed From RC</h1>
      <p>
        The old SignalTree <code>linked()</code> helper wrapped Angular's own
        linked-signal primitive and has not earned a separate RC public contract.
        Use Angular's primitive directly where a writable derived signal belongs.
      </p>
      <a routerLink="/marker-zoo">View surviving markers</a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .demo {
        max-width: 42rem;
        margin: 3rem auto;
        padding: 1.5rem;
      }
      p {
        line-height: 1.6;
      }
    `,
  ],
})
export class LinkedDerivedDemoComponent {}
