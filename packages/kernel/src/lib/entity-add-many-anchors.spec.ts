// addMany structural anchors (v16 integration slice 5, review follow-up).
//
// addMany appends fresh rows; an 'overwrite' replacement stays where it was.
// So a fresh row's predecessor is the previous fresh row of the same call, or
// the last row before the call — never an overwritten row in the middle of the
// collection. (v15 7463f4eb anchored to the previous processed row, which is
// right for 'strict' and 'skip' but not 'overwrite'.)
//
// Not covered here, and still wrong on both lines: an overwritten row itself is
// published as a structural 'add', so undo removes it. See PROGRESS.md slice
// 5, open items.
import { describe, expect, it, vi } from 'vitest';

import { createEntitySignal } from './entity-signal';
import { entityMap } from './markers/entity-map';
import { signalTree } from './signal-tree';
import { undoable } from './undoable';
import { restoration } from '../enhancers/restoration/restoration';

type Row = { id: string; n?: number };
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

function harness() {
  const notify = vi.fn();
  const api = createEntitySignal<Row, string>(
    { selectId: (r) => r.id },
    { notify, hasObservers: () => true } as never,
    'rows'
  );
  api.setAll(['k1', 'k2', 'k3', 'k4'].map((id) => ({ id })));
  notify.mockClear();
  const anchors = () =>
    notify.mock.calls.map(([path, , , , subjects, , meta]) => [
      path,
      subjects?.[0],
      (meta as { structuralEffect?: { beforeSubject?: number } })
        ?.structuralEffect?.beforeSubject,
    ]);
  return { api, anchors };
}

describe('addMany anchors', () => {
  it('chains fresh rows from the last row before the call', () => {
    const { api, anchors } = harness();
    api.addMany([{ id: 'x' }, { id: 'y' }]);
    expect(anchors()).toEqual([
      ['rows.x', 5, 4],
      ['rows.y', 6, 5],
    ]);
  });

  it('skips over rows that skip mode leaves alone', () => {
    const { api, anchors } = harness();
    api.addMany([{ id: 'k2' }, { id: 'x' }, { id: 'k1' }, { id: 'y' }], {
      mode: 'skip',
    });
    expect(anchors()).toEqual([
      ['rows.x', 5, 4],
      ['rows.y', 6, 5],
    ]);
  });

  it('never anchors a fresh row to an overwritten mid-list row', () => {
    const { api, anchors } = harness();
    api.addMany(
      [{ id: 'k2', n: 9 }, { id: 'x' }, { id: 'k1', n: 8 }, { id: 'y' }],
      { mode: 'overwrite' }
    );
    expect(api.ids()).toEqual(['k1', 'k2', 'k3', 'k4', 'x', 'y']);
    const fresh = anchors().filter(([path]) =>
      ['rows.x', 'rows.y'].includes(path as string)
    );
    expect(fresh).toEqual([
      ['rows.x', 5, 4],
      ['rows.y', 6, 5],
    ]);
  });

  it('redoes skip-mode adds after the pre-call tail', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>() },
      { enhancers: [restoration()] }
    );
    try {
      tree.$.rows.setAll(['k1', 'k2', 'k3', 'k4'].map((id) => ({ id })));
      await flush();
      undoable(() =>
        tree.$.rows.addMany(
          [{ id: 'k2' }, { id: 'x' }, { id: 'k1' }, { id: 'y' }],
          { mode: 'skip' }
        )
      );
      await flush();
      tree.undo();
      expect(tree.$.rows.ids()).toEqual(['k1', 'k2', 'k3', 'k4']);
      tree.redo();
      expect(tree.$.rows.ids()).toEqual(['k1', 'k2', 'k3', 'k4', 'x', 'y']);
    } finally {
      tree.destroy();
    }
  });
});
