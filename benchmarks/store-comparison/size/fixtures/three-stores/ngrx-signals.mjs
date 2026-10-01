import { Injector } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import {
  addEntity,
  removeEntity,
  setAllEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';

const FlatStore = signalStore(
  withState({ name: 'a', count: 0, active: false, note: null, at: 0 }),
  withMethods((store) => ({
    setCount: (count) => patchState(store, { count }),
    setActive: (active) => patchState(store, { active }),
    setName: (name) => patchState(store, { name }),
  }))
);

const NestedStore = signalStore(
  withState({
    user: {
      profile: { address: { city: 'X', zip: '1' }, tags: ['t'] },
      age: 1,
    },
  }),
  withMethods((store) => ({
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
  }))
);

const EntityStore = signalStore(
  withEntities(),
  withMethods((store) => ({
    setAll: (all) => patchState(store, setAllEntities(all)),
    add: (e) => patchState(store, addEntity(e)),
    rename: (id, name) =>
      patchState(store, updateEntity({ id, changes: { name } })),
    remove: (id) => patchState(store, removeEntity(id)),
  }))
);

const injector = Injector.create({
  providers: [FlatStore, NestedStore, EntityStore],
});
const flat = injector.get(FlatStore);
const nested = injector.get(NestedStore);
const ent = injector.get(EntityStore);

flat.setCount(2);
flat.setActive(true);
flat.setName('b');
nested.setCity('Y');
nested.setAddress({ city: 'Z', zip: '2' });
nested.setAge(2);
ent.setAll([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 3, name: 'c' },
]);
ent.add({ id: 4, name: 'd' });
ent.rename(2, 'B');
ent.remove(3);
const { user } = nested;
globalThis.__result = {
  flat: {
    name: flat.name(),
    count: flat.count(),
    active: flat.active(),
    note: flat.note(),
    at: flat.at(),
  },
  nested: {
    city: user.profile.address.city(),
    zip: user.profile.address.zip(),
    age: user.age(),
    tags: [...user.profile.tags()],
  },
  entities: {
    ids: [...ent.ids()],
    two: { ...ent.entityMap()[2] },
    all: ent.entities().map((e) => ({ ...e })),
  },
};
