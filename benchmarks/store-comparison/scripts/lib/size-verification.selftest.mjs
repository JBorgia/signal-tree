import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { verifyBundle, PRODUCTION_DEFINE } from './size-verification.mjs';

function fixture(t, bytes, expected) {
  const directory = mkdtempSync(join(import.meta.dirname, '.verify-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return verifyBundle(bytes, {
    directory,
    name: 'fixture',
    expected,
    preloads: [],
  });
}

test('wrong-result fixture is rejected, never accepted for size reporting', (t) => {
  assert.throws(
    () => fixture(t, 'globalThis.__result = {count: 1};', { count: 2 }),
    /result mismatch/
  );
});
test('missing-result fixture is rejected', (t) => {
  assert.throws(
    () => fixture(t, 'void 0;', null),
    /fixture did not set __result/
  );
});
test('exact fixture bytes execute async in production with order-insensitive object comparison', (t) => {
  const got = fixture(
    t,
    `globalThis.__done = Promise.resolve().then(() => {
    globalThis.__result = {env: process.env.NODE_ENV, dev: globalThis.ngDevMode};
  });`,
    { dev: false, env: 'production' }
  );
  assert.deepEqual(got, { env: 'production', dev: false });
  assert.deepEqual(PRODUCTION_DEFINE, {
    ngDevMode: 'false',
    'process.env.NODE_ENV': '"production"',
  });
});
