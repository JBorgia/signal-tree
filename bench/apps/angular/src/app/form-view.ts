import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BenchHost, type FormField } from './bench-host';

/** S1: every input is bound to one store leaf; a keystroke is one store turn. */
@Component({
  selector: 'bench-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form autocomplete="off">
      @for (field of host.form(); track field.id) {
        <label
          >{{ field.id }} <input [id]="field.id" [value]="field.leaf()" (input)="write(field, $event)"
        /></label>
      }
    </form>
  `,
})
export class FormView {
  protected readonly host = inject(BenchHost);

  protected write(field: FormField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.host.tree!.turn('S1.keystroke', () => field.leaf.set(value));
  }
}
