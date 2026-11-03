import { expect, it, vi } from 'vitest';
import { createTreeScalarLeafRuntime } from './tree-scalar-leaf-runtime';
import { createNativeTreeScalarLeafRuntime } from './native-tree-scalar-leaf-runtime';
import { createLocationRuntime, replaceLocation, deriveLocation } from './location-runtime';
import { preparePublicationMutations } from './intrinsic-mutation';
import type { ObservationAdapter } from './observation-adapter';
import * as errors from './error-reporter';

const primary = new Error('primary');
const secondary = new Error('completion');
const reporter = new Error('reporter');
const scenarios = [
  { name: 'success', p: false, c: false },
  { name: 'primary object', p: true, c: false, pe: primary },
  { name: 'primary primitive', p: true, c: false, pe: 'primary string' },
  { name: 'primary undefined', p: true, c: false, pe: undefined },
  { name: 'completion object', p: false, c: true, ce: secondary },
  { name: 'completion undefined', p: false, c: true, ce: undefined },
  { name: 'primary undefined and completion', p: true, c: true, pe: undefined, ce: secondary },
  { name: 'primary and completion undefined', p: true, c: true, pe: primary, ce: undefined },
  { name: 'reporter throws', p: true, c: true, pe: primary, ce: secondary, reportThrows: true },
  { name: 'completion reentry under primary', p: true, c: false, pe: primary, reentry: true },
];
for (const route of ['neutral-frame', 'native-frame', 'native-replace', 'native-derive']) {
  for (const s of scenarios) it(`${route}: ${s.name} keeps completion and exact precedence`, () => {
    let armed = true, complete = 0, notified = 0;
    const reports: unknown[] = [];
    const invalidate = () => { notified++; if (armed && s.p) throw s.pe; };
    const token = () => ({ observe() { /* No dependency tracking in this boundary fixture. */ }, invalidate });
    const adapter: ObservationAdapter = {
      createToken: token, runInvalidationGroup: run => run(),
      createWritableCell: <T>(read: () => T) => {
        const cell = Object.assign(() => read(), {
          set(_v: T) { /* Actual writes go through kernel location binding. */ },
          update(_fn: (v: T) => T) { /* Actual updates go through kernel location binding. */ },
          asReadonly: () => read,
        });
        return { cell, peek: read, token: token() };
      },
    };
    const locations = createLocationRuntime(adapter);
    const publish = vi.spyOn(locations, 'publish').mockImplementation(invalidate);
    const runtime = route === 'neutral-frame'
      ? createTreeScalarLeafRuntime(undefined, locations)
      : createNativeTreeScalarLeafRuntime(undefined, adapter);
    const a = runtime.createLeaf<number>(0, Object.is), b = runtime.createLeaf<number>(0, Object.is);
    const report = vi.spyOn(errors, 'reportContainedObserverError').mockImplementation(event => {
      reports.push(event.error); if (s.reportThrows) throw reporter;
    });
    const off = preparePublicationMutations(a,
      () => ({ record: { writes: [], adds: [] }, completion: {} }),
      () => {
        complete++;
        if (armed && s.reentry) {
          armed = false; replaceLocation(b, 9); armed = true;
        }
        if (armed && s.c) throw s.ce;
      })!;
    const write = () => {
      if (route.endsWith('frame')) {
        const frame = runtime.beginFrame(); frame.set(0, a() + 1); frame.commit();
      } else if (route === 'native-replace') replaceLocation(a, a() + 1);
      else deriveLocation(a, current => current + 1);
    };
    try {
      let caught = false, error: unknown;
      try { write(); } catch (e) { caught = true; error = e; }
      expect(caught).toBe(s.p || s.c);
      expect(error).toBe(s.reportThrows ? reporter : s.p ? s.pe : s.c ? s.ce : undefined);
      expect(a()).toBe(1); expect(complete).toBe(1); expect(notified).toBe(s.reentry && route !== 'neutral-frame' ? 2 : 1);
      expect(reports).toEqual(s.p && s.c ? [s.ce] : []);
      expect(b()).toBe(s.reentry ? 9 : 0);
      armed = false; write(); expect(a()).toBe(2); expect(complete).toBe(2);
      expect(reports).toEqual(s.p && s.c ? [s.ce] : []);
    } finally { off(); report.mockRestore(); publish.mockRestore(); }
  });
}
