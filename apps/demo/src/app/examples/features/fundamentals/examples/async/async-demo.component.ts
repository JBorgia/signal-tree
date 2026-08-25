import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

import {
  type CodeFile,
  ExampleComponent,
} from '../../../../shared/components/example-shell';

/**
 * Async Operations — fundamentals tour entry.
 *
 * The canonical async demo lives at /async. SignalTree 15 has no async marker:
 * debouncing, dedup and latest-wins are RxJS, and the tree only stores the result.
 * This entry exists in the fundamentals tour as a pointer so the tour
 * acknowledges async without duplicating the full interactive demo.
 *
 * Previously this component implemented its own debounced search and load
 * lifecycle using raw `signal()` — pre-SignalTree-marker patterns that
 * taught the wrong shape. Replaced in 9.6.0 audit.
 */
@Component({
  selector: 'app-async-demo',
  standalone: true,
  imports: [RouterModule, ExampleComponent],
  templateUrl: './async-demo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './async-demo.component.scss',
})
export class AsyncDemoComponent {
  /** The quick-reference snippet shown in the st-example code panel. */
  readonly codeFiles: CodeFile[] = [
    {
      label: 'store.ts',
      language: 'typescript',
      source: `import { signalTree, external } from '@signaltree/core';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, map, switchMap } from 'rxjs';

// The TREE holds state. It does not own the request pipeline.
const store = signalTree({
  results: [] as User[],
  loading: false,
  error: null as unknown,
});

// The PIPELINE is ordinary RxJS, owned by your service.
//   debounceTime           -> debounce
//   distinctUntilChanged   -> dedup
//   switchMap              -> cancellation AND latest-wins
const query$ = new Subject<string>();

query$
  .pipe(
    debounceTime(300),
    filter((q) => q.length > 0),
    distinctUntilChanged(),
    switchMap((q) => {
      store.$.loading.set(true);
      return this.api.search$(q);
    })
  )
  // Caught INSIDE switchMap, per query. If an error escapes it, the OUTER
  // subscription terminates and the pipeline silently stops responding forever.
  .pipe(
    map((users) => ({ ok: true as const, users })),
    catchError((error) => of({ ok: false as const, error }))
  )
  // external() marks this as authored from OUTSIDE the application's own
  // mutations — the tree records an ingress, not a user edit.
  .subscribe((r) => external(() => {
    if (r.ok) store.$.results.set(r.users);
    else store.$.error.set(r.error);
    store.$.loading.set(false);
  }));

query$.next('alice');   // drives the debounced pipeline
store.$.results();      // User[]`,
    },
  ];
}
