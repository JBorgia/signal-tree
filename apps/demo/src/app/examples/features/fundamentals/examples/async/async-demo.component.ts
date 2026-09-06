import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

import {
  type CodeFile,
  ExampleComponent,
} from '../../../../shared/components/example-shell';

@Component({
  selector: 'app-async-demo',
  standalone: true,
  imports: [RouterModule, ExampleComponent],
  templateUrl: './async-demo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './async-demo.component.scss',
})
export class AsyncDemoComponent {
  readonly ingressCode: CodeFile[] = [
    {
      label: 'one-shot-ingress.ts',
      language: 'typescript',
      source: `import { external, signalTree } from '@signal-tree/angular';

const store = signalTree({
  results: [] as User[],
  loading: false,
  error: null as unknown,
});

store.$.loading.set(true); // application-owned request state
try {
  const users = await api.search('alice');
  external(() => store.$.results.set(users));
} catch (error) {
  store.$.error.set(error); // application-owned presentation policy
} finally {
  store.$.loading.set(false);
}`,
    },
  ];

  readonly linkCode: CodeFile[] = [
    {
      label: 'persistent-relationship.ts',
      language: 'typescript',
      source: `import { link, onTreeError, signalTree } from '@signal-tree/angular';

const store = signalTree({ preferences: { density: 'compact' } });

const stopReporting = onTreeError(({ error, operation, treeId, path }) => {
  errorReporter.capture(error, { operation, treeId, path });
});

const connection = link(store.$.preferences, {
  get: () => preferencesApi.load(),
  set: (value) => preferencesApi.save(value),
  subscribe: (next) => preferencesSocket.on('changed', next),
});

await connection.retrieve(); // endpoint -> state, on demand
store.$.preferences.density.set('comfortable'); // state -> endpoint
await connection.settled();  // outbound writes acknowledged
connection.dispose();        // release the relationship
stopReporting();             // release diagnostic reporting`,
    },
  ];

  readonly orchestrationCode: CodeFile[] = [
    {
      label: 'search.service.ts',
      language: 'typescript',
      source: `query$
  .pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap((query) => api.search$(query))
  )
  .subscribe((users) =>
    external(() => store.$.results.set(users))
  );

// Cancellation, retries, loading, errors, and cache policy
// remain application concerns.`,
    },
  ];
}
