import { entityMap, leaf, link, signalTree, type SignalTree } from '../index';
type Row = { id: string; value: number };
const opaque = { marker: entityMap<Row, string>() };
const definition = {
  rows: entityMap<Row, string>(),
  nested: { rows: entityMap<Row, string>(), label: 'before' },
  opaque: leaf(opaque),
};
const tree = signalTree(definition);
const explicit = signalTree<typeof definition>(definition);
const rows: Row[] = [{ id: 'a', value: 1 }];
const snapshot = {
  rows: { all: rows },
  nested: { rows: { all: rows }, label: 'after' },
  opaque,
};
for (const store of [tree, explicit]) {
  const read: typeof snapshot = store.$();
  store.$(snapshot);
  store.$({ ...snapshot, rows });
  store.$.nested({ rows, label: 'after' });
  store.$.nested((current) => ({ ...current, rows: current.rows.all }));
  store.$((current) => {
    const opaqueRead: typeof opaque = current.opaque;
    return { ...current, opaque: opaqueRead, rows: current.rows.all };
  });
  // @ts-expect-error admission of collection-containing roots remains unchanged
  link(store.$, { get: () => snapshot });
  // @ts-expect-error admission of collection-containing branches remains unchanged
  link(store.$.nested, { subscribe: () => () => undefined });
  link(store.$.rows, {
    set: (value) => {
      const checked: Row[] = value;
      void checked;
    },
  });
  // @ts-expect-error hydration does not weaken row payloads
  store.$({ ...snapshot, rows: [{ id: 'a', value: 'wrong' }] });
  void read;
  store.destroy();
}
function annotated(store: SignalTree<typeof definition>) {
  const read: typeof snapshot = store.$();
  store.$(snapshot);
  store.$.nested({ rows, label: 'generic' });
  return read;
}
void annotated;

function generic<E extends Row>(row: E) {
  const store = signalTree({
    rows: entityMap<E, string>({ selectId: (value) => value.id }),
    branch: { label: 'generic' },
  });
  const read: E[] = store.$().rows.all;
  store.$({ rows: [row], branch: { label: 'generic' } });
  store.$((current) => ({ ...current, rows: current.rows.all }));
  link(store.$.branch, {
    set: (value) => {
      const label: string = value.label;
      void label;
    },
  });
  // @ts-expect-error generic construction does not expand root admission
  link(store.$, { subscribe: () => () => undefined });
  store.destroy();
  return read;
}
void generic;
