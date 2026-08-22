import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-entity-collection-showcase',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './entity-collection.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './entity-collection.component.scss',
})
export class EntityCollectionShowcaseComponent {}
