import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { STATUSES } from '../contract';
import { GRID } from './tokens';
import { tickFooter } from './counters';

/** Status chips from the store's statusCounts. */
@Component({
  selector: 'bench-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = counts();
    <div class="footer" [attr.data-t]="tick()">
      @for (s of statuses; track s) {
      <span class="chip" [attr.data-chip]="s">{{ s }}: {{ c[s] }}</span>
      }
    </div>
  `,
})
export class FooterComponent {
  private readonly store = inject(GRID);
  protected readonly counts = this.store.statusCounts;
  protected readonly statuses = STATUSES;
  protected readonly tick = tickFooter;
}
