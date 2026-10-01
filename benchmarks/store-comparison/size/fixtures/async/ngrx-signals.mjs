import { Injector } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

const Store = signalStore(
  withState({ status: 'idle', data: null, error: null }),
  withMethods((store) => ({
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
globalThis.__done = (async () => {
  await store.load();
  await store.fail();
  globalThis.__result = {
    status: store.status(),
    data: [...store.data()],
    error: store.error(),
  };
})();
