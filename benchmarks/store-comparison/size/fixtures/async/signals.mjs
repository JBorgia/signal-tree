import { signal } from '@angular/core';

const status = signal('idle');
const data = signal(null);
const error = signal(null);

async function load() {
  status.set('loading');
  data.set(await Promise.resolve([1, 2]));
  status.set('loaded');
}
async function fail() {
  status.set('loading');
  try {
    await Promise.reject(new Error('boom'));
  } catch (e) {
    error.set(e.message);
    status.set('error');
  }
}

globalThis.__done = (async () => {
  await load();
  await fail();
  globalThis.__result = { status: status(), data: data(), error: error() };
})();
