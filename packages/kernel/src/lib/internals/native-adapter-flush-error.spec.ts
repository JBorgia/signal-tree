import { describe, expect, it } from 'vitest';
import { createNativeLocationRuntime } from './native-location-realization';
import type { ObservationAdapter } from './observation-adapter';

function capture(run: () => void): { threw: boolean; error: unknown } {
  try {
    run();
    return { threw: false, error: undefined };
  } catch (error) {
    return { threw: true, error };
  }
}

/** Throws only AFTER a wrapper's callback returned, unlike a publisher throw.
 * Depth 1 is the operation wrapper; depth 2 is its queued delivery wrapper.
 * This is an observation-port phase fake, not a framework recovery model.
 */
function fixture(flushDepth: number, flushError: unknown) {
  const frames: { depth: number; returned: boolean; flushThrew: boolean }[] =
    [];
  let depth = 0;
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
    runInvalidationGroup(run) {
      const frame = { depth: ++depth, returned: false, flushThrew: false };
      frames.push(frame);
      try {
        run();
        frame.returned = true;
        if (armed && depth === flushDepth) {
          armed = false;
          frame.flushThrew = true;
          throw flushError;
        }
      } finally {
        depth--;
      }
    },
  };
  return {
    runtime: createNativeLocationRuntime(adapter),
    frames,
    depth: () => depth,
  };
}

function verifyFlush(f: ReturnType<typeof fixture>, depth: number) {
  expect(f.frames.length).toBeGreaterThanOrEqual(depth);
  expect(f.frames.every((frame) => frame.returned)).toBe(true);
  expect(
    f.frames.filter((frame) => frame.flushThrew).map((frame) => frame.depth)
  ).toEqual([depth]);
  expect(f.depth()).toBe(0);
}

for (const flushDepth of [1, 2]) {
  describe(`adapter post-callback flush at depth ${flushDepth}`, () => {
    it.each([
      { label: 'Error object', error: new Error('adapter flush') },
      { label: 'undefined', error: undefined },
    ])(
      'propagates flush-only $label without disguising success',
      ({ error }) => {
        const f = fixture(flushDepth, error);
        let delivered = 0;
        const result = capture(() =>
          f.runtime.runInvalidationGroup(() => {
            expect(f.depth()).toBe(1);
            f.runtime.publish([
              {
                notify() {
                  expect(f.depth()).toBeGreaterThan(1);
                  delivered++;
                },
              },
            ]);
            expect(delivered).toBe(0);
          })
        );
        expect(delivered).toBe(1);
        verifyFlush(f, flushDepth);
        expect(result.threw).toBe(true);
        expect(result.error).toBe(error);
        // The error did not strand group depth or leave stale queued work.
        f.runtime.runInvalidationGroup(() => {
          expect(f.depth()).toBe(1);
          f.runtime.publish([
            {
              notify() {
                delivered++;
              },
            },
          ]);
        });
        expect(delivered).toBe(2);
        expect(f.depth()).toBe(0);
      }
    );

    it.each([
      { label: 'Error object', primary: new Error('body') },
      { label: 'undefined', primary: undefined },
      { label: 'frozen value', primary: Object.freeze({ body: true }) },
    ])(
      'preserves $label body failure when adapter flush also throws',
      ({ primary }) => {
        const f = fixture(flushDepth, new Error('adapter flush'));
        let delivered = 0;
        const result = capture(() =>
          f.runtime.runInvalidationGroup(() => {
            expect(f.depth()).toBe(1);
            f.runtime.publish([
              {
                notify() {
                  expect(f.depth()).toBeGreaterThan(1);
                  delivered++;
                },
              },
            ]);
            throw primary;
          })
        );
        expect(delivered).toBe(1);
        verifyFlush(f, flushDepth);
        expect(result.threw).toBe(true);
        expect(result.error).toBe(primary);
      }
    );

    it('attempts every queued publisher before adapter flush; body remains primary', () => {
      const body = Object.freeze({ body: true });
      const f = fixture(flushDepth, new Error('adapter flush'));
      const calls: string[] = [];
      const a = {
        notify() {
          expect(f.depth()).toBeGreaterThan(1);
          calls.push('a');
          throw new Error('publisher a');
        },
      };
      const b = {
        notify() {
          expect(f.depth()).toBeGreaterThan(1);
          calls.push('b');
          throw undefined;
        },
      };
      const c = {
        notify() {
          expect(f.depth()).toBeGreaterThan(1);
          calls.push('c');
        },
      };
      const result = capture(() =>
        f.runtime.runInvalidationGroup(() => {
          expect(f.depth()).toBe(1);
          f.runtime.publish([a, b, a, c]);
          expect(calls).toEqual([]);
          throw body;
        })
      );
      expect(calls).toEqual(['a', 'b', 'c']);
      verifyFlush(f, flushDepth);
      expect(result.threw).toBe(true);
      expect(result.error).toBe(body);
      // Does not require a new aggregate or publisher/adapter error ordering.
    });
  });
}
