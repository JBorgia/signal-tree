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

/** Records the callback/flush boundary without pretending to be Solid. */
function fakeObservationAdapter() {
  const frames: { depth: number; returnedNormally: boolean }[] = [];
  const invalidations: number[] = [];
  const timeline: string[] = [];
  let depth = 0;
  let nextToken = 0;
  const adapter: ObservationAdapter = {
    createToken() {
      const id = nextToken++;
      return {
        observe() {
          /* no framework dependencies in this phase test */
        },
        invalidate() {
          invalidations.push(id);
          timeline.push(`epoch:${id}`);
        },
      };
    },
    runInvalidationGroup(run) {
      const frame = { depth: ++depth, returnedNormally: false };
      frames.push(frame);
      try {
        run();
        // A native batch may only finish its flush after this callback returns.
        frame.returnedNormally = true;
      } finally {
        depth--;
      }
    },
  };
  return { adapter, frames, invalidations, timeline, depth: () => depth };
}

describe('native runtime reports saved errors outside observation grouping', () => {
  it('attempts every queued publisher before reporting the first error unchanged', () => {
    const f = fakeObservationAdapter();
    const runtime = createNativeLocationRuntime(f.adapter);
    const first = new Error('first publisher');
    const second = new Error('second publisher');
    const calls: string[] = [];
    const a = {
      notify() {
        calls.push('a');
        throw first;
      },
    };
    const b = {
      notify() {
        calls.push('b');
        throw second;
      },
    };
    const c = {
      notify() {
        calls.push('c');
      },
    };

    const result = capture(() =>
      runtime.runInvalidationGroup(() => {
        expect(f.depth()).toBe(1); // Do not fix this by deleting the wrapper.
        runtime.publish([a, b, a, c]);
        expect(calls).toEqual([]);
      })
    );

    expect(result.threw).toBe(true);
    expect(result.error).toBe(first);
    expect(calls).toEqual(['a', 'b', 'c']);
    expect(f.frames.length).toBeGreaterThan(1);
    expect(f.frames.every((frame) => frame.returnedNormally)).toBe(true);
    expect(f.depth()).toBe(0);
    runtime.runInvalidationGroup(() => runtime.publish([c]));
    expect(calls).toEqual(['a', 'b', 'c', 'c']); // No failed-publisher replay.
  });

  it.each([
    { name: 'Error object', primary: new Error('body') },
    { name: 'undefined', primary: undefined },
    { name: 'frozen non-Error object', primary: Object.freeze({ body: true }) },
  ])(
    'preserves $name body failure after delivering already queued work',
    ({ primary }) => {
      const f = fakeObservationAdapter();
      const runtime = createNativeLocationRuntime(f.adapter);
      const secondary = new Error('delivery');
      const calls: string[] = [];
      const result = capture(() =>
        runtime.runInvalidationGroup(() => {
          runtime.publish([
            {
              notify() {
                calls.push('failing');
                throw secondary;
              },
            },
            {
              notify() {
                calls.push('sibling');
              },
            },
          ]);
          throw primary;
        })
      );

      // Checking only error===undefined would pass if no exception occurred.
      expect(result.threw).toBe(true);
      expect(result.error).toBe(primary);
      expect(calls).toEqual(['failing', 'sibling']);
      expect(f.frames.every((frame) => frame.returnedNormally)).toBe(true);
      expect(f.depth()).toBe(0);
    }
  );

  it('retains nested depth, epoch coalescing and publisher insertion order', () => {
    const f = fakeObservationAdapter();
    const runtime = createNativeLocationRuntime(f.adapter);
    const first = runtime.createEpoch!();
    const second = runtime.createEpoch!();
    const inner = new Error('nested body');
    const calls: string[] = [];
    const before = {
      notify() {
        calls.push('before');
        f.timeline.push('before');
      },
    };
    const after = {
      notify() {
        calls.push('after');
        f.timeline.push('after');
      },
    };
    runtime.runInvalidationGroup(() => {
      runtime.publish([before]);
      const result = capture(() =>
        runtime.runInvalidationGroup(() => {
          expect(f.depth()).toBe(2);
          runtime.advanceEpoch!(first);
          runtime.advanceEpoch!(first);
          runtime.advanceEpoch!(second);
          runtime.publish([after, before]);
          throw inner;
        })
      );
      expect(result.threw).toBe(true);
      expect(result.error).toBe(inner);
      expect(f.invalidations).toEqual([]);
      expect(calls).toEqual([]);
      expect(f.depth()).toBe(1);
    });
    expect(f.invalidations).toEqual([0, 1]);
    expect(calls).toEqual(['before', 'after']);
    expect(f.timeline).toEqual(['before', 'epoch:0', 'epoch:1', 'after']);
    expect(f.frames.every((frame) => frame.returnedNormally)).toBe(true);
    expect(f.depth()).toBe(0);
    runtime.runInvalidationGroup(() => runtime.advanceEpoch!(second));
    expect(f.invalidations).toEqual([0, 1, 1]);
  });
});
