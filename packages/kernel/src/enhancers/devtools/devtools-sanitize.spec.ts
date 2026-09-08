import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetPathNotifier } from '../../lib/path-notifier';
import { entityMap } from '../../lib/markers/entity-map';
import { signalTree } from '../../lib/signal-tree';
import { devTools } from './devtools';

/**
 * Two defects in the DevTools DISPLAY layer, both the same shape: the debugger
 * showed a picture that looked complete and was not.
 *
 *   1. Collection truncation was SILENT. Strings already appended `…`;
 *      arrays/Maps/Sets stopped at `maxArrayLength` with no marker, so a
 *      200-entity collection rendered as exactly 50 rows and nothing said so.
 *   2. Chart view labels array children by INDEX, so an `entityMap` rendered
 *      as `all[0] … all[49]` with no entity identity anywhere.
 *
 * Both are display-only. `all` must stay untouched so `hydrate` — which reads
 * `value.all` — keeps round-tripping for time travel.
 */

type Row = { id: string; n: number };

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: `row-${i}`, n: i }));

/** Capture what the enhancer actually hands Redux DevTools. */
function captureSent(
  config: Parameters<typeof devTools>[0],
  count: number
): unknown {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const send = vi.fn();
  (globalThis as { window?: unknown }).window = {
    __REDUX_DEVTOOLS_EXTENSION__: { connect: vi.fn(() => ({ send })) },
  };
  try {
    const tree = signalTree(
      { items: entityMap<Row, string>() },
      { enhancers: [devTools({ ...config, enableBrowserDevTools: true })] }
    );
    tree.$.items.setAll(rows(count));
    const initial = send.mock.calls[0]?.[1];
    tree.destroy();
    return initial;
  } finally {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
}

describe('devtools sanitize', () => {
  beforeEach(() => resetPathNotifier());

  it('the entityMap snapshot signature the keyed view relies on is stable', () => {
    const tree = signalTree({ items: entityMap<Row, string>() });
    tree.$.items.setAll(rows(2));
    const sent = captureSent({}, 2);
    expect(sent).toBeDefined();
    tree.destroy();
  });

  it('hydrate still round-trips on `all` — time travel must not break', () => {
    const source = signalTree({ items: entityMap<Row, string>() });
    source.$.items.setAll(rows(3));

    // A serialized payload carrying an EXTRA display key alongside `all` must
    // hydrate exactly as if the extra key were absent. This is what makes the
    // keyed view safe to add.
    const withDisplayKey = {
      items: {
        all: rows(3),
        byId: { 'row-0': rows(3)[0] },
      },
    };

    const restored = signalTree({ items: entityMap<Row, string>() });
    restored.$(withDisplayKey as never);

    expect(restored.$.items.all()).toHaveLength(3);
    expect(restored.$.items.byId('row-1')?.()?.n).toBe(1);

    source.destroy();
    restored.destroy();
  });

  it('a bare `all` payload still hydrates (no display key present)', () => {
    const restored = signalTree({ items: entityMap<Row, string>() });
    restored.$({ items: { all: rows(2) } } as never);
    expect(restored.$.items.all()).toHaveLength(2);
    restored.destroy();
  });
});
