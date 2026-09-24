import { describe, expect, it, vi } from 'vitest';
import { signalTree } from './signal-tree';
import { link } from './link';
import { transactions } from '../enhancers/transactions/transactions';
import { getPathNotifier } from './path-notifier';

const flush = async () => {
  getPathNotifier().flushSync();
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe.each([false, true])(
  'structured link addresses, capture=%s',
  (capture) => {
    it('keeps literal and nested keys distinct in root reconstruction', async () => {
      const tree = signalTree(
        { 'a.b': 0, a: { b: 0 } },
        { enhancers: capture ? [transactions()] : [] }
      );
      const sent: unknown[] = [];
      const relationship = link(tree.$, {
        set: (v) => {
          sent.push(v);
        },
      });
      try {
        tree.$['a.b'](1);
        tree.$.a.b(2);
        await flush();
        await relationship.settled();
        expect(sent).toEqual([{ 'a.b': 1, a: { b: 2 } }]);
      } finally {
        relationship.dispose();
        tree.destroy();
      }
    });
    it('does not admit a same-spelled unrelated scalar notification', async () => {
      const tree = signalTree(
        { 'a.b': 0, a: { b: 0 } },
        { enhancers: capture ? [transactions()] : [] }
      );
      const sent: unknown[] = [];
      const relationship = link(tree.$['a.b'], {
        set: (v) => {
          sent.push(v);
        },
      });
      try {
        tree.$.a.b(2);
        await flush();
        await relationship.settled();
        expect(sent).toEqual([]);
      } finally {
        relationship.dispose();
        tree.destroy();
      }
    });
    it('does not admit a same-prefix unrelated branch notification', async () => {
      const tree = signalTree(
        { 'a.b': 0, a: { b: 0 } },
        { enhancers: capture ? [transactions()] : [] }
      );
      const sent: unknown[] = [];
      const relationship = link(tree.$.a, {
        set: (v) => {
          sent.push(v);
        },
      });
      const root = link(tree.$, { set: () => undefined });
      try {
        tree.$['a.b'](1);
        await flush();
        await relationship.settled();
        expect(sent).toEqual([]);
      } finally {
        root.dispose();
        relationship.dispose();
        tree.destroy();
      }
    });
  }
);

// Structural-address controls exercise the same runtime seams as the existing
// dynamic-member-reactivation suite; this does not introduce a public marker.
import { entityMap } from './types';
import { withWriteContext } from './write-context';
import {
  materializeMember,
  ordinaryBranch,
  registerMarkerProcessor,
} from './internals/materialize-markers';
import type { Location } from './internals/cell-runtime';
import {
  getNodeAddress,
  getPositionRegistry,
} from './internals/position-registry';

const DYNAMIC = Symbol('link.address.dynamic');
type DynamicMarker = { [DYNAMIC]: true; seed: Record<string, unknown> };
registerMarkerProcessor(
  (value: unknown): value is DynamicMarker =>
    typeof value === 'object' && value !== null && DYNAMIC in value,
  (marker: DynamicMarker) => ordinaryBranch(marker.seed, { keyedLookup: true })
);

it.each([false, true])(
  'distinguishes empty keys from the root and its siblings, capture=%s',
  async (capture) => {
    const tree = signalTree(
      { '': { x: 0 }, x: 0 },
      { enhancers: capture ? [transactions()] : [] }
    );
    const rootSent: unknown[] = [];
    const branchSent: unknown[] = [];
    const root = link(tree.$, {
      set: (v) => {
        rootSent.push(v);
      },
    });
    const branch = link(tree.$[''], {
      set: (v) => {
        branchSent.push(v);
      },
    });
    try {
      tree.$.x(1);
      tree.$[''].x(2);
      await flush();
      await Promise.all([root.settled(), branch.settled()]);
      expect(rootSent).toEqual([{ '': { x: 2 }, x: 1 }]);
      expect(branchSent).toEqual([{ x: 2 }]);
    } finally {
      root.dispose();
      branch.dispose();
      tree.destroy();
    }
  }
);

it('distinguishes an empty scalar property from a whole-source replacement', async () => {
  const tree = signalTree({ '': 0, x: 0 });
  const sent: unknown[] = [];
  const connection = link(tree.$, {
    set: (v) => {
      sent.push(v);
    },
  });
  try {
    tree.$[''](3);
    await flush();
    await connection.settled();
    expect(sent).toEqual([{ '': 3, x: 0 }]);
  } finally {
    connection.dispose();
    tree.destroy();
  }
});

it.each([false, true])(
  'reactivates a retained dotted leaf with its structural address, capture=%s',
  async (capture) => {
    const initial: { 'a.b'?: number; a: { b: number } } = {
      'a.b': 0,
      a: { b: 0 },
    };
    const tree = signalTree(initial, {
      enhancers: capture ? [transactions()] : [],
    });
    const retained = tree.$['a.b'] as Location<number | undefined>;
    tree.$({ a: { b: 0 } });
    await flush();
    const sent: unknown[] = [];
    const connection = link(tree.$, {
      set: (v) => {
        sent.push(v);
      },
    });
    try {
      retained(7);
      await flush();
      await connection.settled();
      expect(sent).toEqual([{ 'a.b': 7, a: { b: 0 } }]);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  }
);

it.each([false, true])(
  'links a dynamically acquired dotted member, capture=%s',
  async (capture) => {
    const marker: DynamicMarker = { [DYNAMIC]: true, seed: { seed: { n: 0 } } };
    const tree = signalTree(
      { users: marker },
      { enhancers: capture ? [transactions()] : [] }
    );
    const users = tree.$.users as unknown as ((value?: object) => unknown) &
      object;
    const member = materializeMember(users, 'a.b', { 'x.y': 0 }) as {
      'x.y': Location<number>;
    };
    const sent: unknown[] = [];
    const connection = link(
      member as never,
      {
        set: (v: unknown) => {
          sent.push(v);
        },
      } as never
    );
    try {
      member['x.y'](5);
      await flush();
      await connection.settled();
      expect(sent).toEqual([{ 'x.y': 5 }]);
      expect(getNodeAddress(member)).toEqual(['users', 'a.b']);
    } finally {
      connection.dispose();
      tree.destroy();
    }
  }
);

it('scopes a live enhanced branch to a later dynamic dotted member', async () => {
  const marker: DynamicMarker = { [DYNAMIC]: true, seed: { seed: { n: 0 } } };
  const tree = signalTree({ users: marker }, { enhancers: [transactions()] });
  const users = tree.$.users as unknown as ((value?: object) => unknown) &
    object;
  const sent: unknown[] = [];
  const connection = link(
    users as never,
    {
      set: (v: unknown) => {
        sent.push(v);
      },
    } as never
  );
  try {
    const member = materializeMember(users, 'a.b', { 'x.y': 0 }) as {
      'x.y': Location<number>;
    };
    member['x.y'](5);
    await flush();
    await connection.settled();
    expect(sent.at(-1)).toEqual({ seed: { n: 0 }, 'a.b': { 'x.y': 5 } });
  } finally {
    connection.dispose();
    tree.destroy();
  }
});

it('keeps colliding collection display paths separate for row updates and reorder', async () => {
  type Row = { id: number; n: string };
  const tree = signalTree({
    'a.b': entityMap<Row, number>(),
    a: { b: entityMap<Row, number>() },
  });
  const sent: unknown[] = [];
  const root = link(
    tree.$ as never,
    {
      set: (v: unknown) => {
        sent.push(v);
      },
    } as never
  );
  try {
    tree.$['a.b'].setAll([
      { id: 1, n: 'literal' },
      { id: 2, n: 'two' },
    ]);
    tree.$.a.b.setAll([{ id: 1, n: 'nested' }]);
    await flush();
    const before = sent.length;
    tree.$['a.b'].setAll([
      { id: 2, n: 'two' },
      { id: 1, n: 'literal' },
    ]);
    await flush();
    await root.settled();
    expect(sent.length).toBeGreaterThan(before);
    expect(sent.at(-1)).toEqual({
      'a.b': {
        all: [
          { id: 2, n: 'two' },
          { id: 1, n: 'literal' },
        ],
      },
      a: { b: { all: [{ id: 1, n: 'nested' }] } },
    });
  } finally {
    root.dispose();
    tree.destroy();
  }
});

it('does not re-read an inspection value while reconstructing a dotted write', async () => {
  const tree = signalTree({ 'a.b': 0, a: { b: 0 } });
  const sent: unknown[] = [];
  const root = link(tree.$, {
    set: (v) => {
      sent.push(v);
    },
  });
  try {
    tree.$['a.b'](1);
    withWriteContext(
      { intent: 'system', origin: 'devtools', participation: 'inspection' },
      () => tree.$.a.b(9)
    );
    await flush();
    await root.settled();
    expect(sent).toEqual([{ 'a.b': 1, a: { b: 0 } }]);
    expect(tree.$.a.b()).toBe(9);
  } finally {
    root.dispose();
    tree.destroy();
  }
});

it('does not guess a display path when a notification address is unavailable', async () => {
  const tree = signalTree({ x: 0 });
  const sent: unknown[] = [];
  const root = link(tree.$, {
    set: (v) => {
      sent.push(v);
    },
  });
  try {
    getPathNotifier().notify(
      'x',
      99,
      0,
      'x',
      undefined,
      [Number.MAX_SAFE_INTEGER],
      undefined,
      getPositionRegistry(tree.$)?.id
    );
    await flush();
    await root.settled();
    expect(sent).toEqual([]);
  } finally {
    root.dispose();
    tree.destroy();
  }
});

it('keeps numeric and string entity keys distinct through same-turn edits and key reuse', async () => {
  type Row = { id: number | string; n: number };
  const tree = signalTree({ rows: entityMap<Row, number | string>() });
  const collection = link(tree.$.rows, { set: () => undefined });
  tree.$.rows.setAll([
    { id: 1, n: 0 },
    { id: '1', n: 0 },
  ]);
  await flush();
  const numeric: unknown[] = [];
  const textual: unknown[] = [];
  const a = link(tree.$.rows.byIdOrFail(1).n, {
    set: (value) => {
      numeric.push(value);
    },
  });
  const b = link(tree.$.rows.byIdOrFail('1').n, {
    set: (value) => {
      textual.push(value);
    },
  });
  try {
    tree.$.rows.updateOne(1, { n: 10 });
    tree.$.rows.updateOne('1', { n: 20 });
    await flush();
    tree.$.rows.changeId(1, 2);
    tree.$.rows.removeOne(2);
    tree.$.rows.addOne({ id: 2, n: 99 });
    tree.$.rows.updateOne('1', { n: 21 });
    await flush();
    await Promise.all([a.settled(), b.settled(), collection.settled()]);
    expect(numeric).toEqual([10, undefined]);
    expect(textual).toEqual([20, 21]);
  } finally {
    a.dispose();
    b.dispose();
    collection.dispose();
    tree.destroy();
  }
});

it('retains structured ownership with production diagnostics disabled', async () => {
  vi.stubGlobal('ngDevMode', false);
  const tree = signalTree({ 'a.b': 0, a: { b: 0 } });
  const sent: unknown[] = [];
  let connection: ReturnType<typeof link> | undefined;
  try {
    connection = link(tree.$, {
      set: (value) => {
        sent.push(value);
      },
    });
    tree.$['a.b'](1);
    tree.$.a.b(2);
    await flush();
    await connection.settled();
    expect(sent).toEqual([{ 'a.b': 1, a: { b: 2 } }]);
  } finally {
    connection?.dispose();
    tree.destroy();
    vi.unstubAllGlobals();
  }
});
