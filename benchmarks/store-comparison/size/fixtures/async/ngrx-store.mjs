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

const loadStart = createAction('[Async] Load Start');
const loadSuccess = createAction('[Async] Load Success', props());
const loadFailure = createAction('[Async] Load Failure', props());

const asyncFeature = createFeature({
  name: 'async',
  reducer: createReducer(
    { status: 'idle', data: null, error: null },
    on(loadStart, (s) => ({ ...s, status: 'loading' })),
    on(loadSuccess, (s, { data }) => ({ ...s, data, status: 'loaded' })),
    on(loadFailure, (s, { error }) => ({ ...s, status: 'error', error }))
  ),
});

const store = createEnvironmentInjector(
  [provideStore({ [asyncFeature.name]: asyncFeature.reducer })],
  Injector.NULL
).get(Store);
// No @ngrx/effects: the async glue dispatches the lifecycle actions directly.
const load = async () => {
  store.dispatch(loadStart());
  store.dispatch(loadSuccess({ data: await Promise.resolve([1, 2]) }));
};
const fail = async () => {
  try {
    await Promise.reject('boom');
  } catch (error) {
    store.dispatch(loadFailure({ error }));
  }
};
globalThis.__done = (async () => {
  await load();
  await fail();
  const s = store.selectSignal(asyncFeature.selectAsyncState)();
  globalThis.__result = { status: s.status, data: [...s.data], error: s.error };
})();
