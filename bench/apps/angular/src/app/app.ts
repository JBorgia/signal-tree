import { ApplicationRef, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { installBenchApi } from './bench-api';
import { BenchHost } from './bench-host';
import { FormView } from './form-view';
import { GridView } from './grid-view';

@Component({
  selector: 'bench-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormView, GridView],
  template: `
    @switch (host.view()) {
      @case ('form') {
        <bench-form />
      }
      @case ('grid') {
        <bench-grid />
      }
    }
  `,
})
export class App {
  protected readonly host = inject(BenchHost);

  constructor() {
    installBenchApi(this.host, inject(ApplicationRef));
  }
}
