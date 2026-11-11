import { DestroyRef, computed, inject, signal } from '@angular/core';
import {
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

  // Private application variant: retain one ordered native collection view.
  // Search changes only the Angular projection; title/toggle edits still update
  // the native query and can materialize all rows. Measure that tradeoff.
  const orderedQuery = injectLiveQuery((q) =>
    live()
      ? q
          .from({ entry: jobs })
          .orderBy(({ entry }) => entry.position, 'asc')
          .select(({ entry }) => ({ value: entry.value }))
      : undefined
  );
  const allRows = computed<readonly Job[]>(() =>
    live() ? orderedQuery.data().map((entry) => entry.value) : []
  );
  const filtered = computed(() => {
    const text = search();
    return allRows().filter((row) => row.title.toLowerCase().includes(text));
  });
  const visible = computed<readonly Job[]>(() =>
    filtered().slice(0, VISIBLE_ROWS)
  );

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
    const collection = orderedQuery.collection();
    live.set(false);
    selected.set(null);
    error.set(null);
    // The host destroys the session injector first, detaching query observers.
    // Retire the dependent view before its source collection.
    disposal = (collection ? collection.cleanup() : Promise.resolve()).then(
      () => jobs.cleanup()
    );
    return disposal;
  }
  inject(DestroyRef).onDestroy(destroy);

  return {
    kind: 'tanstack',
    query,
    selected,
    error,
    total: () => allRows().length,
    matched: () => filtered().length,
    visible,
    row: (id) => (live() ? jobs.get(id)?.value : undefined),
    filter(value) {
      if (!live() || value === query()) return;
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
