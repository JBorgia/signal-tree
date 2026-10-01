import { Injector, createEnvironmentInjector } from '@angular/core';
import {
  Store,
  createAction,
  createFeature,
  createReducer,
  on,
  props,
  provideStore,
} from '@ngrx/store';

const append = createAction('[Arrays] Append', props());
const replace = createAction('[Arrays] Replace', props());

const arraysFeature = createFeature({
  name: 'arrays',
  reducer: createReducer(
    { items: [{ id: 1, v: 'a' }] },
    on(append, (s, { item }) => ({ items: [...s.items, item] })),
    on(replace, (s, { item }) => ({
      items: s.items.map((i) => (i.id === item.id ? item : i)),
    }))
  ),
});

const store = createEnvironmentInjector(
  [provideStore({ [arraysFeature.name]: arraysFeature.reducer })],
  Injector.NULL
).get(Store);
store.dispatch(append({ item: { id: 2, v: 'b' } }));
store.dispatch(replace({ item: { id: 1, v: 'c' } }));
globalThis.__result = {
  items: structuredClone(store.selectSignal(arraysFeature.selectItems)()),
};
