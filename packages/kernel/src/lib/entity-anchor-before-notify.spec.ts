import { describe, expect, it } from 'vitest';
import { createEntitySignal } from './entity-signal';

/**
 * Every fresh row's add-effect anchors are read from the committed order
 * BEFORE the call announces anything.
 *
 * Review of bf64f92e: prependMany read each prepended row's neighbours live,
 * inside the notify loop. A port that delivers synchronously lets its
 * subscriber write during that loop, so a row removed while the first row was
 * announced left the next row's anchor pointing past it — not at the order
 * the call committed.
 */
type Row = { id: string; n: number };
type Effect = { kind: string; key: string; beforeSubject?: number; afterSubject?: number };

function harness(onFirstNotify: (api: Api) => void) {
  const effects: Effect[] = [];
  let armed = false;
  const port = {
    hasObservers: () => true,
    notify: (...args: unknown[]) => {
      const effect = (args[6] as { structuralEffect?: Effect } | undefined)
        ?.structuralEffect;
      if (effect?.kind === 'add') effects.push({ ...effect });
      if (armed) {
        armed = false;
        onFirstNotify(api);
      }
    },
  };
  // `port` reaches `api` only when it is called, after this line.
  const api: Api = createEntitySignal<Row, string>(
    { selectId: (row) => row.id },
    port as never,
    'rows'
  );
  api.addMany([
    { id: 'z', n: 0 },
    { id: 'a', n: 1 },
  ]);
  effects.length = 0;
  return {
    api,
    effects,
    arm: () => {
      armed = true;
    },
  };
}
type Api = ReturnType<typeof createEntitySignal<Row, string>>;
const anchors = (effects: Effect[]) =>
  effects.map(({ key, beforeSubject, afterSubject }) => [
    key,
    beforeSubject,
    afterSubject,
  ]);

describe('add anchors are read before any notification', () => {
  it('prependMany: a synchronous subscriber removing a row does not move the next anchor', () => {
    const { api, effects, arm } = harness((tree) => tree.removeOne('z'));
    arm();
    api.prependMany([
      { id: 'x', n: 1 },
      { id: 'y', n: 2 },
    ]);
    // Committed order: x(3) y(4) z(1) a(2).
    expect(anchors(effects)).toStrictEqual([
      ['x', undefined, 4],
      ['y', 3, 1],
    ]);
    expect(api.ids()).toStrictEqual(['x', 'y', 'a']);
  });

  it('prependOne: the same with one row and a subscriber removing its successor', () => {
    const { api, effects, arm } = harness((tree) => tree.removeOne('z'));
    arm();
    api.prependOne({ id: 'x', n: 1 });
    expect(anchors(effects)).toStrictEqual([['x', undefined, 1]]);
  });

  it('addMany: appended anchors chain from the committed order too', () => {
    const { api, effects, arm } = harness((tree) => tree.removeOne('a'));
    arm();
    api.addMany([
      { id: 'x', n: 1 },
      { id: 'y', n: 2 },
    ]);
    // Committed order: z(1) a(2) x(3) y(4).
    expect(anchors(effects)).toStrictEqual([
      ['x', 2, undefined],
      ['y', 3, undefined],
    ]);
  });
});
