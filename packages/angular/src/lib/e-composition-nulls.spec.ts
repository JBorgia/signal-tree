import { computed } from '@angular/core';

import { entityMap, signalTree } from '../index';

type Row = { id: string; n: number };

describe('EntityMap Angular composition nulls', () => {
  it('an ordinary array position can own order while byId owns members', () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (row) => row.id }),
      order: [] as string[],
    });
    tree.$.rows.addMany([
      { id: 'a', n: 1 },
      { id: 'b', n: 2 },
    ]);
    tree.$.order.set(['a', 'b']);

    tree.$.rows.addOne({ id: 'z', n: 0 });
    tree.$.order.update((order) => ['z', ...order]);

    const ordered = computed(() =>
      tree.$.order()
        .map((id) => tree.$.rows.byId(id)?.())
        .filter(Boolean)
    );
    expect(ordered().map((row) => row?.id)).toEqual(['z', 'a', 'b']);

    tree.$.order.set(['b', 'z', 'a']);
    expect(ordered().map((row) => row?.id)).toEqual(['b', 'z', 'a']);
  });

  it('the pull surface recovers member change information by diff', () => {
    const tree = signalTree({
      rows: entityMap<Row, string>({ selectId: (row) => row.id }),
    });

    let previous = new Map<string, number>();
    const events = computed(() => {
      const next = new Map(tree.$.rows.all().map((row) => [row.id, row.n]));
      const current: string[] = [];
      for (const [id, value] of next) {
        if (!previous.has(id)) current.push(`add:${id}:${value}`);
        else if (previous.get(id) !== value) {
          current.push(`upd:${id}:{"n":${value}}`);
        }
      }
      for (const id of previous.keys()) {
        if (!next.has(id)) current.push(`rem:${id}`);
      }
      previous = next;
      return current;
    });

    tree.$.rows.addOne({ id: 'a', n: 1 });
    expect(events()).toEqual(['add:a:1']);
    tree.$.rows.updateOne('a', { n: 2 });
    expect(events()).toEqual(['upd:a:{"n":2}']);
    tree.$.rows.removeOne('a');
    expect(events()).toEqual(['rem:a']);
  });
});