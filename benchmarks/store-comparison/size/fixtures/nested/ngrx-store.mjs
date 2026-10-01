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

const setCity = createAction('[Nested] Set City', props());
const setAddress = createAction('[Nested] Set Address', props());
const setAge = createAction('[Nested] Set Age', props());

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

const store = createEnvironmentInjector(
  [provideStore({ [nestedFeature.name]: nestedFeature.reducer })],
  Injector.NULL
).get(Store);
store.dispatch(setCity({ city: 'Y' }));
store.dispatch(setAddress({ address: { city: 'Z', zip: '2' } }));
store.dispatch(setAge({ age: 2 }));
const { profile, age } = store.selectSignal(nestedFeature.selectUser)();
globalThis.__result = {
  city: profile.address.city,
  zip: profile.address.zip,
  age,
  tags: [...profile.tags],
};
