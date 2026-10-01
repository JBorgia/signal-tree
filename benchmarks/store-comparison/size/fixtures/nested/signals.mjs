import { signal } from '@angular/core';

const user = signal({
  profile: { address: { city: 'X', zip: '1' }, tags: ['t'] },
  age: 1,
});
user.update((u) => ({
  ...u,
  profile: { ...u.profile, address: { ...u.profile.address, city: 'Y' } },
}));
user.update((u) => ({
  ...u,
  profile: { ...u.profile, address: { city: 'Z', zip: '2' } },
}));
user.update((u) => ({ ...u, age: 2 }));

const { profile, age } = user();
globalThis.__result = {
  city: profile.address.city,
  zip: profile.address.zip,
  age,
  tags: [...profile.tags],
};
