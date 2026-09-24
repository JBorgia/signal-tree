import { describe, expect, it } from 'vitest';
import { PathNotifier } from './path-notifier';
import { createEntityEgressProjection } from './internals/entity-egress-projection';

describe('private entity footprint delivery', () => {
  it.each([true, false])(
    'copies literal keys before delivery (batching %s)',
    (batching) => {
      const notifier = new PathNotifier({ batching });
      const seen: unknown[] = [];
      const off = notifier.subscribe(
        '**',
        (_v, _p, _path, _o, _origin, _s, _pos, _m, _scopes, _owner, fields) => {
          expect(Object.isFrozen(fields)).toBe(true);
          seen.push(fields);
        }
      );
      const keys = ['a.b', ''];
      notifier.notify(
        'rows.r',
        { 'a.b': 1, '': 2 },
        {},
        'rows',
        [1],
        [2],
        undefined,
        3,
        keys
      );
      keys.push('injected');
      notifier.flushSync();
      expect(seen).toEqual([['a.b', '']]);
      off();
      notifier.clear();
    }
  );

  it('unions per-mutation ABA footprints without crossing inspection context', () => {
    const notifier = new PathNotifier();
    const seen: unknown[] = [];
    const off = notifier.subscribe(
      '**',
      (_v, _p, _path, _o, _origin, _s, _pos, meta, _scopes, _owner, fields) => {
        seen.push([meta?.participation, fields]);
      }
    );
    notifier.notify(
      'r',
      { x: 99, y: 0 },
      { x: 0, y: 0 },
      'rows',
      [1],
      [2],
      { participation: 'inspection' },
      3,
      ['x']
    );
    notifier.notify(
      'r',
      { x: 99, y: 2 },
      { x: 99, y: 0 },
      'rows',
      [1],
      [2],
      undefined,
      3,
      ['y']
    );
    notifier.notify(
      'r',
      { x: 99, y: 0 },
      { x: 99, y: 2 },
      'rows',
      [1],
      [2],
      undefined,
      3,
      ['y']
    );
    notifier.flushSync();
    expect(seen).toEqual([
      ['inspection', ['x']],
      [undefined, ['y']],
    ]);
    off();
    notifier.clear();
  });

  it('unknown evidence does not promote a captured row; literal and nested keys stay independent', () => {
    const projection = createEntityEgressProjection([
      { subjectId: 1, key: 'r', row: { 'a.b': 0, a: { b: 0 }, '': 0 } },
    ]);
    const captured = { 'a.b': 99, a: { b: 2 }, '': 3 };
    expect(projection.apply(1, captured, undefined, false)).toBe(false);
    expect(projection.apply(1, captured, undefined, false, ['a', ''])).toBe(
      true
    );
    expect(projection.value()).toEqual([{ 'a.b': 0, a: { b: 2 }, '': 3 }]);
  });
});
