import { computed } from '@angular/core';
import { entityMap, leaf, signalTree } from '@signal-tree/angular';
import {
  addedJob,
  matches,
  normalizeTitle,
  titleError,
  VISIBLE_ROWS,
  type Inventory,
  type Job,
} from '../model';

// The same consumer source is compiled against each identified v15/v16 facade.
// No version branch, workspace alias, private entry point or optional enhancer.
export function createInventory(rows: readonly Job[]): Inventory {
  const tree = signalTree({
    rows: entityMap<Job, string>({ selectId: (row) => row.id }),
    query: '',
    selected: leaf<string | null>(null),
    error: leaf<string | null>(null),
  });
  tree.$.rows.setAll(rows.map((row) => ({ ...row })));
  let live = true;
  let next = 1;
  const filtered = computed(() => {
    const query = tree.$.query();
    return tree.$.rows.all().filter((row) => matches(row, query));
  });
  const visible = computed(() => filtered().slice(0, VISIBLE_ROWS));
  const rename = (id: string, title: string): void => {
    if (!live || !tree.$.rows.byId(id)) return;
    const value = normalizeTitle(title);
    tree.$.error.set(value ? null : titleError);
    if (value && tree.$.rows.byId(id))
      tree.$.rows.updateOne(id, { title: value });
  };
  return {
    kind: 'signaltree',
    query: () => tree.$.query(),
    selected: () => tree.$.selected(),
    error: () => tree.$.error(),
    total: () => tree.$.rows.count(),
    matched: () => filtered().length,
    visible,
    row: (id) => tree.$.rows.byId(id)?.(),
    filter(query) {
      if (live) tree.$.query.set(query);
    },
    select(id) {
      if (live)
        tree.$.selected.set(id !== null && !tree.$.rows.byId(id) ? null : id);
    },
    rename,
    toggle(id) {
      if (!live) return;
      const row = tree.$.rows.byId(id);
      if (row) row.active.set(!row.active());
    },
    add(title) {
      if (!live) return null;
      const value = normalizeTitle(title);
      tree.$.error.set(value ? null : titleError);
      if (!value) return null;
      let id: string;
      do {
        id = `J-new-${next++}`;
      } while (tree.$.rows.byId(id));
      tree.$.rows.addOne(addedJob(id, value));
      return id;
    },
    remove(id) {
      if (!live || !tree.$.rows.byId(id)) return;
      tree.$.rows.removeOne(id);
      if (tree.$.selected() === id) tree.$.selected.set(null);
    },
    replace(id, replacement) {
      if (!live) return;
      if (replacement.id !== id) throw new Error('Replacement ID mismatch');
      if (tree.$.rows.byId(id)) tree.$.rows.removeOne(id);
      tree.$.rows.addOne({ ...replacement });
      if (tree.$.selected() === id) tree.$.selected.set(null);
    },
    openEditor(id) {
      const held = tree.$.rows.byIdOrFail(id);
      return {
        rename(title) {
          if (!live) return;
          // Retained native row reference stays tied to its entity lifetime.
          // A retired editor is harmless; it must never look up a replacement.
          if (!held()) return;
          const value = normalizeTitle(title);
          tree.$.error.set(value ? null : titleError);
          if (value) held.title.set(value);
        },
      };
    },
    destroy() {
      if (!live) return;
      live = false;
      tree.destroy();
    },
  };
}
