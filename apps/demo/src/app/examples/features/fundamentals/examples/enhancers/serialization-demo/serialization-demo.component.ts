import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-serialization-demo',
  standalone: true,
  imports: [RouterModule],
  template: `
    <section class="serialization-demo">
      <h1>Serialization Removed From RC</h1>
      <p>
        The old <code>serialization()</code> enhancer is not part of the current
        release-candidate public API. Snapshot/export examples are withdrawn
        until a serialization contract earns release authority.
      </p>
      <a routerLink="/">Back to demo home</a>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './serialization-demo.component.scss',
})
export class SerializationDemoComponent {}
