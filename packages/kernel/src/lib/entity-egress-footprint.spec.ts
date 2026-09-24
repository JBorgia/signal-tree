import { describe, expect, it } from 'vitest';
import { entityMap, signalTree, transactions } from '../index';
import { link } from './link';
import { getPathNotifier } from './path-notifier';
import { withWriteContext } from './write-context';

const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const inspection = (fn: () => void) =>
  withWriteContext({ participation: 'inspection' }, fn);
type Row = { id: string; x: number; y: number };

describe('entity egress preserves authored field footprints', () => {
  it.each(['field', 'row', 'collection', 'root'] as const)(
    'does not promote an inspection sibling through a %s Link',
    async (kind) => {
      const tree = signalTree(
        { rows: entityMap<Row, string>() },
        { enhancers: [transactions()] }
      );
      tree.$.rows.addOne({ id: 'r', x: 0, y: 0 });
      await flush();
      const row = tree.$.rows.byIdOrFail('r');
      const source =
        kind === 'field'
          ? row.x
          : kind === 'row'
          ? row
          : kind === 'collection'
          ? tree.$.rows
          : tree.$;
      const sent: unknown[] = [];
      const connection = link(
        source as never,
        {
          set: (value: unknown) => {
            sent.push(value);
          },
        } as never
      );
      try {
        inspection(() => row.x(99));
        await flush();
        row.y(2);
        await flush();
        await connection.settled();
        const eligible = { id: 'r', x: 0, y: 2 };
        expect(sent).toEqual(
          kind === 'field'
            ? []
            : kind === 'row'
            ? [eligible]
            : kind === 'collection'
            ? [[eligible]]
            : [{ rows: { all: [eligible] } }]
        );
        expect(row.x()).toBe(99);
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );
  it.each(['field', 'row', 'collection'] as const)(
    'keeps an in-flight %s send isolated from an inspection sibling',
    async (kind) => {
      const tree = signalTree(
        { rows: entityMap<Row, string>() },
        { enhancers: [transactions()] }
      );
      tree.$.rows.addOne({ id: 'r', x: 0, y: 0 });
      await flush();
      const row = tree.$.rows.byIdOrFail('r');
      const source =
        kind === 'field' ? row.x : kind === 'row' ? row : tree.$.rows;
      const sent: unknown[] = [];
      let acknowledge!: () => void;
      const first = new Promise<void>((resolve) => {
        acknowledge = resolve;
      });
      const connection = link(
        source as never,
        {
          set: (value: unknown) => {
            sent.push(value);
            return sent.length === 1 ? first : undefined;
          },
        } as never
      );
      try {
        row.x(1);
        await flush();
        inspection(() => row.x(99));
        await flush();
        row.y(2);
        await flush();
        acknowledge();
        await connection.settled();
        const before = { id: 'r', x: 1, y: 0 };
        const after = { id: 'r', x: 1, y: 2 };
        expect(sent).toEqual(
          kind === 'field'
            ? [1]
            : kind === 'row'
            ? [before, after]
            : [[before], [after]]
        );
      } finally {
        acknowledge();
        connection.dispose();
        tree.destroy();
      }
    }
  );
  it('retains an authored ABA footprint without merging inspection-only keys', async () => {
    const tree = signalTree(
      { rows: entityMap<Row, string>() },
      { enhancers: [transactions()] }
    );
    tree.$.rows.addOne({ id: 'r', x: 0, y: 0 });
    await flush();
    const row = tree.$.rows.byIdOrFail('r');
    const sent: unknown[] = [];
    const connection = link(tree.$.rows, {
      set: (value) => {
        sent.push(value);
      },
    });
    try {
      inspection(() => row.x(99));
      row.y(2);
      row.y(0);
      await flush();
      await connection.settled();
      expect(sent).toEqual([[{ id: 'r', x: 0, y: 0 }]]);
      row.x(2);
      row.x(99);
      await flush();
      await connection.settled();
      expect(sent.at(-1)).toEqual([{ id: 'r', x: 99, y: 0 }]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
  it.each([
    'row-updater',
    'field-updater',
    'whole-row',
    'partial-explicit',
    'set-all',
  ] as const)(
    'preserves existing authored meaning for %s',
    async (operation) => {
      const tree = signalTree({ rows: entityMap<Row, string>() });
      tree.$.rows.addOne({ id: 'r', x: 0, y: 0 });
      await flush();
      const row = tree.$.rows.byIdOrFail('r');
      const sent: unknown[] = [];
      const connection = link(tree.$.rows, {
        set: (value) => {
          sent.push(value);
        },
      });
      try {
        inspection(() => row.x(99));
        await flush();
        if (operation === 'row-updater')
          row((current) => ({ ...current, y: 2 }));
        if (operation === 'field-updater') row.y((current) => current + 2);
        if (operation === 'whole-row') row({ id: 'r', x: 99, y: 2 });
        if (operation === 'set-all')
          tree.$.rows.setAll([{ id: 'r', x: 99, y: 2 }]);
        if (operation === 'partial-explicit')
          tree.$.rows.updateOne('r', { x: 99, y: 2 });
        await flush();
        await connection.settled();
        expect(sent.at(-1)).toEqual([
          {
            id: 'r',
            x:
              operation === 'whole-row' ||
              operation === 'partial-explicit' ||
              operation === 'set-all'
                ? 99
                : 0,
            y: 2,
          },
        ]);
      } finally {
        connection.dispose();
        tree.destroy();
      }
    }
  );
  it('identical row replacement and identity updater preserve no-op admission', async () => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    tree.$.rows.addOne({ id: 'r', x: 0, y: 0 });
    await flush();
    const row = tree.$.rows.byIdOrFail('r');
    const sent: unknown[] = [];
    const connection = link(tree.$.rows, {
      set: (value) => {
        sent.push(value);
      },
    });
    try {
      inspection(() => row.x(99));
      await flush();
      row(row());
      row((current) => current);
      await flush();
      await connection.settled();
      expect(sent).toEqual([]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  });
  it('keeps callable egress intent out of generic causal metadata', async () => {
    const tree = signalTree({ rows: entityMap<Row, string>() });
    tree.$.rows.addOne({ id: 'r', x: 0, y: 0 });
    await flush();
    const seen: unknown[] = [];
    const off = getPathNotifier().subscribe(
      '**',
      (_v, _p, path, _o, _origin, _s, _pos, meta) => {
        if (path === 'rows.r') seen.push(meta?.mutationIntent);
      }
    );
    try {
      const row = tree.$.rows.byIdOrFail('r');
      row.y((current) => current + 1);
      await flush();
      row((current) => ({ ...current, y: current.y + 1 }));
      await flush();
      expect(seen).toEqual([undefined, undefined]);
    } finally {
      off();
      tree.destroy();
    }
  });
});
