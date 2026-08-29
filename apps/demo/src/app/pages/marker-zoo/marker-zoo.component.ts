
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { entityMap, signalTree } from '@signal-tree/kernel';

import { CodeTabsComponent } from '../../examples/shared/components/example-shell';
import type { CodeFile } from '../../examples/shared/components/example-shell';

interface User {
  id: number;
  name: string;
  role: 'admin' | 'user' | 'guest';
  email: string;
}

interface Team {
  id: number;
  name: string;
}

interface Plant {
  id: string;
  name: string;
  region: string;
}

const ALL_USERS: User[] = [
  { id: 1, name: 'Alice', role: 'admin', email: 'alice@acme.test' },
  { id: 2, name: 'Bob', role: 'user', email: 'bob@acme.test' },
  { id: 3, name: 'Carol', role: 'user', email: 'carol@acme.test' },
  { id: 4, name: 'Dave', role: 'guest', email: 'dave@acme.test' },
];

const ALL_TEAMS: Team[] = [
  { id: 100, name: 'Platform' },
  { id: 101, name: 'Growth' },
];

const ALL_PLANTS: Plant[] = [
  { id: 'plant-a', name: 'Riverside', region: 'east' },
  { id: 'plant-b', name: 'Lakeshore', region: 'west' },
  { id: 'plant-c', name: 'Summit', region: 'central' },
];

/**
 * MARKER ZOO
 *
 * Showcases surviving marker-style APIs in ONE tree at different depths.
 * This is intentionally non-trivial — the point is to demonstrate that
 * SignalTree's marker family composes at arbitrary tree positions, which
 * is impossible (or requires significant ceremony) in libraries that
 * compose features at the store root.
 *
 * Depth map:
 *   depth 3: organization.teams.list (entityMap)
 *   depth 4: organization.teams.catalog.plants (plain nested entityMap)
 */
@Component({
  selector: 'app-marker-zoo',
  standalone: true,
  imports: [FormsModule, RouterModule, CodeTabsComponent],
  templateUrl: './marker-zoo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './marker-zoo.component.scss',
})
export class MarkerZooComponent {
  readonly entityMapCode: CodeFile[] = [
    {
      label: 'entityMap.ts',
      language: 'typescript',
      source: `store.$.organization.teams.list.all()`,
    },
  ];

  readonly plantsCode: CodeFile[] = [
    {
      label: 'plants.ts',
      language: 'typescript',
      source: `plants: entityMap<Plant, string>({
  selectId: (p) => p.id,
})

store.$.organization.teams.catalog.plants.all();      // full entityMap surface
store.$.organization.teams.catalog.plants.setAll(rows); // app service owns loading`,
    },
  ];

  readonly store = signalTree({
    organization: {
      teams: {
        // depth 3 — entityMap of teams (nested inside organization)
        list: entityMap<Team, number>({ selectId: (t) => t.id }),

        catalog: {
          // depth 4 — plain nested entityMap
          plants: entityMap<Plant, string>({
            selectId: (p) => p.id,
          }),
        },
      },
    },
  });

  loadTeams(): void {
    this.store.$.organization.teams.list.setAll(ALL_TEAMS);
  }

  loadPlants(): void {
    this.store.$.organization.teams.catalog.plants.setAll(ALL_PLANTS);
  }

  resetAll(): void {
    this.store.$.organization.teams.list.clear();
    this.store.$.organization.teams.catalog.plants.clear();
  }
}
