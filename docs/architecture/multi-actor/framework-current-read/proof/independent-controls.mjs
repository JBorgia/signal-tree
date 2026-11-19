// Run with pinned Node; the optional argument selects a candidate checkout.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const base = process.argv[2] ?? '/private/tmp/st-current-read-capability-proof';
const require = createRequire(base + '/package.json');
const a = await import(pathToFileURL(require.resolve('@angular/core')));
const v = await import(pathToFileURL(require.resolve('vue')));
const { SIGNAL, createWatch } = await import(pathToFileURL(require.resolve('@angular/core/primitives/signals')));
const { ANGULAR_OBSERVATION_ADAPTER } = await import(pathToFileURL(base + '/packages/angular/src/lib/observation-adapter.ts'));
const { createVueObservationAdapter } = await import(pathToFileURL(base + '/packages/vue/src/lib/vue-observation.ts'));
for (const framework of ['angular', 'vue']) {
  {
    const angular = framework === 'angular';
    let raw = 'X', reads = 0;
    const left = angular ? a.signal(0) : v.shallowRef(0);
    const right = angular ? a.signal(0) : v.shallowRef(0);
    const branch = angular ? a.signal(true) : v.shallowRef(true);
    const value = x => angular ? x() : x.value;
    const source = () => { reads++; value(value(branch) ? left : right); return raw; };
    const cell = (angular ? ANGULAR_OBSERVATION_ADAPTER : createVueObservationAdapter()).createCurrentReadonlyCell(source);
    assert.equal(reads, 0);
    const metadata = () => angular ? cell[SIGNAL] : cell.effect;
    const identity = metadata(); assert.equal(reads, 0);
    const read = () => angular ? cell() : cell.value;
    assert.equal(read(), 'X'); assert.equal(reads, 1);
    assert.equal(read(), 'X'); assert.equal(reads, 2);
    assert.equal(metadata(), identity);
    if (angular) { assert.equal(a.isSignal(cell), true); assert.equal('set' in cell, false); }
    else {
      assert.equal(v.isRef(cell), true); assert.equal(v.isReadonly(cell), true);
      assert.equal(Reflect.set(cell, 'value', 'BAD'), false);
      assert.equal(cell(), 'X'); assert.equal(cell.value, 'X');
    }
    const seen = [], scheduled = new Set();
    let stop;
    if (angular) {
      const watcher = createWatch(() => seen.push(read()), w => scheduled.add(w), false);
      watcher.run(); stop = () => watcher.destroy();
    } else stop = v.watchEffect(() => seen.push(read()), { flush: 'sync' });
    const flush = () => { for (const watcher of scheduled) watcher.run(); scheduled.clear(); };
    const bump = x => { if (angular) x.update(n => n + 1); else x.value++; flush(); };
    assert.deepEqual(seen, ['X']);
    raw = 'A'; assert.equal(read(), 'A'); raw = 'C'; assert.equal(read(), 'C');
    assert.deepEqual(seen, ['X']); bump(left); assert.deepEqual(seen, ['X', 'C']);
    if (angular) branch.set(false); else branch.value = false; flush();
    const afterSwitch = seen.length;
    bump(left); assert.equal(seen.length, afterSwitch);
    raw = 'D'; bump(right); assert.equal(seen.at(-1), 'D'); assert.ok(seen.length > afterSwitch);
    stop(); const terminal = seen.length; raw = 'E'; bump(right); assert.equal(seen.length, terminal);
    assert.equal(metadata(), identity);
    console.log(JSON.stringify({ framework, control: 'candidate-lazy-readonly-tracking-switch-disposal-identity', result: 'PASS' }));
  }
  for (const variant of ['native-only-control', 'tracked-source-control', 'candidate']) {
    const angular = framework === 'angular';
    let raw = 'X';
    const epoch = angular ? a.signal(0) : v.shallowRef(0);
    const source = () => { if (angular) epoch(); else void epoch.value; return raw; };
    const derive = fn => angular ? a.computed(fn) : v.computed(fn);
    const value = x => angular ? x() : x.value;
    const publish = () => { if (angular) epoch.update(x => x + 1); else epoch.value++; };
    const native = derive(source);
    let cell;
    if (variant === 'candidate') {
      cell = (angular ? ANGULAR_OBSERVATION_ADAPTER : createVueObservationAdapter()).createCurrentReadonlyCell(source);
    } else {
      const direct = () => { value(native); return variant === 'native-only-control' ? (angular ? a.untracked(source) : raw) : source(); };
      cell = angular ? new Proxy(native, { apply: direct }) : new Proxy(native, { get(t, p) { return p === 'value' ? direct() : Reflect.get(t, p, t); } });
    }
    const read = () => angular ? cell() : cell.value;
    const metadata = () => angular ? cell[SIGNAL] : cell.effect;
    const identity = metadata();
    assert.notEqual(identity, undefined);
    let runs = 0;
    const warm = derive(() => { runs++; return read(); });
    assert.equal(value(warm), 'X');
    raw = 'A'; assert.equal(read(), 'A'); raw = 'C'; assert.equal(read(), 'C');
    assert.equal(value(warm), 'X'); assert.equal(runs, 1);
    const born = derive(read); assert.equal(value(born), 'C');
    raw = 'X'; publish();
    const observed = value(born);
    assert.equal(observed, variant === 'native-only-control' ? 'C' : 'X');
    assert.equal(metadata(), identity);
    console.log(JSON.stringify({ framework, variant, control: 'held-ABA-new-consumer', observed, correctValue: 'X', knownBad: variant === 'native-only-control' }));
  }
  for (const variant of ['native-first-control', 'candidate']) {
    const angular = framework === 'angular';
    let bad = true;
    const epoch = angular ? a.signal(0) : v.shallowRef(0);
    const source = () => { if (angular) epoch(); else void epoch.value; if (bad) throw new Error('bad source'); return 'good'; };
    const native = angular ? a.computed(source) : v.computed(source);
    const cell = variant === 'candidate' ? (angular ? ANGULAR_OBSERVATION_ADAPTER : createVueObservationAdapter()).createCurrentReadonlyCell(source) : undefined;
    const read = cell ? () => angular ? cell() : cell.value : () => { if (angular) native(); else void native.value; return source(); };
    assert.throws(read, /bad source/);
    bad = false;
    let observed;
    try { observed = read(); } catch (error) { observed = 'throws ' + error.message; }
    const knownBad = angular && variant === 'native-first-control';
    assert.equal(observed, knownBad ? 'throws bad source' : 'good');
    console.log(JSON.stringify({ framework, variant, control: 'cached-error-recovery', observed, correctValue: 'good', knownBad }));
  }
}
