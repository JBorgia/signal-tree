import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-migration-recipe',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './migration-recipe.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './migration-recipe.component.scss',
})
export class MigrationRecipeComponent {}
