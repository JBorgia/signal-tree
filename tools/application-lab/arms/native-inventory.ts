import {
  computed,
  DestroyRef,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';

import {
  addedJob,
  matches,
  normalizeTitle,
  titleError,
  VISIBLE_ROWS,
  type Editor,
  type Inventory,
  type Job,
} from '../model';

// One signal per row keeps a point edit from cloning the collection's index.
// Membership/order has its own signal; query work remains ordinary app work.
export function createInventory(rows: readonly Job[]): Inventory {
  const records = new Map<string, WritableSignal<Job>>();
  for (const row of rows) records.set(row.id, signal<Job>({ ...row }));
  const ids = signal<readonly string[]>(Array.from(records.keys()));
  const query = signal('');
  const selected = signal<string | null>(null);
  const error = signal<string | null>(null);
  let live = true;
  let nextId = 1;

  const filtered = computed(() => {
    const text = query();
    const result: Job[] = [];
    for (const id of ids()) {
      const value = records.get(id)?.();
      if (value && matches(value, text)) result.push(value);
    }
    return result;
  });
  const total = computed(() => ids().length);
  const matched = computed(() => filtered().length);
  const visible = computed(() => filtered().slice(0, VISIBLE_ROWS));

  function rename(id: string, title: string): void {
    if (!live) return;
    const record = records.get(id);
    if (!record) return;
    const normalized = normalizeTitle(title);
    if (!normalized) {
      error.set(titleError);
      return;
    }
    error.set(null);
    if (record().title !== normalized) {
      record.update((value) => ({ ...value, title: normalized }));
    }
  }

  function destroy(): void {
    if (!live) return;
    live = false;
    records.clear();
    ids.set([]);
    query.set('');
    selected.set(null);
    error.set(null);
    // A retained session handle should not keep the last computed row arrays.
    filtered();
    visible();
    matched();
    total();
  }
  inject(DestroyRef).onDestroy(destroy);

  return {
    kind: 'native',
    query,
    selected,
    error,
    total,
    matched,
    visible,
    row(id) {
      ids(); // Membership changes invalidate readers of a removed/replaced ID.
      return records.get(id)?.();
    },
    filter(text) {
      if (live) query.set(text);
    },
    select(id) {
      if (live) selected.set(id !== null && records.has(id) ? id : null);
    },
    rename,
    toggle(id) {
      if (!live) return;
      records.get(id)?.update((value) => ({ ...value, active: !value.active }));
    },
    add(title) {
      if (!live) return null;
      const normalized = normalizeTitle(title);
      if (!normalized) {
        error.set(titleError);
        return null;
      }
      let id: string;
      do id = `J-new-${nextId++}`;
      while (records.has(id));
      records.set(id, signal(addedJob(id, normalized)));
      ids.update((current) => [...current, id]);
      error.set(null);
      return id;
    },
    remove(id) {
      if (!live || !records.delete(id)) return;
      ids.update((current) => current.filter((value) => value !== id));
      if (selected() === id) selected.set(null);
    },
    replace(id, replacement) {
      if (!live) return;
      if (replacement.id !== id) throw new Error('Replacement ID must match');
      // A fresh carrier retires previously acquired editors even if the caller
      // accidentally supplies the same instance string for the new row.
      records.delete(id);
      records.set(id, signal<Job>({ ...replacement }));
      ids.update((current) => [...current.filter((value) => value !== id), id]);
      if (selected() === id) selected.set(null);
    },
    openEditor(id): Editor {
      const captured = records.get(id);
      return {
        rename(title) {
          if (live && captured && records.get(id) === captured)
            rename(id, title);
        },
      };
    },
    destroy,
  };
}
