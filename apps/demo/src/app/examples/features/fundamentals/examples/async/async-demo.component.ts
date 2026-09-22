import {
  Component,
  ChangeDetectionStrategy,
  OnDestroy,
  signal,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { external, link, signalTree } from '@signal-tree/angular';

import {
  type CodeFile,
  CodeTabsComponent,
  ExampleComponent,
} from '../../../../shared/components/example-shell';

@Component({
  selector: 'app-async-demo',
  standalone: true,
  imports: [RouterModule, ExampleComponent, CodeTabsComponent],
  templateUrl: './async-demo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './async-demo.component.scss',
})
export class AsyncDemoComponent implements OnDestroy {
  readonly tree = signalTree({
    results: [] as string[],
    preferences: { density: 'compact' },
  });
  readonly loading = signal(false);
  readonly preferencesPending = signal(false);
  readonly endpointDensity = signal('comfortable');
  readonly activity = signal('Retrieve preferences or edit the local density.');
  private destroyed = false;
  private readonly endpointListeners = new Set<
    (value: { density: string }) => void
  >();
  private readonly connection = link(this.tree.$.preferences, {
    get: async () => ({ density: this.endpointDensity() }),
    set: (value) => {
      this.endpointDensity.set(value.density);
    },
    subscribe: (next) => {
      this.endpointListeners.add(next);
      return () => {
        this.endpointListeners.delete(next);
      };
    },
  });

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    const users = await Promise.resolve(['Ada', 'Lin']);
    if (this.destroyed) return;
    external(() => this.tree.$.results.set(users));
    this.loading.set(false);
  }

  async retrievePreferences(): Promise<void> {
    if (this.destroyed || this.preferencesPending()) return;
    this.preferencesPending.set(true);
    this.activity.set('Retrieving preferences…');
    try {
      await this.connection.retrieve();
      if (!this.destroyed)
        this.activity.set('Retrieved the simulated endpoint value.');
    } finally {
      if (!this.destroyed) this.preferencesPending.set(false);
    }
  }

  async changeDensity(): Promise<void> {
    if (this.destroyed || this.preferencesPending()) return;
    this.preferencesPending.set(true);
    this.activity.set('Sending local edit…');
    try {
      this.tree.$.preferences.density.update((value) =>
        value === 'compact' ? 'comfortable' : 'compact'
      );
      await this.connection.settled();
      if (!this.destroyed)
        this.activity.set('Local edit acknowledged by the simulated endpoint.');
    } finally {
      if (!this.destroyed) this.preferencesPending.set(false);
    }
  }

  receivePreferences(): void {
    if (this.destroyed || this.preferencesPending()) return;
    const density =
      this.endpointDensity() === 'compact' ? 'comfortable' : 'compact';
    this.endpointDensity.set(density);
    for (const next of this.endpointListeners) next({ density });
    this.activity.set('Received an unsolicited endpoint update.');
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.connection.dispose();
    this.endpointListeners.clear();
    this.tree.destroy();
  }

  readonly ingressCode: CodeFile[] = [
    {
      label: 'Load then apply',
      language: 'typescript',
      source: `// Import external and signalTree from '@signal-tree/angular'.
// tree starts with results: [] as string[].
loading.set(true); // application-owned request state
const users = await Promise.resolve(['Ada', 'Lin']); // simulated endpoint
if (destroyed) return;
external(() => tree.$.results.set(users));
loading.set(false);
// Only the resolved write runs inside external().`,
    },
  ];

  readonly linkCode: CodeFile[] = [
    {
      label: 'Connect endpoint',
      language: 'typescript',
      source: `// Import link from '@signal-tree/angular'.
const connection = link(tree.$.preferences, {
  get: async () => ({ density: endpointDensity() }),
  set: (value) => { endpointDensity.set(value.density); },
  subscribe: (next) => {
    endpointListeners.add(next);
    return () => { endpointListeners.delete(next); };
  },
});

await connection.retrieve(); // endpoint → local state
// On a later user action:
tree.$.preferences.density.set('compact');
await connection.settled(); // local edit acknowledged
// At teardown:
connection.dispose();
tree.destroy();`,
    },
  ];

  readonly orchestrationCode: CodeFile[] = [
    {
      label: 'search.service.ts',
      language: 'typescript',
      source: `import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

// In the Angular service's injection context:
query$
  .pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap((query) => api.search$(query)),
    takeUntilDestroyed()
  )
  .subscribe((users) =>
    external(() => store.$.results.set(users))
  );

// Cancellation, retries, loading, errors, and cache policy
// remain application concerns.`,
    },
  ];
}
