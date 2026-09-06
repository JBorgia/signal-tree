import { describe, expect, it } from 'vitest';

import { createLocationRuntime } from './location-runtime';
import type { ObservationAdapter } from './observation-adapter';

const collect = () => {
  const gc = (globalThis as { gc?: () => void }).gc;
  for (let pass = 0; pass < 6; pass++) gc?.();
};

const applyPressure = async () => {
  for (let round = 0; round < 4; round++) {
    collect();
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  let ballast: object[] = [];
  for (let index = 0; index < 200_000; index++) ballast.push({ index });
  ballast = [];
  collect();
  await new Promise((resolve) => setTimeout(resolve, 20));
  collect();
};

describe('LocationRuntime retention', () => {
  it('releases an abandoned derived recipe from its source dependencies', async () => {
    expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
    const observation: ObservationAdapter = {
      createToken: () => ({
        observe: () => undefined,
        invalidate: () => undefined,
      }),
      runInvalidationGroup: (run) => run(),
    };
    const runtime = createLocationRuntime(observation);
    const source = runtime.createCell(0);
    let runs = 0;

    const captured = (() => {
      const payload = { marker: 'abandoned-derived' };
      const reference = new WeakRef(payload);
      const derived = runtime.createDerived(() => {
        runs += 1;
        void payload;
        return source();
      });
      derived();
      return reference;
    })();

    await applyPressure();

    expect(captured.deref()).toBeUndefined();
    source(1);
    expect(runs).toBe(1);
  });
});