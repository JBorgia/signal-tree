import { describe, expect, it, vi } from 'vitest';

import {
  createLocationRuntime,
  NEUTRAL_LOCATION_RUNTIME,
} from './location-runtime';
import { NEUTRAL_OBSERVATION_ADAPTER } from './observation-adapter';

describe('LocationRuntime', () => {
  it('keeps distinct derived locations current from one source', () => {
    const source = NEUTRAL_LOCATION_RUNTIME.createCell(2);
    const isEmpty = NEUTRAL_LOCATION_RUNTIME.createDerived(
      () => source() === 0
    );
    const doubled = NEUTRAL_LOCATION_RUNTIME.createDerived(() => source() * 2);

    expect(isEmpty).not.toBe(doubled);
    expect(isEmpty()).toBe(false);
    expect(doubled()).toBe(4);

    source.set(0);
    expect(isEmpty()).toBe(true);
    expect(doubled()).toBe(0);

    source.set(5);
    expect(isEmpty()).toBe(false);
    expect(doubled()).toBe(10);
  });

  it('supports vanilla subscriptions with independent cleanup', () => {
    const location = NEUTRAL_LOCATION_RUNTIME.createCell('a');
    const first = vi.fn();
    const second = vi.fn();
    const releaseFirst = location.subscribe(first);
    const releaseSecond = location.subscribe(second);

    location.set('b');
    releaseFirst();
    location.set('c');
    releaseSecond();
    location.set('d');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    expect(location.peek()).toBe('d');
  });

  it('tracks dynamic dependencies without retaining obsolete sources', () => {
    const chooseLeft = NEUTRAL_LOCATION_RUNTIME.createCell(true);
    const left = NEUTRAL_LOCATION_RUNTIME.createCell(1);
    const right = NEUTRAL_LOCATION_RUNTIME.createCell(10);
    let runs = 0;
    const selected = NEUTRAL_LOCATION_RUNTIME.createDerived(() => {
      runs += 1;
      return chooseLeft() ? left() : right();
    });

    expect(selected()).toBe(1);
    chooseLeft.set(false);
    expect(selected()).toBe(10);
    const afterSwitch = runs;

    left.set(2);
    expect(selected()).toBe(10);
    expect(runs).toBe(afterSwitch);

    right.set(11);
    expect(selected()).toBe(11);
    expect(runs).toBe(afterSwitch + 1);
  });

  it('does not invalidate downstream consumers when a derived value is unchanged', () => {
    const rows = NEUTRAL_LOCATION_RUNTIME.createCell([
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ]);
    const selected = NEUTRAL_LOCATION_RUNTIME.createDerived(() =>
      rows().find((row) => row.id === 'a')
    );
    let downstreamRuns = 0;
    const downstream = NEUTRAL_LOCATION_RUNTIME.createDerived(() => {
      downstreamRuns += 1;
      return selected()?.value;
    });

    expect(downstream()).toBe(1);
    const initialRuns = downstreamRuns;

    rows.update((current) =>
      current.map((row) =>
        row.id === 'b' ? { ...row, value: 3 } : row
      )
    );

    expect(downstream()).toBe(1);
    expect(downstreamRuns).toBe(initialRuns);
  });

  it('settles unrelated subscribers after another derived computation throws', () => {
    const runtime = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    const source = runtime.createCell(0);
    const broken = runtime.createDerived(() => {
      const value = source();
      if (value === 1) throw new Error('derived exploded');
      return value;
    });
    const stable = runtime.createDerived(() => source() * 2);
    const seen: number[] = [];
    broken.subscribe(() => undefined);
    stable.subscribe(() => seen.push(stable.peek()));

    expect(() => source.set(1)).toThrow('derived exploded');
    expect(stable.peek()).toBe(2);
    expect(seen).toEqual([2]);

    expect(() => source.set(2)).not.toThrow();
    expect(broken.peek()).toBe(2);
  });

  it('retries a failed derived computation instead of returning stale cached state', () => {
    const runtime = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    const source = runtime.createCell(0);
    const derived = runtime.createDerived(() => {
      const value = source();
      if (value === 1) throw new Error('derived exploded');
      return value;
    });

    expect(derived()).toBe(0);
    source.set(1);

    expect(() => derived()).toThrow('derived exploded');
    expect(() => derived()).toThrow('derived exploded');

    source.set(2);
    expect(derived()).toBe(2);
  });

  it('does not let one runtime failure cancel nested publication in another', () => {
    const firstRuntime = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    const secondRuntime = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    const first = firstRuntime.createCell(0);
    const second = secondRuntime.createCell(0);
    const broken = firstRuntime.createDerived(() => {
      const value = first();
      if (value === 1) throw new Error('first runtime exploded');
      return value;
    });
    const observedSecond = secondRuntime.createDerived(() => second());
    const seen: number[] = [];
    broken.subscribe(() => undefined);
    observedSecond.subscribe(() => seen.push(observedSecond.peek()));
    first.subscribe(() => second.set(1));

    expect(() => first.set(1)).toThrow('first runtime exploded');
    expect(observedSecond.peek()).toBe(1);
    expect(seen).toEqual([1]);
  });

  it('preserves falsy failures from grouped operations', () => {
    let caught: unknown = Symbol('not thrown');

    try {
      NEUTRAL_LOCATION_RUNTIME.runInvalidationGroup(() => {
        throw 0;
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBe(0);
  });

  it('notifies vanilla subscribers even when a framework token throws', () => {
    const runtime = createLocationRuntime({
      createToken: () => ({
        observe: () => undefined,
        invalidate: () => {
          throw new Error('framework token exploded');
        },
      }),
      runInvalidationGroup: (run) => run(),
    });
    const location = runtime.createCell(0);
    const seen: number[] = [];
    location();
    location.subscribe(() => seen.push(location.peek()));

    expect(() => location.set(1)).toThrow('framework token exploded');
    expect(seen).toEqual([1]);
  });
});
