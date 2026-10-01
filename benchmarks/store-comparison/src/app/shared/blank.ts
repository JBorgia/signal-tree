import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Empty route target: navigating here destroys the grid host (and its store and editors). */
@Component({
  selector: 'bench-blank',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class BlankPage {}
