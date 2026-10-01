// Observation payloads are built only when something observes them.
//
// A collection builds a notify payload per row — a structural effect with a
// deep-cloned value, a spread of the ambient write context and the call into
// the port. In a plain tree nothing receives any of it, and it was most of a
// 50k-row `setAll`. These specs pin both halves of the gate: an unobserved
// collection publishes nothing and behaves identically otherwise, and an
// observed one still publishes exactly what it did.
import { describe, expect, it, vi } from 'vitest';

import {
  observeWrites,
  type ObservedWriteFrame,
} from './internals/write-observation';

import { createEntitySignal } from './entity-signal';
import { entityMap } from './markers/entity-map';
import { getPathNotifier } from './path-notifier';
import { signalTree } from './signal-tree';

type Row = { id: number; name: string; tags: string[] };

type Port = {
  notify: ReturnType<typeof vi.fn>;
  hasObservers?: () => boolean;
};

const row = (id: number, name = `r${id}`): Row => ({ id, name, tags: [name] });

/** Every public mutator, in an order that exercises add/update/remove/reorder. */
function script(api: ReturnType<typeof createEntitySignal<Row, number>>) {
  api.setAll([row(1), row(2), row(3)]);
  api.addOne(row(4));
  api.addMany([row(5), row(6)]);
  api.prependOne(row(7));
  api.prependMany([row(8), row(9)]);
  api.updateOne(1, { name: 'one' });
  api.replaceOne(2, row(2, 'two'));
  api.updateMany([3, 4], { name: 'many' });
  api.updateWhere((r) => r.id === 5, { name: 'where' });
  api.upsertOne(row(6, 'up'));
  api.upsertOne(row(10));
  api.upsertMany([row(1, 'u1'), row(11)]);
  api.changeId(11, 12);
  api.removeOne(12);
  api.removeMany([9, 8]);
  api.removeWhere((r) => r.id === 7);
  api.setAll([row(3), row(1), row(20), row(4)]);
  api.clear();
  api.addMany([row(30), row(31)]);
}

function run(port: Port) {
  const api = createEntitySignal<Row, number>(
    { selectId: (r) => r.id },
    port as never,
    'rows'
  );
  const taps: unknown[] = [];
  api.tap({
    onAdd: (entity, id) => taps.push(['add', id, entity]),
    onUpdate: (id, changes, entity) =>
      taps.push(['update', id, changes, entity]),
    onRemove: (id, entity) => taps.push(['remove', id, entity]),
  });
  script(api);
  return {
    api,
    taps,
    state: { all: api.all(), ids: api.ids(), count: api.count() },
  };
}

describe('entity observation gate', () => {
  it('an unobserved port receives nothing, and nothing else changes', () => {
    const unobserved: Port = { notify: vi.fn(), hasObservers: () => false };
    const legacy: Port = { notify: vi.fn() };

    const quiet = run(unobserved);
    const loud = run(legacy);

    expect(unobserved.notify).not.toHaveBeenCalled();
    expect(legacy.notify.mock.calls.length).toBeGreaterThan(20);
    expect(quiet.state).toEqual(loud.state);
    expect(quiet.taps).toEqual(loud.taps);
  });

  it('a port without hasObservers is treated as observed', () => {
    const legacy: Port = { notify: vi.fn() };
    const observed: Port = { notify: vi.fn(), hasObservers: () => true };

    run(legacy);
    run(observed);

    // The same publications, payload for payload — the gate only removes
    // work when the answer is "nobody". Standalone collections draw their
    // PositionId from a process-wide counter, so that argument is compared
    // by shape only.
    const normalize = (calls: unknown[][]) =>
      calls.map((call) =>
        call.map((argument, index) =>
          index === 5 ? (argument as number[] | undefined)?.length : argument
        )
      );
    expect(observed.notify.mock.calls.length).toBe(
      legacy.notify.mock.calls.length
    );
    expect(normalize(observed.notify.mock.calls)).toEqual(
      normalize(legacy.notify.mock.calls)
    );
  });

  it('asks the INJECTED port, not the global notifier', () => {
    const global = getPathNotifier();
    const unsubscribe = global.subscribe('**', () => undefined);
    try {
      expect(global.hasObservers()).toBe(true);
      const unobserved: Port = { notify: vi.fn(), hasObservers: () => false };
      run(unobserved);
      expect(unobserved.notify).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it('checks once per operation, at the operation', () => {
    let observers = false;
    const port: Port = { notify: vi.fn(), hasObservers: () => observers };
    const api = createEntitySignal<Row, number>(
      { selectId: (r) => r.id },
      port as never,
      'rows'
    );
    api.setAll([row(1), row(2)]);
    expect(port.notify).not.toHaveBeenCalled();

    observers = true;
    api.setAll([row(2), row(3)]);
    // remove 1, update 2, add 3
    expect(port.notify).toHaveBeenCalledTimes(3);
  });

  it('an observed structural effect carries a CLONE of the stored value', () => {
    const port: Port = { notify: vi.fn(), hasObservers: () => true };
    const api = createEntitySignal<Row, number>(
      { selectId: (r) => r.id },
      port as never,
      'rows'
    );
    const supplied = row(1);
    api.addOne(supplied);
    const meta = port.notify.mock.calls[0]?.[6] as {
      structuralEffect: { kind: string; value: Row };
    };
    expect(meta.structuralEffect.kind).toBe('add');
    expect(meta.structuralEffect.value).toEqual(supplied);
    expect(meta.structuralEffect.value).not.toBe(supplied);
    expect(meta.structuralEffect.value.tags).not.toBe(supplied.tags);
  });

  it('prependOne rewrites the effect it published, and skips it unobserved', () => {
    const port: Port = { notify: vi.fn(), hasObservers: () => true };
    const api = createEntitySignal<Row, number>(
      { selectId: (r) => r.id },
      port as never,
      'rows'
    );
    api.setAll([row(1), row(2)]);
    port.notify.mockClear();
    api.prependOne(row(3));
    const effect = (
      port.notify.mock.calls[0]?.[6] as {
        structuralEffect: { beforeSubject?: number; afterSubject?: number };
      }
    ).structuralEffect;
    expect(effect.beforeSubject).toBeUndefined();
    expect(effect.afterSubject).toBe(1);

    const quiet: Port = { notify: vi.fn(), hasObservers: () => false };
    const other = createEntitySignal<Row, number>(
      { selectId: (r) => r.id },
      quiet as never,
      'rows'
    );
    other.setAll([row(1)]);
    expect(other.prependOne(row(2))).toBe(2);
    expect(other.ids()).toEqual([2, 1]);
    expect(quiet.notify).not.toHaveBeenCalled();
  });

  it('a plain tree queues nothing until something subscribes, then publishes', () => {
    const notifier = getPathNotifier();
    notifier.clear();
    expect(notifier.hasObservers()).toBe(false);

    const tree = signalTree({ rows: entityMap<Row, number>() });
    try {
      tree.$.rows.setAll([row(1), row(2)]);
      tree.$.rows.updateOne(1, { name: 'x' });
      tree.$.rows.removeOne(2);
      expect(notifier.hasPending()).toBe(false);

      const seen: unknown[] = [];
      const unsubscribe = notifier.subscribe(
        'rows.*',
        (_next, _prev, path, _owner, _origin, _subjects, _positions, meta) => {
          seen.push([path, meta?.structuralEffect?.kind]);
        }
      );
      try {
        tree.$.rows.addOne(row(3));
        notifier.flushSync();
        expect(seen).toEqual([['rows.3', 'add']]);
      } finally {
        unsubscribe();
      }
    } finally {
      tree.destroy();
    }
  });
});

describe('removal observation installed by an interceptor', () => {
  it.each(['one', 'many'] as const)(
    '%s publishes removals after subscription',
    (mode) => {
      const notifier = getPathNotifier();
      notifier.clear();
      const tree = signalTree({ rows: entityMap<Row, number>() });
      const seen: ObservedWriteFrame[] = [];
      let stop = () => undefined as void;
      try {
        tree.$.rows.setAll([row(1), row(2)]);
        notifier.flushSync();
        tree.$.rows.intercept({
          onRemove: (id) => {
            if (id === 2)
              stop = observeWrites((frame) => {
                seen.push(frame);
              });
          },
        });
        if (mode === 'one') tree.$.rows.removeOne(2);
        else tree.$.rows.removeMany([1, 2]);
        notifier.flushSync();
        expect(
          seen.map(({ path, before, after }) => ({ path, before, after }))
        ).toEqual(
          (mode === 'one' ? [2] : [1, 2]).map((id) => ({
            path: `rows.${id}`,
            before: row(id),
            after: undefined,
          }))
        );
      } finally {
        stop();
        tree.destroy();
        notifier.clear();
      }
    }
  );
});

it('captures every pre-removal neighbour when the last interceptor enables observation', () => {
  let observed = false;
  const port: Port = { notify: vi.fn(), hasObservers: () => observed };
  const api = createEntitySignal<Row, number>(
    { selectId: (r) => r.id },
    port as never,
    'rows'
  );
  api.setAll([row(1), row(2), row(3)]);
  api.intercept({
    onRemove: (id) => {
      if (id === 2) observed = true;
    },
  });
  api.removeMany([1, 2]);
  const effects = port.notify.mock.calls.map(
    (call) => call[6].structuralEffect
  );
  expect(effects).toEqual([
    {
      kind: 'remove',
      subject: 1,
      key: 1,
      value: row(1),
      beforeSubject: undefined,
      afterSubject: 2,
    },
    {
      kind: 'remove',
      subject: 2,
      key: 2,
      value: row(2),
      beforeSubject: 1,
      afterSubject: 3,
    },
  ]);
});
