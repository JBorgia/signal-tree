import { describe, expect, it } from 'vitest';

import { createLocationRuntime } from './location-runtime';
import type { ObservationAdapter } from './observation-adapter';
import { NEUTRAL_OBSERVATION_ADAPTER } from './observation-adapter';
import { entityMap } from '../markers/entity-map';
import { signalTree } from '../signal-tree';

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
  it('releases an abandoned derived chain whose recipes close over their owner', async () => {
    expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
    const runtime = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    const references = (() => {
      const owner = {
        source: runtime.createCell(2),
        first: () => 0,
        second: () => 0,
      };
      owner.first = runtime.createDerived(() => owner.source() * 2);
      owner.second = runtime.createDerived(() => owner.first() + 1);
      expect(owner.second()).toBe(5);
      owner.source(3);
      expect(owner.second()).toBe(7);
      return [new WeakRef(owner), new WeakRef(owner.first), new WeakRef(owner.second)];
    })();

    await applyPressure();

    expect(references.map((reference) => reference.deref())).toEqual([
      undefined, undefined, undefined,
    ]);
  });

  it('releases a destroyed app store with collection projections and self-capturing actions', async () => {
    expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
    type Job = { id: string; title: string; team: string };
    const createStore = () => {
      const store = signalTree({
        jobs: entityMap<Job, string>({ selectId: (job) => job.id }),
        team: 'North',
      }, {
        derived: ($) => ({
          visible: () => $.jobs.all().filter((job) => job.team === $.team()),
          selectedTitle: () => $.jobs.activeEntity()?.title,
        }),
      });
      store.$.jobs.setAll([
        { id: 'a', title: 'Inspect pump', team: 'North' },
        { id: 'b', title: 'Service gate', team: 'South' },
      ]);
      store.$.jobs.setActiveId('a');
      return Object.assign(store, {
        rename: (title: string) => store.$.jobs.updateOne('a', { title }),
      });
    };
    const references = (() => {
      const store = createStore();
      expect(store.$.visible()).toEqual([{ id: 'a', title: 'Inspect pump', team: 'North' }]);
      expect(store.$.selectedTitle()).toBe('Inspect pump');
      store.rename('Inspect pump again');
      expect(store.$.selectedTitle()).toBe('Inspect pump again');
      const refs = [
        new WeakRef(store),
        new WeakRef(store.$.visible),
        new WeakRef(store.$.selectedTitle),
        new WeakRef(store.$.jobs.byIdOrFail('a')),
      ];
      store.destroy();
      return refs;
    })();

    await applyPressure();

    expect(references.map((reference) => reference.deref())).toEqual([
      undefined, undefined, undefined, undefined,
    ]);
  });

  it('keeps a live subscribed chain current while replacing its dependencies', async () => {
    expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
    const runtime = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    const chooseLeft = runtime.createCell(true);
    const left = runtime.createCell(2);
    const right = runtime.createCell(10);
    const selected = runtime.createDerived(() => chooseLeft() ? left() : right());
    const doubled = runtime.createDerived(() => selected() * 2);
    const seen: number[] = [];
    const unsubscribe = doubled.subscribe(() => seen.push(doubled()));
    try {
      expect(doubled()).toBe(4);
      await applyPressure();
      left(3);
      chooseLeft(false);
      await applyPressure();
      left(4);
      right(11);
      expect(seen).toEqual([6, 20, 22]);
      expect(doubled()).toBe(22);
    } finally { unsubscribe(); }
  });

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
