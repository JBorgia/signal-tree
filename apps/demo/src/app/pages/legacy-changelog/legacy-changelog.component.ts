import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Pre-15 release history, split out of the "What's New" example so the live
 * surface only carries the current (v15) release. Everything here describes
 * `@signaltree/*` (pre-15) APIs and is kept for provenance, not guidance.
 */
@Component({
  selector: 'app-legacy-changelog',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './legacy-changelog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './legacy-changelog.component.scss',
})
export class LegacyChangelogComponent {}
