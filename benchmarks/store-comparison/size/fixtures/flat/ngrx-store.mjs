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

const setCount = createAction('[Flat] Set Count', props());
const setActive = createAction('[Flat] Set Active', props());
const setName = createAction('[Flat] Set Name', props());

const flatFeature = createFeature({
  name: 'flat',
  reducer: createReducer(
    { name: 'a', count: 0, active: false, note: null, at: 0 },
    on(setCount, (s, { count }) => ({ ...s, count })),
    on(setActive, (s, { active }) => ({ ...s, active })),
    on(setName, (s, { name }) => ({ ...s, name }))
  ),
});

const injector = createEnvironmentInjector(
  [provideStore({ [flatFeature.name]: flatFeature.reducer })],
  Injector.NULL
);
const store = injector.get(Store);
store.dispatch(setCount({ count: 2 }));
store.dispatch(setActive({ active: true }));
store.dispatch(setName({ name: 'b' }));
globalThis.__result = { ...store.selectSignal(flatFeature.selectFlatState)() };
