import { Injector } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

const Store = signalStore(
  withState({ items: [{ id: 1, v: 'a' }] }),
  withMethods((store) => ({
    append: (item) =>
      patchState(store, ({ items }) => ({ items: [...items, item] })),
    replace: (item) =>
      patchState(store, ({ items }) => ({
        items: items.map((i) => (i.id === item.id ? item : i)),
      })),
  }))
);

const store = Injector.create({ providers: [Store] }).get(Store);
store.append({ id: 2, v: 'b' });
store.replace({ id: 1, v: 'c' });
globalThis.__result = { items: structuredClone(store.items()) };
