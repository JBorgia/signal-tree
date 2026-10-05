// What one `setAll` publishes, in what order, to whom.
//
// `setAll` stages the incoming rows against the pre-state and then commits
// removals, updates and adds in one operation. These specs pin every
// observable product of that staging — interceptor calls, the structural
// effects and their neighbours, the participation latch, tap order — so the
// staging can be made cheaper without changing any of it.
import { describe, expect, it, vi } from 'vitest';

import { createEntitySignal } from './entity-signal';
import { NEUTRAL_LOCATION_RUNTIME } from './internals/location-runtime';
import { getOwnedSubjectIds } from './internals/owned-metadata';

type Row = { id: string; n: number };
const row = (id: string, n = 0): Row => ({ id, n });

function harness() {
  const notify = vi.fn();
  const api = createEntitySignal<Row, string>(
    { selectId: (r) => r.id },
    { notify, hasObservers: () => true } as never,
    'rows'
  );
  const log: unknown[] = [];
  api.intercept({
    onAdd: (entity) => {
      log.push(['intercept:add', entity.id, entity.n]);
    },
    onUpdate: (id, changes) => {
      log.push(['intercept:update', id, (changes as Row).n]);
    },
    onRemove: (id, entity) => {
      log.push(['intercept:remove', id, entity.n]);
    },
  });
  api.tap({
    onAdd: (entity, id) => log.push(['tap:add', id, entity.n]),
    onUpdate: (id, _changes, entity) => log.push(['tap:update', id, entity.n]),
    onRemove: (id, entity) => log.push(['tap:remove', id, entity.n]),
  });
  const publications = () =>
    notify.mock.calls.map(
      ([path, next, prev, ownerPath, subjects, , meta]) => ({
        path,
        next,
        prev,
        ownerPath,
        subjects,
        effect: (meta as { structuralEffect?: unknown } | undefined)
          ?.structuralEffect,
      })
    );
  return { api, log, notify, publications };
}

describe('setAll staging', () => {
  it('removes, updates and adds against the pre-state', () => {
    const { api, log, notify, publications } = harness();
    api.setAll([row('a'), row('b'), row('c')]);
    notify.mockClear();
    log.length = 0;

    api.setAll([row('c', 1), row('q', 1), row('a', 1)]);

    expect(api.ids()).toEqual(['c', 'q', 'a']);
    expect(api.all()).toEqual([row('c', 1), row('q', 1), row('a', 1)]);
    // Interceptors in input order, then removals in pre-state order. Taps:
    // removals, then adds, then updates.
    expect(log).toEqual([
      ['intercept:update', 'c', 1],
      ['intercept:add', 'q', 1],
      ['intercept:update', 'a', 1],
      ['intercept:remove', 'b', 0],
      ['tap:remove', 'b', 0],
      ['tap:add', 'q', 1],
      ['tap:update', 'c', 1],
      ['tap:update', 'a', 1],
    ]);
    // Participation: removals, updates, adds.
    expect(getOwnedSubjectIds(api)).toEqual([2, 3, 1, 4]);
    expect(publications()).toEqual([
      {
        path: 'rows.b',
        next: undefined,
        prev: row('b'),
        ownerPath: 'rows',
        subjects: [2],
        // Pre-state neighbours.
        effect: {
          kind: 'remove',
          subject: 2,
          key: 'b',
          value: row('b'),
          beforeSubject: 1,
          afterSubject: 3,
        },
      },
      {
        path: 'rows.c',
        next: row('c', 1),
        prev: row('c'),
        ownerPath: 'rows',
        subjects: [3],
        effect: undefined,
      },
      {
        path: 'rows.a',
        next: row('a', 1),
        prev: row('a'),
        ownerPath: 'rows',
        subjects: [1],
        effect: undefined,
      },
      {
        path: 'rows.q',
        next: row('q', 1),
        prev: undefined,
        ownerPath: 'rows',
        subjects: [4],
        // Final-order neighbours.
        effect: {
          kind: 'add',
          subject: 4,
          key: 'q',
          value: row('q', 1),
          beforeSubject: 3,
          afterSubject: 1,
        },
      },
    ]);
  });

  it('records adjacent removals with their removed neighbours', () => {
    const { api, notify, publications } = harness();
    api.setAll(['a', 'b', 'c', 'd'].map((id) => row(id)));
    notify.mockClear();

    api.setAll([row('d')]);

    expect(publications().map(({ effect }) => effect)).toEqual([
      expect.objectContaining({
        key: 'a',
        beforeSubject: undefined,
        afterSubject: 2,
      }),
      expect.objectContaining({ key: 'b', beforeSubject: 1, afterSubject: 3 }),
      expect.objectContaining({ key: 'c', beforeSubject: 2, afterSubject: 4 }),
      undefined,
    ]);
  });

  it('adds at the ends anchor to nothing on the open side', () => {
    const { api, notify, publications } = harness();
    api.setAll([row('m')]);
    notify.mockClear();

    api.setAll([row('x'), row('m'), row('y')]);

    expect(publications().map(({ effect }) => effect)).toEqual([
      undefined,
      expect.objectContaining({
        key: 'x',
        beforeSubject: undefined,
        afterSubject: 1,
      }),
      expect.objectContaining({
        key: 'y',
        beforeSubject: 1,
        afterSubject: undefined,
      }),
    ]);
  });

  it('a duplicate key runs interceptors per occurrence and the last value wins', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { api, log, notify, publications } = harness();
      api.setAll([row('e')]);
      notify.mockClear();
      log.length = 0;

      api.setAll([row('x', 1), row('e', 1), row('x', 2), row('e', 2)]);

      // First-occurrence order, last value.
      expect(api.ids()).toEqual(['x', 'e']);
      expect(api.all()).toEqual([row('x', 2), row('e', 2)]);
      expect(log).toEqual([
        ['intercept:add', 'x', 1],
        ['intercept:update', 'e', 1],
        ['intercept:add', 'x', 2],
        ['intercept:update', 'e', 2],
        ['tap:add', 'x', 2],
        ['tap:update', 'e', 2],
      ]);
      expect(publications().map(({ path, next }) => [path, next])).toEqual([
        ['rows.e', row('e', 2)],
        ['rows.x', row('x', 2)],
      ]);
      // Updates, then adds.
      expect(getOwnedSubjectIds(api)).toEqual([1, 2]);
    } finally {
      warn.mockRestore();
    }
  });

  it('an interceptor transform replaces what is stored and published', () => {
    const notify = vi.fn();
    const api = createEntitySignal<Row, string>(
      { selectId: (r) => r.id },
      { notify, hasObservers: () => true } as never,
      'rows'
    );
    api.setAll([row('a')]);
    api.intercept({
      onAdd: (entity, ctx) => ctx.transform({ ...entity, n: 100 }),
      onUpdate: (_id, changes, ctx) =>
        ctx.transform({ ...(changes as Row), n: 200 }),
    });
    notify.mockClear();

    api.setAll([row('a', 1), row('b', 1)]);

    expect(api.all()).toEqual([row('a', 200), row('b', 100)]);
    expect(notify.mock.calls.map((call) => call[1])).toEqual([
      row('a', 200),
      row('b', 100),
    ]);
  });

  it('a blocking interceptor leaves the collection untouched', () => {
    const notify = vi.fn();
    const api = createEntitySignal<Row, string>(
      { selectId: (r) => r.id },
      { notify, hasObservers: () => true } as never,
      'rows'
    );
    api.setAll([row('a'), row('b')]);
    api.intercept({ onRemove: (_id, _entity, ctx) => ctx.block('kept') });
    notify.mockClear();

    expect(() => api.setAll([row('a', 1), row('c')])).toThrow(
      'Cannot remove entity: kept'
    );
    expect(api.ids()).toEqual(['a', 'b']);
    expect(api.all()).toEqual([row('a'), row('b')]);
    expect(notify).not.toHaveBeenCalled();

    api.intercept({ onUpdate: (_id, _changes, ctx) => ctx.block('frozen') });
    expect(() => api.setAll([row('a', 1), row('b')])).toThrow(
      'Cannot replace entity: frozen'
    );
    expect(api.all()).toEqual([row('a'), row('b')]);
  });

  it('reaches a reader of one realized row, and only through that row', () => {
    const api = createEntitySignal<Row, string>(
      { selectId: (r) => r.id },
      { notify: vi.fn(), hasObservers: () => false } as never,
      'rows'
    );
    api.setAll([row('a'), row('b')]);
    let runs = 0;
    const n = NEUTRAL_LOCATION_RUNTIME.createDerived(() => {
      runs += 1;
      return api.byId('a')?.()?.n;
    });
    expect(n()).toBe(0);

    api.setAll([row('a', 1), row('b')]);
    expect(n()).toBe(1);

    api.setAll([row('a', 2)]);
    expect(n()).toBe(2);

    // Untouched by a write that does not include it.
    const before = runs;
    api.updateOne('a', { n: 2 });
    expect(n()).toBe(2);
    expect(runs).toBe(before + 1);
    api.addOne(row('z'));
    expect(n()).toBe(2);
    expect(runs).toBe(before + 1);
  });
});

describe('setAll interceptor reentry', () => {
  it('keeps membership coherent when an update interceptor rekeys the row', () => {
    const { api } = harness();
    api.setAll([row('a')]);
    api.intercept({
      onUpdate: () => {
        api.changeId('a', 'b');
      },
    });
    // A refusal is allowed; applying stale staging is not. The interceptor's
    // completed write remains authoritative even if the outer operation fails.
    try {
      api.setAll([row('a', 1)]);
    } catch {
      /* inspect state below */
    }
    expect(api.has('b')()).toBe(true);
    expect(api.ids()).toEqual(['b']);
    expect(api.count()).toBe(1);
    // changeId moves the collection key; it does not rewrite row data.
    expect(api.byId('b')?.()).toEqual(row('a'));
  });
});

describe('setAll invalidated staging', () => {
  it('preserves an add interceptor write without committing the stale outer add', () => {
    const { api } = harness();
    api.setAll([row('a')]);
    api.intercept({
      onAdd: (entity) => {
        if (entity.id === 'q') api.addOne(row('extra'));
      },
    });
    expect(() => api.setAll([row('q')])).toThrow(/topology changed/);
    expect(api.ids()).toEqual(['a', 'extra']);
    expect(api.all()).toEqual([row('a'), row('extra')]);
  });

  it('preserves a removal interceptor rekey before any outer removals commit', () => {
    const { api } = harness();
    api.setAll([row('a'), row('b')]);
    api.intercept({
      onRemove: () => {
        api.changeId('b', 'c');
      },
    });
    expect(() => api.setAll([row('b', 1)])).toThrow(/topology changed/);
    expect(api.ids()).toEqual(['a', 'c']);
    expect(api.all()).toEqual([row('a'), row('b')]);
  });

  it('allows field-only reentry that does not invalidate the topology plan', () => {
    const { api } = harness();
    api.setAll([row('a')]);
    let nested = false;
    api.intercept({
      onUpdate: () => {
        if (!nested) {
          nested = true;
          api.updateOne('a', { n: 2 });
        }
      },
    });
    api.setAll([row('a', 3)]);
    expect(api.all()).toEqual([row('a', 3)]);
  });
});

it('preserves membership when a selector rekeys an earlier staged row', () => {
  const api = createEntitySignal<Row, string>(
    { selectId: (r) => r.id },
    { notify: vi.fn() } as never,
    'rows'
  );
  api.setAll([row('a'), row('z')]);
  try {
    api.setAll([row('a', 1), row('z', 1)], {
      selectId: (r) => {
        if (r.id === 'z') api.changeId('a', 'b');
        return r.id;
      },
    });
  } catch {
    /* the completed selector write must remain coherent */
  }
  expect(api.has('b')()).toBe(true);
  expect(api.ids()).toEqual(['b', 'z']);
  expect(api.count()).toBe(2);
});
