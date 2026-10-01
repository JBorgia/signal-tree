import { signal, computed } from '@angular/core';

// flat
const flat = {
  name: signal('a'),
  count: signal(0),
  active: signal(false),
  note: signal(null),
  at: signal(0),
};
// nested
const user = signal({
  profile: { address: { city: 'X', zip: '1' }, tags: ['t'] },
  age: 1,
});
// entities
const rows = signal([]);
const ids = computed(() => rows().map((e) => e.id));
const byId = (id) => computed(() => rows().find((e) => e.id === id));
// derived
const prices = signal([3, 4]);
const qty = signal(2);
const total = computed(() => prices().reduce((a, b) => a + b, 0) * qty());
const expensive = computed(() => total() > 10);
// async
const status = signal('idle');
const data = signal(null);
const error = signal(null);
async function load() {
  status.set('loading');
  data.set(await Promise.resolve([1, 2]));
  status.set('loaded');
}
async function fail() {
  status.set('loading');
  try {
    await Promise.reject(new Error('boom'));
  } catch (e) {
    error.set(e.message);
    status.set('error');
  }
}

flat.count.set(2);
flat.active.set(true);
flat.name.set('b');

user.update((u) => ({
  ...u,
  profile: { ...u.profile, address: { ...u.profile.address, city: 'Y' } },
}));
user.update((u) => ({
  ...u,
  profile: { ...u.profile, address: { city: 'Z', zip: '2' } },
}));
user.update((u) => ({ ...u, age: 2 }));

rows.set([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 3, name: 'c' },
]);
rows.update((l) => [...l, { id: 4, name: 'd' }]);
rows.update((l) => l.map((e) => (e.id === 2 ? { ...e, name: 'B' } : e)));
rows.update((l) => l.filter((e) => e.id !== 3));

qty.set(3);

globalThis.__done = (async () => {
  await load();
  await fail();
  const { profile, age } = user();
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
      ids: [...ids()],
      two: { ...byId(2)() },
      all: rows().map((e) => ({ ...e })),
    },
    derived: { total: total(), expensive: expensive() },
    async: { status: status(), data: data(), error: error() },
  };
})();
