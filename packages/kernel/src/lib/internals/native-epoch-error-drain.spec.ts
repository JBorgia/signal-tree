import { describe, expect, it } from 'vitest';

import { createNativeLocationRuntime } from './native-location-realization';
import type { EpochHandle, ObservationAdapter } from './observation-adapter';

/** Separate from report timing: one epoch publisher loops several handles. */
describe('native epoch publisher attempts later handles after one advance fails', () => {
  it('does not lose a staged sibling handle after actual advancement of the first', () => {
    const ids = new WeakMap<EpochHandle, number>();
    const advances: number[] = [];
    const marker = new Error('after first native advance');
    let id = 0;
    let armed = true;
    const adapter: ObservationAdapter = {
      createToken: () => ({
        observe() {
          /* No dependency tracking in this phase fixture. */
        },
        invalidate() {
          /* This fixture exercises epochs, not token values. */
        },
      }),
      createEpoch() {
        const handle = () => 0;
        ids.set(handle, id++);
        return handle;
      },
      advanceEpoch(handle) {
        advances.push(ids.get(handle)!); // Represents completed native work.
        if (armed) {
          armed = false;
          throw marker;
        }
      },
      runInvalidationGroup: (run) => run(),
    };
    const runtime = createNativeLocationRuntime(adapter);
    const first = runtime.createEpoch!();
    const second = runtime.createEpoch!();
    let threw = false;
    let caught: unknown;
    try {
      runtime.runInvalidationGroup(() => {
        runtime.advanceEpoch!(first);
        runtime.advanceEpoch!(second);
      });
    } catch (error) {
      threw = true;
      caught = error;
    }
    expect(threw).toBe(true);
    expect(caught).toBe(marker);
    // Keep this red separate if epochPublisher clears its set then aborts
    // its loop. Moving the saved group throw cannot fix the missing advance.
    expect(advances).toEqual([0, 1]);
    runtime.runInvalidationGroup(() => {
      /* Empty follow-up must not replay failed work. */
    });
    expect(advances).toEqual([0, 1]);
  });
});

const drainCases = [
  'none',
  'first-error',
  'undefined',
  'frozen',
  'multiple',
  'before-effect',
  'body-primary',
  'dedupe',
  'reentrant-new',
  'reentrant-failure',
  'reentrant-overlap',
  'deferred-tail',
] as const;

describe.each(['native', 'fallback'] as const)(
  '%s epoch drain edge cases',
  (mode) => {
    it.each(drainCases)(
      '%s preserves captured siblings and explicit request boundaries',
      (scenario) => {
        const attempts: number[] = [];
        const effects: number[] = [];
        const faults: string[] = [];
        let armed = true;
        let reentered = false;
        const primary: unknown =
          scenario === 'undefined'
            ? undefined
            : scenario === 'frozen'
            ? Object.freeze({ failure: true })
            : new Error('first handle');
        const secondary = new Error('second or reentrant handle');
        const body = new Error('semantic body');

        function advance(id: number): void {
          attempts.push(id);
          if (armed && scenario === 'before-effect' && id === 0) {
            faults.push('A');
            throw primary;
          }
          effects.push(id);
          if (
            armed &&
            id === 0 &&
            scenario.startsWith('reentrant') &&
            !reentered
          ) {
            reentered = true;
            const requested =
              handles[scenario === 'reentrant-overlap' ? 1 : 2]!;
            runtime.runInvalidationGroup(() =>
              runtime.advanceEpoch!(requested)
            );
          }
          if (armed && scenario === 'reentrant-failure' && id === 2) {
            faults.push('C');
            throw secondary;
          }
          if (
            armed &&
            id === 0 &&
            [
              'first-error',
              'undefined',
              'frozen',
              'multiple',
              'body-primary',
              'deferred-tail',
            ].includes(scenario)
          ) {
            faults.push('A');
            throw primary;
          }
          if (armed && scenario === 'multiple' && id === 1) {
            faults.push('B');
            throw secondary;
          }
        }

        let nextId = 0;
        const ids = new WeakMap<EpochHandle, number>();
        const adapter: ObservationAdapter = {
          createToken() {
            const id = nextId++;
            return {
              observe() {
                /* No dependency tracking in this phase fixture. */
              },
              invalidate() {
                advance(id);
              },
            };
          },
          runInvalidationGroup: (run) => run(),
        };
        if (mode === 'native') {
          adapter.createEpoch = () => {
            const handle = () => 0;
            ids.set(handle, nextId++);
            return handle;
          };
          adapter.advanceEpoch = (handle) => advance(ids.get(handle)!);
        }
        const runtime = createNativeLocationRuntime(adapter);
        const handles = [
          runtime.createEpoch!(),
          runtime.createEpoch!(),
          runtime.createEpoch!(),
        ];
        let threw = false;
        let caught: unknown;
        try {
          runtime.runInvalidationGroup(() => {
            runtime.advanceEpoch!(handles[0]!);
            runtime.advanceEpoch!(handles[1]!);
            if (scenario === 'dedupe') {
              runtime.advanceEpoch!(handles[0]!);
              runtime.advanceEpoch!(handles[1]!);
            }
            if (scenario === 'body-primary') throw body;
          });
        } catch (error) {
          threw = true;
          caught = error;
        }
        const afterFirst = [...attempts];
        const firstEffects = [...effects];
        const shouldThrow = [
          'first-error',
          'undefined',
          'frozen',
          'multiple',
          'before-effect',
          'body-primary',
          'deferred-tail',
          'reentrant-failure',
        ].includes(scenario);
        expect(threw).toBe(shouldThrow);
        if (shouldThrow) {
          expect(caught).toBe(
            scenario === 'body-primary'
              ? body
              : scenario === 'reentrant-failure'
              ? secondary
              : primary
          );
        }

        armed = false;
        runtime.runInvalidationGroup(() => {
          /* Empty follow-up must not replay failed work. */
        });
        const afterEmpty = [...attempts];
        runtime.runInvalidationGroup(() => runtime.advanceEpoch!(handles[2]!));
        // Reentrant overlap means TWO explicit requests, not accidental replay or
        // a new exactly-once promise. Preserve the existing recursion/order here.
        const expected =
          scenario === 'reentrant-overlap'
            ? [0, 1, 1]
            : scenario.startsWith('reentrant')
            ? [0, 2, 1]
            : [0, 1];
        expect(afterFirst).toEqual(expected);
        expect(afterEmpty).toEqual(expected);
        expect(attempts).toEqual([...expected, 2]);
        if (scenario === 'multiple') expect(faults).toEqual(['A', 'B']);
        if (scenario === 'before-effect') expect(firstEffects).toEqual([1]);
      }
    );
  }
);
