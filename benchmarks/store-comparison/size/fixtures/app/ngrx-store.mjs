import { Injector, createEnvironmentInjector } from '@angular/core';
import { createEntityAdapter } from '@ngrx/entity';
import {
  Store,
  createAction,
  createFeature,
  createReducer,
  createSelector,
  on,
  props,
  provideStore,
} from '@ngrx/store';

const adapter = createEntityAdapter();

const setCount = createAction('[App] Set Count', props());
const setActive = createAction('[App] Set Active', props());
const setName = createAction('[App] Set Name', props());
const setCity = createAction('[App] Set City', props());
const setAddress = createAction('[App] Set Address', props());
const setAge = createAction('[App] Set Age', props());
const setAll = createAction('[App] Set All', props());
const addOne = createAction('[App] Add', props());
const rename = createAction('[App] Rename', props());
const removeOne = createAction('[App] Remove', props());
const setQty = createAction('[App] Set Qty', props());
const loadStart = createAction('[App] Load Start');
const loadSuccess = createAction('[App] Load Success', props());
const loadFailure = createAction('[App] Load Failure', props());

const appFeature = createFeature({
  name: 'app',
  reducer: createReducer(
    adapter.getInitialState({
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
    on(setCount, (s, { count }) => ({ ...s, count })),
    on(setActive, (s, { active }) => ({ ...s, active })),
    on(setName, (s, { name }) => ({ ...s, name })),
    on(setCity, (s, { city }) => ({
      ...s,
      user: {
        ...s.user,
        profile: {
          ...s.user.profile,
          address: { ...s.user.profile.address, city },
        },
      },
    })),
    on(setAddress, (s, { address }) => ({
      ...s,
      user: { ...s.user, profile: { ...s.user.profile, address } },
    })),
    on(setAge, (s, { age }) => ({ ...s, user: { ...s.user, age } })),
    on(setAll, (s, { all }) => adapter.setAll(all, s)),
    on(addOne, (s, { entity }) => adapter.addOne(entity, s)),
    on(rename, (s, { id, name }) =>
      adapter.updateOne({ id, changes: { name } }, s)
    ),
    on(removeOne, (s, { id }) => adapter.removeOne(id, s)),
    on(setQty, (s, { qty }) => ({ ...s, qty })),
    on(loadStart, (s) => ({ ...s, status: 'loading' })),
    on(loadSuccess, (s, { data }) => ({ ...s, data, status: 'loaded' })),
    on(loadFailure, (s, { error }) => ({ ...s, status: 'error', error }))
  ),
  extraSelectors: ({ selectAppState, selectPrices, selectQty }) => {
    const selectTotal = createSelector(
      selectPrices,
      selectQty,
      (prices, qty) => prices.reduce((a, b) => a + b, 0) * qty
    );
    return {
      ...adapter.getSelectors(selectAppState),
      selectTotal,
      selectExpensive: createSelector(selectTotal, (total) => total > 10),
    };
  },
});

const store = createEnvironmentInjector(
  [provideStore({ [appFeature.name]: appFeature.reducer })],
  Injector.NULL
).get(Store);
const sel = (selector) => store.selectSignal(selector)();

store.dispatch(setCount({ count: 2 }));
store.dispatch(setActive({ active: true }));
store.dispatch(setName({ name: 'b' }));
store.dispatch(setCity({ city: 'Y' }));
store.dispatch(setAddress({ address: { city: 'Z', zip: '2' } }));
store.dispatch(setAge({ age: 2 }));
store.dispatch(
  setAll({
    all: [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 3, name: 'c' },
    ],
  })
);
store.dispatch(addOne({ entity: { id: 4, name: 'd' } }));
store.dispatch(rename({ id: 2, name: 'B' }));
store.dispatch(removeOne({ id: 3 }));
store.dispatch(setQty({ qty: 3 }));
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
  const { profile, age } = sel(appFeature.selectUser);
  globalThis.__result = {
    flat: {
      name: sel(appFeature.selectName),
      count: sel(appFeature.selectCount),
      active: sel(appFeature.selectActive),
      note: sel(appFeature.selectNote),
      at: sel(appFeature.selectAt),
    },
    nested: {
      city: profile.address.city,
      zip: profile.address.zip,
      age,
      tags: [...profile.tags],
    },
    entities: {
      ids: [...sel(appFeature.selectIds)],
      two: { ...sel(appFeature.selectEntities)[2] },
      all: sel(appFeature.selectAll).map((e) => ({ ...e })),
    },
    derived: {
      total: sel(appFeature.selectTotal),
      expensive: sel(appFeature.selectExpensive),
    },
    async: {
      status: sel(appFeature.selectStatus),
      data: [...sel(appFeature.selectData)],
      error: sel(appFeature.selectError),
    },
  };
})();
