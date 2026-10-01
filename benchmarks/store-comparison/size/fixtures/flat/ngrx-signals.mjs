import { Injector } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

const Store = signalStore(
  withState({ name: 'a', count: 0, active: false, note: null, at: 0 }),
  withMethods((store) => ({
    setCount: (count) => patchState(store, { count }),
    setActive: (active) => patchState(store, { active }),
    setName: (name) => patchState(store, { name }),
  }))
);

const store = Injector.create({ providers: [Store] }).get(Store);
store.setCount(2);
store.setActive(true);
store.setName('b');
globalThis.__result = {
  name: store.name(),
  count: store.count(),
  active: store.active(),
  note: store.note(),
  at: store.at(),
};
