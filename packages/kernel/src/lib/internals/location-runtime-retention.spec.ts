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
  it('releases a deleted field carrier while its row and tree remain alive', async () => {
    expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
    const tree = signalTree({
      rows: entityMap<{ id: string; value: number }, string>(),
    });
    tree.$.rows.addOne({ id: 'a', value: 1 });
    const row = tree.$.rows.byIdOrFail('a');
    const reference = (() => {
      const field = row.value;
      expect(field()).toBe(1);
      const weak = new WeakRef(field);
      expect(Reflect.deleteProperty(row, 'value')).toBe(true);
      return weak;
    })();
    try {
      await applyPressure();
      expect(reference.deref()).toBeUndefined();
      tree.$.rows.updateOne('a', { value: 2 });
      expect(row()).toEqual({ id: 'a', value: 2 });
    } finally {
      tree.destroy();
    }
  });

  it('does not retain a row creation value through unmaterialized field getters', async () => {
    expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
    type Row = { id: string; payload: { value: number } };
    const tree = signalTree({ rows: entityMap<Row, string>() });
    const held = (() => {
      const payload = { value: 1 };
      tree.$.rows.addOne({ id: 'a', payload });
      const row = tree.$.rows.byIdOrFail('a');
      const reference = new WeakRef(payload);
      tree.$.rows.replaceOne('a', { id: 'a', payload: { value: 2 } });
      return { row, reference };
    })();
    try {
      await applyPressure();
      expect(held.reference.deref()).toBeUndefined();
      expect(held.row.payload()).toEqual({ value: 2 });
    } finally {
      tree.destroy();
    }
  });

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
      return [
        new WeakRef(owner),
        new WeakRef(owner.first),
        new WeakRef(owner.second),
      ];
    })();

    await applyPressure();

    expect(references.map((reference) => reference.deref())).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('releases a destroyed app store with collection projections and self-capturing actions', async () => {
    expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
    type Job = { id: string; title: string; team: string };
    const createStore = () => {
      const store = signalTree(
        {
          jobs: entityMap<Job, string>({ selectId: (job) => job.id }),
          team: 'North',
        },
        {
          derived: ($) => ({
            visible: () => $.jobs.all().filter((job) => job.team === $.team()),
            selectedTitle: () => $.jobs.activeEntity()?.title,
          }),
        }
      );
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
      expect(store.$.visible()).toEqual([
        { id: 'a', title: 'Inspect pump', team: 'North' },
      ]);
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
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('keeps a live subscribed chain current while replacing its dependencies', async () => {
    expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
    const runtime = createLocationRuntime(NEUTRAL_OBSERVATION_ADAPTER);
    const chooseLeft = runtime.createCell(true);
    const left = runtime.createCell(2);
    const right = runtime.createCell(10);
    const selected = runtime.createDerived(() =>
      chooseLeft() ? left() : right()
    );
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
    } finally {
      unsubscribe();
    }
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

it('releases a replaced physical requirement after whole capture while the source stays alive', async () => {
  expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
  // Load the same native authority as an ordinary public consumer, within this
  // final public-authority tests so earlier neutral fixtures keep their imports.
  await import('../../index');
  const { getEntityPublicationBinding } = await import('./entity-publication');
  const tree = signalTree({
    rows: entityMap<{ id: string; value: number }, string>(),
  });
  const pins: object[] = [];
  try {
    tree.$.rows.addOne({ id: 'a', value: 0 });
    const source = getEntityPublicationBinding(tree.$.rows)?.source;
    const subject = getEntityPublicationBinding(
      tree.$.rows.byIdOrFail('a')
    )?.subject;
    if (!source || subject === undefined)
      throw new Error('native source binding missing');
    // This case measures release of active evidence, so demand it explicitly.
    expect(source.evidence()).toBeDefined();
    expect(source.inspect().native).toBe(1);
    const old = (() => {
      tree.$.rows.updateOne('a', { value: 1 });
      const requirement = source
        .evidence()
        ?.field(subject, 'value', 'physical');
      if (!requirement) throw new Error('physical requirement missing');
      source.captureInput();
      const reference = new WeakRef(requirement);
      pins.push(requirement);
      tree.$.rows.updateOne('a', { value: 2 });
      expect(source.evidence()?.field(subject, 'value', 'physical')).not.toBe(
        requirement
      );
      return reference;
    })();
    await applyPressure();
    expect(old.deref()).toBeDefined();
    pins.length = 0;
    await applyPressure();
    expect(old.deref()).toBeUndefined();
    expect(tree.$.rows.byIdOrFail('a').value()).toBe(2);
    expect(source.inspect().native).toBe(1);
  } finally {
    pins.length = 0;
    tree.destroy();
  }
});

it('releases an unactivated source and its seed after the last held reader is released', async () => {
  expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
  await import('../../index');
  const { getEntityPublicationBinding } = await import('./entity-publication');
  const pins: object[] = [];
  const references = (() => {
    const payload = { value: 7 };
    const tree = signalTree({
      rows: entityMap<{ id: string; payload: typeof payload }, string>(),
    });
    tree.$.rows.addOne({ id: 'a', payload });
    const reader = tree.$.rows.byIdOrFail('a').payload;
    const source = getEntityPublicationBinding(tree.$.rows)?.source;
    if (!source) throw new Error('source binding missing');
    expect(tree.$.rows.count()).toBe(1);
    expect(reader()).toBe(payload);
    expect(source.inspect().native).toBe(0);
    const refs = [tree, source, reader, payload].map(value => new WeakRef(value));
    tree.destroy();
    expect(source.inspect().native).toBe(0);
    expect(reader()).toBe(payload);
    pins.push(tree, source, reader, payload);
    return refs;
  })();
  try {
    await applyPressure();
    expect(references.every(reference => reference.deref() !== undefined)).toBe(true);
    pins.length = 0;
    await applyPressure();
    expect(references.map(reference => reference.deref())).toEqual([
      undefined, undefined, undefined, undefined,
    ]);
  } finally {
    pins.length = 0;
  }
});
