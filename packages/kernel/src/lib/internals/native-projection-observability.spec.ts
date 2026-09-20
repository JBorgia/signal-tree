import { describe, expect, it } from 'vitest';

import { observeIntrinsicMutations } from './intrinsic-mutation';
import { createNativeLocationRuntime } from './native-location-realization';
import type { ObservationAdapter } from './observation-adapter';

/**
 * A projection location must stay observable — and nothing else could tell you
 * if it stopped.
 *
 * Entity field carriers are `createWritableProjection` locations, and each one
 * registers a mutation source at creation: eagerly, for every field of every
 * row `byId` touches, read or not. Measured at ~35 B per field, which is
 * ~420 B/entity on a twelve-field row, so it looked like the same pay-for-use
 * cut `createCell` locations took in `SUBJECT-STATE-MINIMAL-0`.
 *
 * A ceiling probe replaced that registration with the shared unobservable
 * source. **The whole kernel suite passed — 278 files, 2,346 tests.** It passed
 * because a kernel tree built through `signalTree` falls through to
 * `NEUTRAL_LOCATION_RUNTIME`, so no test in this package executed
 * `native-location-realization.ts` at all; before this file, nothing did. The
 * capability was live and simply unguarded, and deleting it was silent.
 *
 * Driving the runtime with a stub adapter is what makes the test possible here
 * rather than in a framework package: the realization seam is kernel-internal,
 * and a cross-package test would breach `@nx/enforce-module-boundaries`.
 */
function stubAdapter(): ObservationAdapter {
  return {
    createToken: () => ({
      observe: () => undefined,
      invalidate: () => undefined,
    }),
    createWritableProjection: <T>(compute: () => T) => ({
      cell: (() => compute()) as never,
      peek: () => compute(),
    }),
    runInvalidationGroup: (run: () => void) => run(),
  };
}

describe('native writable projections are observable', () => {
  it('notifies on replace, reports before/after, and stops on release', () => {
    const runtime = createNativeLocationRuntime(stubAdapter());

    let stored = 'a';
    const location = runtime.createWritableProjection?.<string>(
      () => stored,
      (value) => {
        stored = value;
      }
    );
    expect(location).toBeDefined();

    const seen: Array<[unknown, unknown, boolean]> = [];
    const release = observeIntrinsicMutations<string>(
      location as unknown as object,
      (mutation) =>
        seen.push([mutation.before, mutation.after, mutation.changed])
    );
    // Under the ceiling probe this is `undefined` — the deletion's tell.
    expect(release).toBeTypeOf('function');

    (location as unknown as { set: (v: string) => void }).set('b');
    expect(stored).toBe('b');
    expect(seen).toEqual([['a', 'b', true]]);

    release?.();
    (location as unknown as { set: (v: string) => void }).set('c');
    expect(stored).toBe('c');
    expect(seen).toHaveLength(1);
  });
});
