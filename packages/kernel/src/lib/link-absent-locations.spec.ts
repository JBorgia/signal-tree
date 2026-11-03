import { describe, expect, it } from 'vitest';

import {
  entityMap,
  link,
  restoration,
  signalTree,
  transactions,
  undoable,
} from '../index';
import { getPathNotifier } from './path-notifier';
import { plainBranchMembershipChange } from './internals/plain-branch-membership';

/**
 * Ported from v15 c6258aab in v16 slice 8g (v15 port review of
 * 67012241..12187613, item 4). Owner decision: Link and path observers see
 * exactly what the tree exposes.
 *
 * - A location that reads absent (it, or a member above it, omitted) is
 *   `undefined` to a Link endpoint, and `[]` for a collection.
 * - Undo, redo, jumpTo and rollback write retained storage too; they never
 *   publish a retained value for a location they leave absent. They sent the
 *   retained value to the endpoint, and announced it on the location's path.
 * - A re-add publishes exactly what the location then reads.
 *
 * Every step below checks the endpoint against what the tree exposes, and
 * every value a path subscriber received in that step against what the tree
 * reads at that path.
 */
type Row = { id: string; n: number };
type Tree = {
  $: ((value?: unknown) => unknown) & {
    count: (value?: number) => number;
    a: ((value?: unknown) => unknown) & {
      value: (value?: number) => number | undefined;
      keep: (value?: number) => number | undefined;
      rows: {
        all(): Row[];
        setAll(rows: Row[]): void;
        addOne(row: Row): void;
      };
    };
  };
  undo(): void;
  redo(): void;
  jumpTo(index: number): void;
  getCurrentIndex(): number;
  transact(run: () => void): { rollback(): void };
  destroy(): void;
};

const tick = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const R = { id: 'r', n: 1 };

/** The value at `segments` of the tree's current value, or absence. */
const readAt = (
  value: unknown,
  segments: readonly string[]
): { present: boolean; value?: unknown } => {
  let at = value;
  for (const key of segments) {
    if (
      at === null ||
      typeof at !== 'object' ||
      !Object.prototype.hasOwnProperty.call(at, key)
    )
      return { present: false };
    at = (at as Record<string, unknown>)[key];
  }
  return { present: true, value: at };
};

type Source = {
  name: string;
  of: (tree: Tree) => unknown;
  segments: readonly string[];
  absent: unknown;
  /** What the endpoint should hold when the location is present. */
  exposed: (tree: Tree) => unknown;
};
const sources: Source[] = [
  {
    name: 'a leaf',
    of: (tree) => tree.$.a.value,
    segments: ['a', 'value'],
    absent: undefined,
    exposed: (tree) => tree.$.a.value(),
  },
  {
    name: 'a branch',
    of: (tree) => tree.$.a,
    segments: ['a'],
    absent: undefined,
    exposed: (tree) => tree.$.a(),
  },
  {
    name: 'a collection',
    of: (tree) => tree.$.a.rows,
    segments: ['a', 'rows'],
    absent: [],
    exposed: (tree) => tree.$.a.rows.all(),
  },
];

const configurations = [
  ['no enhancers', () => []],
  ['transactions(), restoration()', () => [transactions(), restoration()]],
  ['restoration(), transactions()', () => [restoration(), transactions()]],
] as const;

const harness = async (source: Source, enhancers: () => readonly unknown[]) => {
  const tree = signalTree(
    {
      a: { value: 1, keep: 2, rows: entityMap<Row, string>() },
      count: 0,
    },
    { enhancers: enhancers() as never }
  ) as unknown as Tree;
  tree.$.a.rows.setAll([R]);
  await tick();
  let endpoint: unknown = JSON.parse(JSON.stringify(source.exposed(tree)));
  const connection = link(source.of(tree) as never, {
    set: (value: unknown) => {
      endpoint = value === undefined ? undefined : structuredClone(value);
    },
  });
  const pings: Array<{ path: string; value: unknown; row: boolean }> = [];
  const unsubscribe = getPathNotifier().subscribe(
    '**',
    (value, _prev, path, _owner, _origin, subjectIds, _positions, meta) => {
      if (plainBranchMembershipChange(meta)) return;
      pings.push({ path, value, row: subjectIds !== undefined });
    }
  );
  const expectExposed = async (label: string, held: boolean) => {
    await tick();
    const state = tree.$();
    const location = readAt(state, source.segments);
    // An open transaction holds the endpoint's sends until it settles.
    if (!held) {
      await connection.settled();
      expect(endpoint, `${source.name} endpoint after ${label}`).toEqual(
        location.present ? source.exposed(tree) : source.absent
      );
    }
    for (const ping of pings) {
      const segments = ping.path.split('.');
      if (ping.row) {
        // A row's change: its collection reads present.
        expect(
          readAt(state, segments.slice(0, -1)).present,
          `${ping.path} announced after ${label} while its collection is absent`
        ).toBe(true);
        continue;
      }
      const read = readAt(state, segments);
      expect(
        read.present,
        `${ping.path} announced after ${label} while it reads absent`
      ).toBe(true);
      expect(ping.value, `${ping.path} announced after ${label}`).toEqual(
        read.value
      );
    }
    pings.length = 0;
  };
  return {
    tree,
    step: async (label: string, run: () => void, held = false) => {
      pings.length = 0;
      run();
      await expectExposed(label, held);
    },
    dispose: () => {
      unsubscribe();
      connection.dispose();
      tree.destroy();
    },
  };
};

describe.each(sources)('Link and path observers on $name', (source) => {
  describe.each(configurations)('%s', (name, enhancers) => {
    it('an omission, and re-adds of the location and of a sibling', async () => {
      const { tree, step, dispose } = await harness(source, enhancers);
      try {
        await step('the omission', () => tree.$({ count: 1 }));
        await step('a re-add of a.keep', () => tree.$.a.keep(9));
        await step('a re-add of a.value', () => tree.$.a.value(7));
        await step('a re-add of a.rows', () =>
          tree.$.a.rows.addOne({ id: 's', n: 2 })
        );
        await step('a whole value that re-adds a', () =>
          tree.$({ a: { value: 3, keep: 4, rows: [R] }, count: 2 })
        );
      } finally {
        dispose();
      }
    });

    if (name === 'no enhancers') return;

    it('undo, redo and jumpTo across the omission and the re-adds', async () => {
      const { tree, step, dispose } = await harness(source, enhancers);
      try {
        const writes: Array<[string, () => void]> = [
          ['the omission', () => tree.$({ count: 1 })],
          ['a re-add of a.keep', () => tree.$.a.keep(9)],
          ['a re-add of a.value', () => tree.$.a.value(7)],
          ['a re-add of a.rows', () => tree.$.a.rows.addOne({ id: 's', n: 2 })],
        ];
        const start = tree.getCurrentIndex();
        for (const [label, write] of writes)
          await step(label, () => undoable(write));
        const latest = tree.getCurrentIndex();
        for (const [label] of [...writes].reverse())
          await step(`undo of ${label}`, () => tree.undo());
        for (const [label] of writes)
          await step(`redo of ${label}`, () => tree.redo());
        for (const [label] of [...writes].reverse().slice(0, 2))
          await step(`undo of ${label}`, () => tree.undo());
        await step('jumpTo the start', () => tree.jumpTo(start + 1));
        await step('jumpTo the latest', () => tree.jumpTo(latest));
        await step('jumpTo the omission', () => tree.jumpTo(start + 1));
      } finally {
        dispose();
      }
    });

    it('rollback of transactions that re-add the location, a sibling and the rows', async () => {
      const { tree, step, dispose } = await harness(source, enhancers);
      try {
        await step('the omission', () => tree.$({ count: 1 }));
        for (const [label, write] of [
          ['a.value', () => tree.$.a.value(8)],
          ['a.keep', () => tree.$.a.keep(4)],
          ['a.rows', () => tree.$.a.rows.addOne({ id: 'q', n: 3 })],
        ] as const) {
          let proposal!: { rollback(): void };
          await step(
            `a transaction that re-adds ${label}`,
            () => {
              proposal = tree.transact(write);
            },
            true
          );
          await step(`its rollback (${label})`, () => proposal.rollback());
        }
      } finally {
        dispose();
      }
    });
  });
});
