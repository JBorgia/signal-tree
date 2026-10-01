import { signalTree } from '__ST15__';

const tree = signalTree({ items: [{ id: 1, v: 'a' }] });
tree.$.items.update((list) => [...list, { id: 2, v: 'b' }]);
tree.$.items.update((list) =>
  list.map((i) => (i.id === 1 ? { id: 1, v: 'c' } : i))
);

globalThis.__result = { items: tree.$.items().map((i) => ({ ...i })) };
