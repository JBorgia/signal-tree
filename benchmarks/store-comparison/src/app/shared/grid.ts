import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { GRID, VISIBLE } from './tokens';
import { RowComponent } from './row';

/** The visible window: the first VISIBLE ids in server order, one row component per id. */
@Component({
  selector: 'bench-grid',
  imports: [RowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid" data-grid>
      @for (id of visible(); track id) {
      <bench-row [id]="id" />
      }
    </div>
  `,
})
export class GridComponent {
  private readonly store = inject(GRID);
  protected readonly visible = computed(() =>
    this.store.ids().slice(0, VISIBLE)
  );
}
