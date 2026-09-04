import { Observable, Subject, Subscription, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
} from 'rxjs';
import { external, signalTree } from '@signal-tree/angular';

/**
 * The debounced-search scenario that `asyncQuery` used to own — as ordinary
 * application code.
 *
 * ⚠️ THE POINT. SignalTree ships no async marker, because it has no authority
 * over any of these behaviours:
 *
 * ```text
 * debounceTime           debounce
 * distinctUntilChanged   dedup
 * switchMap              cancellation AND latest-wins
 * ```
 *
 * The tree stores the RESULT. `external()` marks the write as authored from
 * outside the application's own mutations, so the tree records an ingress
 * rather than a user edit.
 */
export function createSearchPipeline<T>(
  search: (query: string) => Observable<T[]>,
  options: { debounceMs?: number } = {}
) {
  const tree = signalTree({
    results: [] as T[],
    loading: false,
    error: null as unknown,
  });

  const query$ = new Subject<string>();

  const subscription: Subscription = query$
    .pipe(
      debounceTime(options.debounceMs ?? 300),
      filter((q) => q.length > 0),
      distinctUntilChanged(),
      switchMap((q) => {
        external(() => {
          tree.$.loading(true);
          tree.$.error(null);
        });
        // ⚠️ CAUGHT INSIDE switchMap, PER QUERY, and mapped to an outcome.
        //
        // This is load-bearing, and it is the one piece of real knowledge the
        // retired `asyncQuery` marker had encoded in its implementation: if a
        // query error ESCAPES switchMap it terminates the OUTER subscription,
        // and the pipeline silently stops responding to every future input.
        //
        // Measured, not assumed — the first draft of this file omitted it and
        // the recovery test failed exactly that way. A retired primitive can
        // still own a lesson worth carrying forward even when it owned no
        // architecture.
        return search(q).pipe(
          map((results) => ({ ok: true as const, results })),
          catchError((error) => of({ ok: false as const, error }))
        );
      })
    )
    .subscribe((outcome) =>
      external(() => {
        if (outcome.ok) {
          tree.$.results(outcome.results as never);
          tree.$.error(null);
        } else {
          tree.$.error(outcome.error);
        }
        tree.$.loading(false);
      })
    );

  return {
    tree,
    search: (q: string) => query$.next(q),
    destroy: () => subscription.unsubscribe(),
  };
}
