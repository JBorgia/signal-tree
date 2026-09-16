import { signalTree } from '../signal-tree';
import { entityMap } from './entity-map';

export function computedSliceNames() {
  const rows = entityMap<{ id: number }, number>();
  // @ts-expect-error native readonly collection accessors cannot be replaced
  rows.computed('ids', (all) => all.map((row) => row.id));
  // @ts-expect-error native collection mutation methods cannot be replaced
  rows.computed('addOne', (all) => all.length);
  // @ts-expect-error native query methods cannot be replaced
  rows.computed('where', (all) => all.length);
  const union = '' as 'ids' | 'rowKeys';
  // @ts-expect-error a union that may collide must not bypass the boundary
  rows.computed(union, (all) => all.length);
  const tree = signalTree({
    rows: rows.computed('rowKeys', (all) => all.map((row) => row.id)),
  });
  const ids: number[] = tree.$.rows.ids();
  const rowKeys: number[] = tree.$.rows.rowKeys();
  return { tree, ids, rowKeys };
}
