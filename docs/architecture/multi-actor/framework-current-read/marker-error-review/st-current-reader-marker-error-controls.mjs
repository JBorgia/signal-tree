import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const base = process.argv[2] ?? '/private/tmp/st-current-read-capability-proof';
const require = createRequire(base + '/package.json');
const a = await import(pathToFileURL(require.resolve('@angular/core')));
const v = await import(pathToFileURL(require.resolve('vue')));
const { ANGULAR_OBSERVATION_ADAPTER } = await import(pathToFileURL(base + '/packages/angular/src/lib/observation-adapter.ts'));
const { createVueObservationAdapter } = await import(pathToFileURL(base + '/packages/vue/src/lib/vue-observation.ts'));

// Positive controls: source-thrown error identity, exactly one source execution,
// and source recovery with no publication. These do not prove polling errors safe.
for (const framework of ['angular', 'vue']) {
  let calls = 0, failure = { message: 'first exact source error' };
  const source = () => { calls++; if (failure) throw failure; return 'recovered'; };
  const cell = (framework === 'angular' ? ANGULAR_OBSERVATION_ADAPTER : createVueObservationAdapter()).createCurrentReadonlyCell(source);
  const read = () => framework === 'angular' ? cell() : cell.value;
  for (const expected of [failure, { message: 'second exact source error' }]) {
    failure = expected;
    let caught; try { read(); } catch (error) { caught = error; }
    assert.equal(caught, expected);
  }
  assert.equal(calls, 2);
  failure = undefined; assert.equal(read(), 'recovered'); assert.equal(calls, 3);
  console.log(JSON.stringify({ framework, control: 'fresh-error-identity-and-recovery', result: 'PASS', sourceCalls: calls }));
}

// Falsifier: error occurs while Vue refreshes a dependency in isDirty(), before
// the outer recipe runs. The candidate must not classify it as an old cached error.
let failures = 0;
for (const variant of ['native', 'candidate']) {
  const epoch = v.shallowRef(0);
  let raw = 'X', fail = false, innerRuns = 0, sourceRuns = 0;
  const sentinel = new Error('fresh dependency failure');
  const inner = v.computed(() => {
    innerRuns++; void epoch.value;
    if (fail) { fail = false; throw sentinel; }
    return raw;
  });
  const readCurrent = () => { sourceRuns++; return inner.value; };
  const cell = variant === 'native' ? v.computed(readCurrent) : createVueObservationAdapter().createCurrentReadonlyCell(readCurrent);
  assert.equal(cell.value, 'X');
  raw = 'Y'; fail = true; epoch.value++;
  let caught, returned;
  try { returned = cell.value; } catch (error) { caught = error; }
  console.log(JSON.stringify({ framework: 'vue', variant, control: 'dependency-poll-error', returned, sameError: caught === sentinel, sourceRuns, innerRuns }));
  if (caught !== sentinel) failures++;
}
assert.equal(failures, 0, 'Fresh dependency error was suppressed by the invocation-marker fallback');
