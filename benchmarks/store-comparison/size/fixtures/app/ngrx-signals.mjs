import { Injector, computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  addEntity,
  removeEntity,
  setAllEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';

const Store = signalStore(
  withState({
    name: 'a',
    count: 0,
    active: false,
    note: null,
    at: 0,
    user: {
      profile: { address: { city: 'X', zip: '1' }, tags: ['t'] },
      age: 1,
    },
    prices: [3, 4],
    qty: 2,
    status: 'idle',
    data: null,
    error: null,
  }),
  withEntities(),
  withComputed(({ prices, qty }) => {
    const total = computed(() => prices().reduce((a, b) => a + b, 0) * qty());
    return { total, expensive: computed(() => total() > 10) };
  }),
  withMethods((store) => ({
    setCount: (count) => patchState(store, { count }),
    setActive: (active) => patchState(store, { active }),
    setName: (name) => patchState(store, { name }),
    setCity: (city) =>
      patchState(store, ({ user }) => ({
        user: {
          ...user,
          profile: {
            ...user.profile,
            address: { ...user.profile.address, city },
          },
        },
      })),
    setAddress: (address) =>
      patchState(store, ({ user }) => ({
        user: { ...user, profile: { ...user.profile, address } },
      })),
    setAge: (age) =>
      patchState(store, ({ user }) => ({ user: { ...user, age } })),
    setAll: (all) => patchState(store, setAllEntities(all)),
    add: (e) => patchState(store, addEntity(e)),
    rename: (id, name) =>
      patchState(store, updateEntity({ id, changes: { name } })),
    remove: (id) => patchState(store, removeEntity(id)),
    setQty: (qty) => patchState(store, { qty }),
    async load() {
      patchState(store, { status: 'loading' });
      const data = await Promise.resolve([1, 2]);
      patchState(store, { data, status: 'loaded' });
    },
    async fail() {
      try {
        await Promise.reject('boom');
      } catch (error) {
        patchState(store, { status: 'error', error });
      }
    },
  }))
);

const store = Injector.create({ providers: [Store] }).get(Store);
store.setCount(2);
store.setActive(true);
store.setName('b');
store.setCity('Y');
store.setAddress({ city: 'Z', zip: '2' });
store.setAge(2);
store.setAll([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 3, name: 'c' },
]);
store.add({ id: 4, name: 'd' });
store.rename(2, 'B');
store.remove(3);
store.setQty(3);
globalThis.__done = (async () => {
  await store.load();
  await store.fail();
  const { user } = store;
  globalThis.__result = {
    flat: {
      name: store.name(),
      count: store.count(),
      active: store.active(),
      note: store.note(),
      at: store.at(),
    },
    nested: {
      city: user.profile.address.city(),
      zip: user.profile.address.zip(),
      age: user.age(),
      tags: [...user.profile.tags()],
    },
    entities: {
      ids: [...store.ids()],
      two: { ...store.entityMap()[2] },
      all: store.entities().map((e) => ({ ...e })),
    },
    derived: { total: store.total(), expensive: store.expensive() },
    async: {
      status: store.status(),
      data: [...store.data()],
      error: store.error(),
    },
  };
})();
