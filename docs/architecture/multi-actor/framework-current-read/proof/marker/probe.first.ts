import assert from 'node:assert/strict';
import {computed, signal, isSignal, type Signal} from '@angular/core';
import {SIGNAL, createWatch} from '@angular/core/primitives/signals';
import {computed as computedV, shallowRef, watchEffect, effectScope, isRef, isReadonly, type ComputedRef} from 'vue';

// One native producer; marker frames are per invocation, restored even on throw.
function marker<T, C>(readCurrent: () => T, make: (recipe: () => T) => {carrier: C; get: () => T}) {
  let active: {evaluated: boolean} | undefined;
  const native = make(() => {
    if (active) active.evaluated = true;
    return readCurrent();
  });
  return {carrier: native.carrier, read() {
    const previous = active, frame = {evaluated: false}; active = frame;
    try {
      const value = native.get(); // always establish the actual native producer edge
      return frame.evaluated ? value : readCurrent();
    } finally { active = previous; }
  }};
}
function angular<T>(recipe: () => T): Signal<T> {
  const {carrier, read} = marker(recipe, wrapped => {
    const native = computed(wrapped); return {carrier: native, get: native};
  });
  return new Proxy(carrier, {apply: read});
}
function vue<T>(recipe: () => T): ComputedRef<T> {
  const {carrier, read} = marker(recipe, wrapped => {
    const native = computedV(wrapped); return {carrier: native, get: () => native.value};
  });
  return new Proxy(carrier, {get(target, key) { return key === 'value' ? read() : Reflect.get(target, key, target); }});
}
for (const framework of ['angular', 'vue']) {
  const epochA = signal(0), epochV = shallowRef(0);
  let raw = 'X', runs = 0, appRuns = 0, fail = false;
  let last: {id: string; serial: number} | undefined;
  const recipe = () => {
    runs++;
    if (framework === 'angular') epochA(); else void epochV.value;
    if (fail) throw new Error('recipe failure');
    return last = {id: raw, serial: runs};
  };
  const a = framework === 'angular' ? angular(recipe) : undefined;
  const v = framework === 'vue' ? vue(recipe) : undefined;
  const read = () => a ? a() : v!.value;
  const metadata = () => a ? a[SIGNAL] : v!.effect;
  const stable = metadata(); assert.equal(runs, 0);
  const first = read(); assert.equal(first, last); assert.equal(runs, 1);
  const second = read(); assert.equal(second, last); assert.notEqual(second, first); assert.equal(runs, 2);
  const appA = a ? computed(() => {appRuns++; return read();}) : undefined;
  const appV = v ? computedV(() => {appRuns++; return read();}) : undefined;
  const app = () => appA ? appA() : appV!.value;
  const warmed = app(); assert.equal(warmed.id, 'X');
  raw = 'A'; let before = runs; const restored = read(); assert.equal(runs - before, 1);
  assert.equal(restored.id, 'A'); assert.equal(restored, last);
  raw = restored.id === 'A' ? 'C' : 'WRONG'; before = runs;
  const newer = read(); assert.equal(newer.id, 'C'); assert.equal(newer, last); assert.equal(runs - before, 1);
  assert.equal(app(), warmed); assert.equal(appRuns, 1); assert.equal(metadata(), stable);
  const queued = new Set<ReturnType<typeof createWatch>>();
  const publish = () => {
    if (a) {epochA.update(n => n + 1); for (const w of queued) w.run(); queued.clear();}
    else epochV.value++;
  };
  publish(); before = runs; const published = read();
  assert.equal(published.id, 'C'); assert.equal(published, last); assert.equal(runs - before, 1);
  assert.equal(app().id, 'C');
  let observed = 0, cleaned = 0; let stop: () => void;
  if (a) {
    assert.equal(isSignal(a), true); assert.equal('set' in a, false);
    const w = createWatch(cleanup => {observed++; read(); cleanup(() => cleaned++);}, w => queued.add(w), false);
    w.run(); stop = () => w.destroy();
  } else {
    assert.equal(isRef(v), true); assert.equal(isReadonly(v), true);
    const scope = effectScope(); scope.run(() => watchEffect(cleanup => {
      observed++; read(); cleanup(() => cleaned++);
    }, {flush: 'sync'})); stop = () => scope.stop();
  }
  assert.equal(observed, 1); raw = 'D'; publish(); assert.equal(observed, 2); assert.equal(cleaned, 1);
  stop(); assert.equal(cleaned, 2); publish(); assert.equal(observed, 2);
  // Force a native evaluation which throws; next raw recovery has no publication.
  fail = true; assert.throws(read, /recipe failure/); fail = false;
  let recoveredWithoutPublication = false, recoveryError = '';
  try { recoveredWithoutPublication = read().id === 'D'; }
  catch (error) { recoveryError = error instanceof Error ? error.message : String(error); }
  publish(); assert.equal(read().id, 'D'); assert.equal(metadata(), stable);
  // Nested wrappers each run their recipe exactly once, including first evaluation.
  let innerRuns = 0, outerRuns = 0;
  const innerRecipe = () => {innerRuns++; return {value: 'nested'};};
  const innerA = a ? angular(innerRecipe) : undefined, innerV = v ? vue(innerRecipe) : undefined;
  const outerRecipe = () => {outerRuns++; return innerA ? innerA() : innerV!.value;};
  const outerA = a ? angular(outerRecipe) : undefined, outerV = v ? vue(outerRecipe) : undefined;
  assert.equal((outerA ? outerA() : outerV!.value).value, 'nested');
  assert.equal(innerRuns, 1); assert.equal(outerRuns, 1);
  console.log(JSON.stringify({framework, firstRecipeCalls:1, cacheHitRecipeCalls:1,
    invalidatedRecipeCalls:1, objectIdentity:'exact recipe result', heldDirect:'A,C',
    heldApp:'X', publishedApp:'C', metadataStable:metadata() === stable,
    observed, cleaned, innerRuns, outerRuns, recoveredWithoutPublication, recoveryError}));
}
