import { signal, computed } from '@angular/core';

function createFlat() {
  return {
    name: signal('a'),
    count: signal(0),
    active: signal(false),
    note: signal(null),
    at: signal(0),
  };
}
function createNested() {
  return {
    user: signal({
      profile: { address: { city: 'X', zip: '1' }, tags: ['t'] },
      age: 1,
    }),
  };
}
function createEntities() {
  const all = signal([]);
  return {
    all,
    ids: computed(() => all().map((e) => e.id)),
    byId: (id) => computed(() => all().find((e) => e.id === id)),
  };
}

const flat = createFlat();
const nested = createNested();
const entities = createEntities();

flat.count.set(2);
flat.active.set(true);
flat.name.set('b');

nested.user.update((u) => ({
  ...u,
  profile: { ...u.profile, address: { ...u.profile.address, city: 'Y' } },
}));
nested.user.update((u) => ({
  ...u,
  profile: { ...u.profile, address: { city: 'Z', zip: '2' } },
}));
nested.user.update((u) => ({ ...u, age: 2 }));

entities.all.set([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 3, name: 'c' },
]);
entities.all.update((l) => [...l, { id: 4, name: 'd' }]);
entities.all.update((l) =>
  l.map((e) => (e.id === 2 ? { ...e, name: 'B' } : e))
);
entities.all.update((l) => l.filter((e) => e.id !== 3));

const { profile, age } = nested.user();
globalThis.__result = {
  flat: {
    name: flat.name(),
    count: flat.count(),
    active: flat.active(),
    note: flat.note(),
    at: flat.at(),
  },
  nested: {
    city: profile.address.city,
    zip: profile.address.zip,
    age,
    tags: [...profile.tags],
  },
  entities: {
    ids: [...entities.ids()],
    two: { ...entities.byId(2)() },
    all: entities.all().map((e) => ({ ...e })),
  },
};
