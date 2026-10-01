import { signalTree, entityMap } from '__ST15__';

const tree = signalTree({ users: entityMap({ selectId: (u) => u.id }) });
const users = tree.$.users;
users.setAll([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 3, name: 'c' },
]);
users.addOne({ id: 4, name: 'd' });
users.updateOne(2, { name: 'B' });
users.removeOne(3);

globalThis.__result = {
  ids: [...users.ids()],
  two: { ...users.byId(2)() },
  all: users.all().map((e) => ({ ...e })),
};
