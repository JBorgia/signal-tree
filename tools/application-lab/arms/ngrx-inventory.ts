import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  addEntity,
  removeAllEntities,
  removeEntity,
  setAllEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';

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

const InventoryStore = signalStore(
  withEntities<Job>(),
  withState({
    query: '',
    selected: null as string | null,
    error: null as string | null,
  }),
  withComputed((store) => {
    const filtered = computed(() => {
      const query = store.query();
      return store.entities().filter((row) => matches(row, query));
    });
    return {
      filtered,
      total: computed(() => store.ids().length),
      matched: computed(() => filtered().length),
      visible: computed(() => filtered().slice(0, VISIBLE_ROWS)),
    };
  }),
  withMethods((store) => {
    let live = true;
    let nextId = 1;
    // NgRx entities are addressed by ID. This app owns editor lifetimes; tokens
    // are allocated only for IDs whose editors are actually opened.
    const editors = new Map<string, object>();

    function rename(id: string, title: string): void {
      if (!live) return;
      const current = store.entityMap()[id];
      if (!current) return;
      const normalized = normalizeTitle(title);
      if (!normalized) {
        patchState(store, { error: titleError });
        return;
      }
      if (current.title === normalized) {
        patchState(store, { error: null });
      } else {
        patchState(
          store,
          updateEntity<Job>({ id, changes: { title: normalized } }),
          { error: null }
        );
      }
    }

    function dispose(): void {
      if (!live) return;
      live = false;
      editors.clear();
      patchState(store, removeAllEntities(), {
        query: '',
        selected: null,
        error: null,
      });
      // Drop cached row arrays as well as the entity state if a caller keeps the
      // disposed session handle to inspect its lifecycle result.
      store.filtered();
      store.visible();
      store.matched();
      store.total();
    }

    return {
      initialize(rows: readonly Job[]): void {
        if (live) {
          patchState(store, setAllEntities(rows.map((row) => ({ ...row }))));
        }
      },
      row(id: string): Job | undefined {
        return store.entityMap()[id];
      },
      filter(query: string): void {
        if (live) patchState(store, { query });
      },
      select(id: string | null): void {
        if (live) {
          patchState(store, {
            selected: id !== null && store.entityMap()[id] ? id : null,
          });
        }
      },
      rename,
      toggle(id: string): void {
        if (!live) return;
        const current = store.entityMap()[id];
        if (current) {
          patchState(
            store,
            updateEntity<Job>({ id, changes: { active: !current.active } })
          );
        }
      },
      add(title: string): string | null {
        if (!live) return null;
        const normalized = normalizeTitle(title);
        if (!normalized) {
          patchState(store, { error: titleError });
          return null;
        }
        let id: string;
        do id = `J-new-${nextId++}`;
        while (store.entityMap()[id]);
        patchState(store, addEntity(addedJob(id, normalized)), { error: null });
        return id;
      },
      remove(id: string): void {
        if (!live || !store.entityMap()[id]) return;
        editors.delete(id);
        patchState(store, removeEntity(id), {
          selected: store.selected() === id ? null : store.selected(),
        });
      },
      replace(id: string, replacement: Job): void {
        if (!live) return;
        if (replacement.id !== id) throw new Error('Replacement ID must match');
        editors.delete(id);
        patchState(store, removeEntity(id), addEntity({ ...replacement }), {
          selected: store.selected() === id ? null : store.selected(),
        });
      },
      openEditor(id: string): Editor {
        let token: object | undefined;
        if (live && store.entityMap()[id]) {
          token = editors.get(id);
          if (!token) {
            token = {};
            editors.set(id, token);
          }
        }
        return {
          rename(title) {
            if (live && token && editors.get(id) === token) rename(id, title);
          },
        };
      },
      dispose,
    };
  }),
  withHooks({ onDestroy: (store) => store.dispose() })
);

// The common host supplies a child EnvironmentInjector for each factory call.
// SignalStore's onDestroy hook belongs to that scope, not a root singleton.
export function createInventory(rows: readonly Job[]): Inventory {
  const store = new InventoryStore();
  store.initialize(rows);
  return {
    kind: 'ngrx',
    query: store.query,
    selected: store.selected,
    error: store.error,
    total: store.total,
    matched: store.matched,
    visible: store.visible,
    row: store.row,
    filter: store.filter,
    select: store.select,
    rename: store.rename,
    toggle: store.toggle,
    add: store.add,
    remove: store.remove,
    replace: store.replace,
    openEditor: store.openEditor,
    destroy: store.dispose,
  };
}
