import { signalTree } from '__ST15__';

const tree = signalTree({
  user: { profile: { address: { city: 'X', zip: '1' }, tags: ['t'] }, age: 1 },
});
tree.$.user.profile.address.city.set('Y');
tree.$.user.profile.address({ city: 'Z', zip: '2' });
tree.$.user.age.set(2);

const { profile, age } = tree.$.user();
globalThis.__result = {
  city: profile.address.city,
  zip: profile.address.zip,
  age,
  tags: [...profile.tags],
};
