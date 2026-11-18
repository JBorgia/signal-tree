import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { RouterModule } from '@angular/router';

import { NavigationComponent } from './components/navigation/navigation.component';
import { SIGNALTREE_VERSION_SUMMARY } from './version';

@Component({
  selector: 'app-root',
  imports: [RouterModule, NavigationComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly versionSummary = SIGNALTREE_VERSION_SUMMARY;
  private readonly scroller = inject(ViewportScroller);

  skipToContent(event: Event): void {
    // This is a local focus action. Router navigation could resolve against the
    // shell's root route while a lazy route is still being activated.
    event.preventDefault();
    this.scroller.scrollToAnchor('main-content');
  }
}
