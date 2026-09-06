import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SIGNALTREE_CORE_VERSION } from '../../../../../version';

@Component({
  selector: 'app-whats-new',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './whats-new.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './whats-new.component.scss',
})
export class WhatsNewComponent {
  readonly version = SIGNALTREE_CORE_VERSION;
}
