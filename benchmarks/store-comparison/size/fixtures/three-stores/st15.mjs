import { signalTree, entityMap } from '__ST15__';

const flat = signalTree({
  name: 'a',
  count: 0,
  active: false,
  note: null,
  at: 0,
});
const nested = signalTree({
  user: { profile: { address: { city: 'X', zip: '1' }, tags: ['t'] }, age: 1 },
});
const entities = signalTree({ users: entityMap({ selectId: (u) => u.id }) });

flat.$.count.set(2);
flat.$.active.set(true);
flat.$.name.set('b');

nested.$.user.profile.address.city.set('Y');
nested.$.user.profile.address({ city: 'Z', zip: '2' });
nested.$.user.age.set(2);

const users = entities.$.users;
users.setAll([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 3, name: 'c' },
]);
users.addOne({ id: 4, name: 'd' });
users.updateOne(2, { name: 'B' });
users.removeOne(3);

const { profile, age } = nested.$.user();
globalThis.__result = {
  flat: { ...flat.$() },
  nested: {
    city: profile.address.city,
    zip: profile.address.zip,
    age,
    tags: [...profile.tags],
  },
  entities: {
    ids: [...users.ids()],
    two: { ...users.byId(2)() },
    all: users.all().map((e) => ({ ...e })),
  },
};
