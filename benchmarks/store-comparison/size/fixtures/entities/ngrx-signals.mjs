import { Injector } from '@angular/core';
import { patchState, signalStore, withMethods } from '@ngrx/signals';
import {
  addEntity,
  removeEntity,
  setAllEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';

const Store = signalStore(
  withEntities(),
  withMethods((store) => ({
    setAll: (all) => patchState(store, setAllEntities(all)),
    add: (e) => patchState(store, addEntity(e)),
    rename: (id, name) =>
      patchState(store, updateEntity({ id, changes: { name } })),
    remove: (id) => patchState(store, removeEntity(id)),
  }))
);

const store = Injector.create({ providers: [Store] }).get(Store);
store.setAll([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 3, name: 'c' },
]);
store.add({ id: 4, name: 'd' });
store.rename(2, 'B');
store.remove(3);
globalThis.__result = {
  ids: [...store.ids()],
  two: { ...store.entityMap()[2] },
  all: store.entities().map((e) => ({ ...e })),
};
