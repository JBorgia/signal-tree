import { DestroyRef, computed, inject, signal } from '@angular/core';
import {
  count,
  createCollection,
  injectLiveQuery,
  localOnlyCollectionOptions,
} from '@tanstack/angular-db';

import {
  addedJob,
  normalizeTitle,
  titleError,
  VISIBLE_ROWS,
  type Inventory,
  type Job,
} from '../model';

interface StoredJob {
  id: string;
  position: number;
  value: Job;
}

/** Locally owned state; no remote-query cache is needed for this scenario. */
export function createInventory(rows: readonly Job[]): Inventory {
  const live = signal(true);
  const query = signal('');
  const selected = signal<string | null>(null);
  const error = signal<string | null>(null);
  const search = computed(() => query().trim().toLowerCase());
  let nextPosition = rows.length;
  let nextId = 1;
  let disposal: Promise<void> | undefined;

  // Position is explicit because native ordered LIMIT must preserve insertion
  // order, including remove-then-add replacement of a reused business ID.
  const jobs = createCollection(
    localOnlyCollectionOptions<StoredJob, string>({
      getKey: (entry) => entry.id,
      initialData: rows.map((value, position) => ({
        id: value.id,
        position,
        value: { ...value },
      })),
    })
  );

  const totalQuery = injectLiveQuery((q) =>
    live()
      ? q
          .from({ entry: jobs })
          .select(({ entry }) => ({ value: count(entry.id) }))
      : undefined
  );

  // fn.where is a native incremental query predicate. LIKE/ILIKE would treat
  // '%' and '_' as wildcards, violating the common literal-substring contract.
  // The count query returns one aggregate row, not every matching application row.
  const matchedQuery = injectLiveQuery({
    params: () => (live() ? search() : null),
    query: ({ params, q }) =>
      params === null
        ? undefined
        : q
            .from({ entry: jobs })
            .fn.where(({ entry }) =>
              entry.value.title.toLowerCase().includes(params)
            )
            .select(({ entry }) => ({ value: count(entry.id) })),
  });

  const viewportQuery = injectLiveQuery({
    params: () => (live() ? search() : null),
    query: ({ params, q }) =>
      params === null
        ? undefined
        : q
            .from({ entry: jobs })
            .fn.where(({ entry }) =>
              entry.value.title.toLowerCase().includes(params)
            )
            .orderBy(({ entry }) => entry.position, 'asc')
            .limit(VISIBLE_ROWS)
            .select(({ entry }) => ({ value: entry.value })),
  });
  const visible = computed<readonly Job[]>(() =>
    live() ? viewportQuery.data().map((entry) => entry.value) : []
  );

  // Changing a query parameter releases its observer, but the old native query
  // may still be waiting for idle GC. Retain those resources until native
  // cleanup finishes so immediate session teardown can retire every dependent.
  const retainedQueries = new Map<{ cleanup(): Promise<void> }, () => void>();
  function retainQuery(
    collection:
      | ReturnType<typeof totalQuery.collection>
      | ReturnType<typeof viewportQuery.collection>
  ): void {
    if (
      !collection ||
      collection.status === 'cleaned-up' ||
      retainedQueries.has(collection)
    )
      return;
    const unsubscribe = collection.on('status:cleaned-up', () => {
      retainedQueries.get(collection)?.();
      retainedQueries.delete(collection);
    });
    retainedQueries.set(collection, unsubscribe);
  }

  function rename(id: string, title: string): void {
    if (!live() || !jobs.has(id)) return;
    const normalized = normalizeTitle(title);
    if (!normalized) {
      error.set(titleError);
      return;
    }
    error.set(null);
    jobs.update(id, (draft) => {
      draft.value.title = normalized;
    });
  }

  function remove(id: string): void {
    if (!live() || !jobs.has(id)) return;
    jobs.delete(id);
    if (selected() === id) selected.set(null);
  }

  function destroy(): Promise<void> {
    if (disposal) return disposal;
    retainQuery(totalQuery.collection());
    retainQuery(matchedQuery.collection());
    retainQuery(viewportQuery.collection());
    live.set(false);
    selected.set(null);
    error.set(null);
    const queries = Array.from(retainedQueries.keys());
    for (const unsubscribe of retainedQueries.values()) unsubscribe();
    retainedQueries.clear();
    // The host first destroys this session's injector, synchronously detaching
    // injectLiveQuery observers. Dependents must then finish native cleanup
    // before their source is retired; a signal write alone is not that boundary.
    disposal = Promise.all(
      queries.map((collection) => collection.cleanup())
    ).then(() => jobs.cleanup());
    return disposal;
  }
  inject(DestroyRef).onDestroy(destroy);

  return {
    kind: 'tanstack',
    query,
    selected,
    error,
    total: () => (live() ? totalQuery.data()[0]?.value ?? 0 : 0),
    matched: () => (live() ? matchedQuery.data()[0]?.value ?? 0 : 0),
    visible,
    row: (id) => (live() ? jobs.get(id)?.value : undefined),
    filter(value) {
      if (!live() || value === query()) return;
      retainQuery(matchedQuery.collection());
      retainQuery(viewportQuery.collection());
      query.set(value);
    },
    select(id) {
      if (live()) selected.set(id !== null && !jobs.has(id) ? null : id);
    },
    rename,
    toggle(id) {
      if (!live() || !jobs.has(id)) return;
      jobs.update(id, (draft) => {
        draft.value.active = !draft.value.active;
      });
    },
    add(title) {
      if (!live()) return null;
      const normalized = normalizeTitle(title);
      if (!normalized) {
        error.set(titleError);
        return null;
      }
      error.set(null);
      let id: string;
      do {
        id = `J-new-${nextId++}`;
      } while (jobs.has(id));
      jobs.insert({
        id,
        position: nextPosition++,
        value: addedJob(id, normalized),
      });
      return id;
    },
    remove,
    replace(id, replacement) {
      if (!live()) return;
      if (replacement.id !== id)
        throw new Error('Replacement must reuse the requested ID');
      remove(id);
      jobs.insert({ id, position: nextPosition++, value: { ...replacement } });
    },
    openEditor(id) {
      const instance = live() ? jobs.get(id)?.value.instance : undefined;
      return {
        rename(title) {
          if (
            live() &&
            instance !== undefined &&
            jobs.get(id)?.value.instance === instance
          ) {
            rename(id, title);
          }
        },
      };
    },
    destroy,
  };
}
