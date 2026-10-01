/**
 * Point-in-time v14 audit probe, not a v15 gate or performance benchmark.
 * Usage: node tools/probe-v14-clear-notification.mjs <isolated-consumer> [clear|clear-tap|removeMany|setAll] [microtask|flushSync]
 * Consumer must have integrity-verified @signaltree/core@14.1.4 and its Angular peers.
 * Plain clear is expected to fail on that artifact; the three controls pass.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

assert.ok(process.argv[2], 'Supply the isolated installed consumer directory');
const require = createRequire(join(resolve(process.argv[2]), 'package.json'));
const load = name => import(pathToFileURL(require.resolve(name)).href);
await load('@angular/compiler');
const { signalTree, entityMap } = await load('@signaltree/core');
const { getPathNotifier } = await load('@signaltree/core/authoring');
const version = require('@signaltree/core/package.json').version;
assert.equal(version, '14.1.4');
const operation = process.argv[3] ?? 'clear';
const flush = process.argv[4] ?? 'microtask';
assert.ok(['clear', 'clear-tap', 'removeMany', 'setAll'].includes(operation));
assert.ok(['microtask', 'flushSync'].includes(flush));
const notifier = getPathNotifier();
const tree = signalTree({ rows: entityMap() });
const seed = [{ id: 'a', value: 1 }, { id: 'b', value: 2 }];
tree.$.rows.setAll(seed);
notifier.flushSync();
await Promise.resolve();
notifier.setBatchingEnabled(true);
assert.equal(notifier.isBatchingEnabled(), true);
assert.equal(notifier.hasPending(), false);
assert.equal(notifier.getSubscriberCount(), 0);
assert.equal(notifier.getInterceptorCount(), 0);

const untap = operation === 'clear-tap' ? tree.$.rows.tap({}) : () => {};
let unsubscribe = () => {};
try {
  // No path subscriber exists when the removal happens.
  if (operation === 'removeMany') tree.$.rows.removeMany(['a', 'b']);
  else if (operation === 'setAll') tree.$.rows.setAll([]);
  else tree.$.rows.clear();
  assert.equal(tree.$.rows.count(), 0);
  assert.equal(notifier.getSubscriberCount(), 0);
  const pendingBeforeSubscribe = notifier.hasPending();
  const events = [];
  // No await between mutation and subscription: attach before the queued flush.
  unsubscribe = notifier.subscribe('rows.*', (value, prev, path) => events.push({ value, prev, path }));
  assert.equal(events.length, 0);
  if (flush === 'flushSync') notifier.flushSync();
  else await Promise.resolve();
  console.log(JSON.stringify({
    version, operation, flush, subscribersAtMutation: 0,
    expectedRemovals: seed.length, actualRemovals: events.length,
    pendingBeforeSubscribe, collectionCount: tree.$.rows.count(),
    events: events.map(({ value, prev, path }) => ({ path, removed: value === undefined, prev })),
  }, null, 2));
  assert.deepEqual(events, seed.map(prev => ({ value: undefined, prev, path: `rows.${prev.id}` })));
} finally {
  unsubscribe(); untap(); tree.destroy();
  await Promise.resolve();
}
