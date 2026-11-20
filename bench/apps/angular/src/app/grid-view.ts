import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { BenchHost, type GridRow } from './bench-host';

/** One rendered row; every cell reads one held field cell, so a field write refreshes only its row. */
@Component({
  selector: 'tr[benchGridRow]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (cell of row().cells; track $index) {
      <td>{{ cell() }}</td>
    }
  `,
})
export class GridRowView {
  readonly row = input.required<GridRow>({ alias: 'benchGridRow' });
}

/** S2: the rendered window of the collection. */
@Component({
  selector: 'bench-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GridRowView],
  template: `
    <table>
      <tbody>
        @for (row of host.grid(); track row.id) {
          <tr [benchGridRow]="row"></tr>
        }
      </tbody>
    </table>
  `,
})
export class GridView {
  protected readonly host = inject(BenchHost);
}
