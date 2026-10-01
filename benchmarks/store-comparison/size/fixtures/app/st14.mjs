import { signalTree, entityMap } from '@signaltree/core';
import { computed } from '@angular/core';

const tree = signalTree({
  flat: { name: 'a', count: 0, active: false, note: null, at: 0 },
  nested: {
    user: {
      profile: { address: { city: 'X', zip: '1' }, tags: ['t'] },
      age: 1,
    },
  },
  users: entityMap(),
  prices: [3, 4],
  qty: 2,
  req: { status: 'idle', data: null, error: null },
})
  .derived(($) => ({
    total: computed(() => $.prices().reduce((a, b) => a + b, 0) * $.qty()),
  }))
  .derived(($) => ({
    expensive: computed(() => $.total() > 10),
  }));
const $ = tree.$;

async function load() {
  $.req.status.set('loading');
  $.req.data.set(await Promise.resolve([1, 2]));
  $.req.status.set('loaded');
}
async function fail() {
  $.req.status.set('loading');
  try {
    await Promise.reject(new Error('boom'));
  } catch (e) {
    $.req.error.set(e.message);
    $.req.status.set('error');
  }
}

$.flat.count.set(2);
$.flat.active.set(true);
$.flat.name.set('b');

$.nested.user.profile.address.city.set('Y');
$.nested.user.profile.address({ city: 'Z', zip: '2' });
$.nested.user.age.set(2);

$.users.setAll([
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 3, name: 'c' },
]);
$.users.addOne({ id: 4, name: 'd' });
$.users.updateOne(2, { name: 'B' });
$.users.removeOne(3);

$.qty.set(3);

globalThis.__done = (async () => {
  await load();
  await fail();
  const { profile, age } = $.nested.user();
  globalThis.__result = {
    flat: { ...$.flat() },
    nested: {
      city: profile.address.city,
      zip: profile.address.zip,
      age,
      tags: [...profile.tags],
    },
    entities: {
      ids: [...$.users.ids()],
      two: { ...$.users.byId(2)() },
      all: $.users.all().map((e) => ({ ...e })),
    },
    derived: { total: $.total(), expensive: $.expensive() },
    async: {
      status: $.req.status(),
      data: [...$.req.data()],
      error: $.req.error(),
    },
  };
})();
