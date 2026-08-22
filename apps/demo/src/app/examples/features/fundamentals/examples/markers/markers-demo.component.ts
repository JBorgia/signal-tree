import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { entityMap, signalTree } from '@signaltree/core';

import {
  type CodeFile,
  ExampleComponent,
} from '../../../../shared/components/example-shell';

interface User {
  id: number;
  name: string;
  email: string;
}

@Component({
  selector: 'app-markers-demo',
  standalone: true,
  imports: [CommonModule, ExampleComponent],
  templateUrl: './markers-demo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './markers-demo.component.scss',
})
export class MarkersDemoComponent {
  readonly store = signalTree({
    users: {
      entities: entityMap<User, number>({ selectId: (user) => user.id }),
    },
  });

  readonly entityMapCodeFiles: CodeFile[] = [
    {
      label: 'entity-map.ts',
      language: 'typescript',
      source: `const tree = signalTree({
  users: {
    entities: entityMap<User, number>({ selectId: (user) => user.id }),
  },
});

tree.$.users.entities.setAll(users);
tree.$.users.entities.byId(1)?.();`,
    },
  ];

  loadUsers(): void {
    this.store.$.users.entities.setAll([
      { id: 1, name: 'Alice Johnson', email: 'alice@example.com' },
      { id: 2, name: 'Bob Smith', email: 'bob@example.com' },
      { id: 3, name: 'Carol Davis', email: 'carol@example.com' },
      { id: 4, name: 'David Wilson', email: 'david@example.com' },
    ]);
  }

  resetUsers(): void {
    this.store.$.users.entities.clear();
  }
}
