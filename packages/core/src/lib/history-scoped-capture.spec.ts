import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { undoable } from '../lib/undoable';

import { entityMap } from './types';
import { signalTree } from './signal-tree';
import { timeTravel } from '../enhancers/time-travel/time-travel';

/**
 * ST2029 — time travel retention warning.
 *
 * `entityMap`'s snapshot is `{ all: node.all() }`, an N-pointer array rebuilt
 * whenever the collection changes, and time travel records on every self-dirty
 * flush — so attaching `timeTravel()` to a tree holding a large collection makes
 * every collection-mutating write O(collection width), permanently. MEASURED
 * (`tools/bench-retention-arms.mjs`, 50 recorded writes at 50k rows): 19.38MB
 * retained.
 *
 * This file used to be the RFC 0012 suite for
 * `entityMap({ recordHistory: false })`, which was DELETED in 15.0 — it
 * implemented location-scoped history, the model HIST-0 case 4 refuted and which
 * was measured partially reversing an atomically authored turn. The retention
 * warning survives it; the escape hatch it used to recommend does not.
 */
type Row = { id: number; value: number };
const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: i, value: i }));

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('ST2029 — history retention', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  const msg = () => warn.mock.calls.map((c) => String(c[0])).join('\n');

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {
      /* silence */
    });
  });
  afterEach(() => warn.mockRestore());

  /** Build, attach, THEN load — the order every app uses. */
  async function appOrder(
    config: Parameters<typeof entityMap<Row, number>>[0],
    width: number,
    writes: number
  ) {
    const tree = signalTree(
      {
        rows: entityMap<Row, number>(config),
        n: 0,
      },
      { enhancers: [timeTravel()], capabilities: ['causal-runtime'] }
    );
    warn.mockClear();

    undoable(() => tree.$.rows.setAll(rows(width)));
    await flush();
    for (let i = 1; i <= writes; i++) {
      // Designated: ST2029 warns on RETAINED history entries, so the churn it
      // measures has to be retained. Undesignated writes retain nothing and the
      // warning could never fire.
      undoable(() => (tree as unknown as (v: object) => void)({ n: i }));
      await flush();
    }
    return tree;
  }

  it('fires when the rows arrive AFTER the enhancer is attached', async () => {
    // 20,000 x ~35 entries = ~700k retained pointers, past the 500k budget.
    await appOrder({ selectId: (r) => r.id }, 20_000, 34);

    expect(msg()).toContain('ST2029');
    expect(msg()).toContain('rows');
  });

  // The `recordHistory: false` arm was DELETED in 15.0 with the option. It
  // asserted that opting a collection out silenced the warning — which was true,
  // and was exactly the location-scoped model HIST-0 case 4 refuted. The two
  // arms below carry the point that actually matters: this warning is judged on
  // RETENTION (entries x width), not on row count.

  it('does NOT fire for a big collection with a SHORT history', async () => {
    // Retention is entries x width. A row-count threshold judges this wrong.
    await appOrder({ selectId: (r) => r.id }, 20_000, 2);

    expect(msg()).not.toContain('ST2029');
  });

  it('does NOT fire for a small collection with a LONG history', async () => {
    // The other half of the same point.
    await appOrder({ selectId: (r) => r.id }, 50, 34);

    expect(msg()).not.toContain('ST2029');
  });
});
