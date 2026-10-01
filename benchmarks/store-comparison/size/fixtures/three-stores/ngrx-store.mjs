// @ngrx/store has one root Store by design: three independent feature slices (own reducer, actions,
// selectors) registered on that single Store is the idiomatic equivalent of three stores.
import { Injector, createEnvironmentInjector } from '@angular/core';
import { createEntityAdapter } from '@ngrx/entity';
import {
  Store,
  createAction,
  createFeature,
  createReducer,
  on,
  props,
  provideStore,
} from '@ngrx/store';

const adapter = createEntityAdapter();

const setCount = createAction('[Flat] Set Count', props());
const setActive = createAction('[Flat] Set Active', props());
const setName = createAction('[Flat] Set Name', props());
const setCity = createAction('[Nested] Set City', props());
const setAddress = createAction('[Nested] Set Address', props());
const setAge = createAction('[Nested] Set Age', props());
const setAll = createAction('[Entities] Set All', props());
const addOne = createAction('[Entities] Add', props());
const rename = createAction('[Entities] Rename', props());
const removeOne = createAction('[Entities] Remove', props());

const flatFeature = createFeature({
  name: 'flat',
  reducer: createReducer(
    { name: 'a', count: 0, active: false, note: null, at: 0 },
    on(setCount, (s, { count }) => ({ ...s, count })),
    on(setActive, (s, { active }) => ({ ...s, active })),
    on(setName, (s, { name }) => ({ ...s, name }))
  ),
});

const nestedFeature = createFeature({
  name: 'nested',
  reducer: createReducer(
    {
      user: {
        profile: { address: { city: 'X', zip: '1' }, tags: ['t'] },
        age: 1,
      },
    },
    on(setCity, (s, { city }) => ({
      user: {
        ...s.user,
        profile: {
          ...s.user.profile,
          address: { ...s.user.profile.address, city },
        },
      },
    })),
    on(setAddress, (s, { address }) => ({
      user: { ...s.user, profile: { ...s.user.profile, address } },
    })),
    on(setAge, (s, { age }) => ({ user: { ...s.user, age } }))
  ),
});

const entitiesFeature = createFeature({
  name: 'entities',
  reducer: createReducer(
    adapter.getInitialState(),
    on(setAll, (s, { all }) => adapter.setAll(all, s)),
    on(addOne, (s, { entity }) => adapter.addOne(entity, s)),
    on(rename, (s, { id, name }) =>
      adapter.updateOne({ id, changes: { name } }, s)
    ),
    on(removeOne, (s, { id }) => adapter.removeOne(id, s))
  ),
});
const { selectIds, selectEntities, selectAll } = adapter.getSelectors(
  entitiesFeature.selectEntitiesState
);

const store = createEnvironmentInjector(
  [
    provideStore({
      [flatFeature.name]: flatFeature.reducer,
      [nestedFeature.name]: nestedFeature.reducer,
      [entitiesFeature.name]: entitiesFeature.reducer,
    }),
  ],
  Injector.NULL
).get(Store);

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
const { profile, age } = store.selectSignal(nestedFeature.selectUser)();
globalThis.__result = {
  flat: { ...store.selectSignal(flatFeature.selectFlatState)() },
  nested: {
    city: profile.address.city,
    zip: profile.address.zip,
    age,
    tags: [...profile.tags],
  },
  entities: {
    ids: [...store.selectSignal(selectIds)()],
    two: { ...store.selectSignal(selectEntities)()[2] },
    all: store
      .selectSignal(selectAll)()
      .map((e) => ({ ...e })),
  },
};
