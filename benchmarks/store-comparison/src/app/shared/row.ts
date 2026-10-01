import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
  type OnInit,
  type Signal,
} from '@angular/core';
import type { Row } from '../contract';
import { GRID } from './tokens';
import { tickRow } from './counters';

/** One grid row. The row signal is obtained once per instance and read in the template. */
@Component({
  selector: 'bench-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = row(); @if (r) {
    <div class="row" [attr.data-row]="r.id" [attr.data-t]="tick()">
      <span data-f="id">{{ r.id }}</span>
      <span data-f="ticket">{{ r.ticket }}</span>
      <span data-f="truck">{{ r.truck }}</span>
      <span data-f="driver">{{ r.driver }}</span>
      <span data-f="status">{{ r.status }}</span>
      <span data-f="plant">{{ r.plant }}</span>
      <span data-f="product">{{ r.product }}</span>
      <span data-f="qty">{{ r.qty }}</span>
      <span data-f="eta">{{ r.eta }}</span>
      <span data-f="lat">{{ r.lat }}</span>
      <span data-f="lng">{{ r.lng }}</span>
      <span data-f="notes">{{ r.notes }}</span>
    </div>
    }
  `,
})
export class RowComponent implements OnInit {
  readonly id = input.required<string>();
  private readonly store = inject(GRID);
  protected row: Signal<Row | undefined> = signal(undefined);
  protected readonly tick = tickRow;

  ngOnInit(): void {
    // Inputs are set before ngOnInit and before the first template pass; `track id` means an
    // instance never changes id, so the row signal is resolved exactly once per instance.
    this.row = this.store.row(this.id());
  }
}
