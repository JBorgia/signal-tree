import {computed, signal, isSignal} from '@angular/core';
import {SIGNAL, createWatch} from '@angular/core/primitives/signals';
import {expect, it} from 'vitest';
import {ANGULAR_OBSERVATION_ADAPTER as adapter} from './observation-adapter';
const state = <T>(value: T) => {const s = signal(value); return {read:s, set:s.set};};
const memo = computed;
const nativeRead = <T>(cell: () => T): T => cell();
const metadata = (cell: () => unknown): unknown => {if (!isSignal(cell)) throw new Error('not Signal'); return cell[SIGNAL];};
const checkReadonly = (cell: () => unknown) => {expect(isSignal(cell)).toBe(true); expect('set' in cell).toBe(false);};
const queued = new Set<ReturnType<typeof createWatch>>();
const flush = () => {for (const w of queued) w.run(); queued.clear();};
const observe = (read: (cleanup: (fn: () => void) => void) => void) => {
  const w = createWatch(read, w => queued.add(w), false); w.run(); return () => w.destroy();
};

const current = <T>(read: () => T) => {
  if (!adapter.createCurrentReadonlyCell) throw new Error('Missing fixture current-read factory');
  const cell = adapter.createCurrentReadonlyCell(read);
  return {call: cell, read: () => nativeRead(cell), metadata: () => metadata(cell), cell};
};
it('current-read source-linked producer preserves held/ABA, counts, identity, cleanup and errors', () => {
  const left = state(0), right = state(0), branch = state(true);
  let raw = 'X', calls = 0, failed = false;
  let latest: {id: string; call: number} | undefined;
  const c = current(() => {
    calls++; if (branch.read()) left.read(); else right.read();
    if (failed) throw new Error('query failure');
    return latest = {id: raw, call: calls};
  });
  const m = c.metadata(); expect(calls).toBe(0);
  const first = c.read(); expect(first).toBe(latest); expect(calls).toBe(1);
  expect(c.call()).toBe(latest); expect(calls).toBe(2);
  expect(c.metadata()).toBe(m); expect(calls).toBe(2); checkReadonly(c.cell);
  let appRuns = 0;
  const app = memo(() => {appRuns++; return c.read();});
  const warmed = app(); expect(warmed.id).toBe('X');
  for (const id of ['A', 'X', 'A', 'C']) {
    raw = id; const before = calls; const value = c.read();
    expect(value.id).toBe(id); expect(value).toBe(latest); expect(calls-before).toBe(1);
    expect(app()).toBe(warmed); expect(appRuns).toBe(1);
  }
  left.set(1); let before = calls;
  expect(c.read()).toBe(latest); expect(calls-before).toBe(1); expect(app().id).toBe('C');
  let deliveries = 0, cleanups = 0;
  const stop = observe(cleanup => {deliveries++; c.read(); cleanup(() => cleanups++);});
  expect(deliveries).toBe(1);
  right.set(1); flush(); expect(deliveries).toBe(1);
  branch.set(false); flush(); expect(deliveries).toBe(2); expect(cleanups).toBe(1);
  left.set(2); flush(); expect(deliveries).toBe(2);
  raw = 'D'; right.set(2); flush(); expect(deliveries).toBe(3);
  stop(); expect(cleanups).toBe(3); right.set(3); flush(); expect(deliveries).toBe(3);
  failed = true; expect(() => c.read()).toThrow('query failure'); failed = false;
  before = calls; expect(c.read().id).toBe('D'); expect(calls-before).toBe(1);
  expect(c.metadata()).toBe(m);
});
it('current-read nested invocation markers recover from direct nested throws', () => {
  let innerRuns = 0, outerRuns = 0;
  const inner = current(() => {innerRuns++; return {id: 'inner'};});
  const outer = current(() => {outerRuns++; return inner.read();});
  expect(outer.read().id).toBe('inner'); expect(innerRuns).toBe(1); expect(outerRuns).toBe(1);
  let depth = 0, enter = false, fail = false, calls = 0;
  const reentrant = current((): string => {
    calls++; depth++;
    try {
      expect(depth).toBeLessThanOrEqual(2);
      if (enter && depth === 1) return reentrant.read();
      if (fail) throw new Error('nested failure');
      return 'ok';
    } finally {depth--;}
  });
  expect(reentrant.read()).toBe('ok'); expect(calls).toBe(1); enter = true;
  let before = calls; expect(reentrant.read()).toBe('ok'); expect(calls-before).toBe(2);
  fail = true; expect(() => reentrant.read()).toThrow('nested failure'); fail = false;
  before = calls; expect(reentrant.read()).toBe('ok'); expect(calls-before).toBe(2);
  enter = false; before = calls; expect(reentrant.read()).toBe('ok'); expect(calls-before).toBe(1);
});

it('current-read native-only first dependency recovers with native publication error timing', () => {
  const outcomes: {escaped: boolean; deliveries: string[]}[] = [];
  for (const mode of ['native', 'current']) {
    const epoch = state(0); let failed = false, calls = 0;
    const freshError = new Error('same fresh recipe error');
    const recipe = () => {calls++; epoch.read(); if (failed) throw freshError; return calls;};
    const read = mode === 'native' ? memo(recipe) : current(recipe).read;
    const deliveries: string[] = [];
    const stop = observe(() => {
      try {read(); deliveries.push('value');}
      catch (error) {expect(error).toBe(freshError); deliveries.push('error');}
    });
    try {
      expect(calls).toBe(1); expect(deliveries).toEqual(['value']);
      failed = true; let before = calls, escaped = false;
      try {epoch.set(1); flush();} catch (error) {expect(error).toBe(freshError); escaped = true;}
      const failedPublicationCalls = calls-before;
      const errorDeliveries = [...deliveries];
      if (mode === 'current') {
        before = calls; expect(() => read()).toThrow(freshError); expect(calls-before).toBe(1);
        failed = false; before = calls; read(); expect(calls-before).toBe(1);
      } else failed = false;
      before = calls; epoch.set(2); flush(); const recoveredPublicationCalls = calls-before;
      expect(deliveries.at(-1)).toBe('value'); expect(deliveries.length).toBe(errorDeliveries.length+1);
      outcomes.push({escaped,deliveries});
      console.log('current-read-publication-counts', {mode, escaped, failedPublicationCalls,recoveredPublicationCalls,deliveries});
    } finally {stop();}
  }
  expect(outcomes[1]).toEqual(outcomes[0]);
});
it('current-read preserves dependency failures and native cycle errors', () => {
  const epoch = signal(0); let fail = false, innerRuns = 0, outerRuns = 0;
  const error = new Error('dependency sentinel');
  const inner = computed(() => {innerRuns++; epoch(); if (fail) {fail=false; throw error;} return 'ok';});
  const c = current(() => {outerRuns++; return inner();});
  expect(c.read()).toBe('ok'); fail=true; epoch.set(1);
  expect(() => c.read()).toThrow(error); expect(innerRuns).toBe(2);
  epoch.set(2); expect(c.read()).toBe('ok');
  let cycleCalls = 0;
  const cyclic = current((): string => {cycleCalls++; return cyclic.read();});
  let firstError: unknown;
  try {cyclic.read();} catch (e) {firstError=e;}
  expect(firstError).toBeInstanceOf(Error); expect(cycleCalls).toBe(1);
  let secondError: unknown;
  try {cyclic.read();} catch (e) {secondError=e;}
  expect(secondError).toBe(firstError); expect(cycleCalls).toBe(1);
  expect(outerRuns).toBeGreaterThan(1);
});
