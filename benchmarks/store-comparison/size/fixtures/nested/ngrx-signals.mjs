import { Injector } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

const Store = signalStore(
  withState({
    user: {
      profile: { address: { city: 'X', zip: '1' }, tags: ['t'] },
      age: 1,
    },
  }),
  withMethods((store) => ({
    setCity: (city) =>
      patchState(store, ({ user }) => ({
        user: {
          ...user,
          profile: {
            ...user.profile,
            address: { ...user.profile.address, city },
          },
        },
      })),
    setAddress: (address) =>
      patchState(store, ({ user }) => ({
        user: { ...user, profile: { ...user.profile, address } },
      })),
    setAge: (age) =>
      patchState(store, ({ user }) => ({ user: { ...user, age } })),
  }))
);

const store = Injector.create({ providers: [Store] }).get(Store);
store.setCity('Y');
store.setAddress({ city: 'Z', zip: '2' });
store.setAge(2);
const { user } = store;
globalThis.__result = {
  city: user.profile.address.city(),
  zip: user.profile.address.zip(),
  age: user.age(),
  tags: [...user.profile.tags()],
};
