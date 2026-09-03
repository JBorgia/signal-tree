
import { ChangeDetectionStrategy, Component } from '@angular/core';
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
}
