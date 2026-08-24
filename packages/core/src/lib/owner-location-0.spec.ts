import { describe, expect, it } from 'vitest';

import { asyncSource } from './markers/async-source';
import { compared } from './markers/compared';
import { entityMap } from './types';
import {
  getOwnedOwnerPath,
  getOwnedPositionIds,
} from './internals/owned-metadata';
import { getPositionRegistry } from './internals/position-registry';
import { restoration } from '../enhancers/restoration/restoration';
import { signalTree } from './signal-tree';
import { stored } from './markers/stored';
import { transactions } from '../enhancers/transactions/transactions';

/**
 * OWNER-LOCATION-0 — an INVENTORY, before any invariant is stated.
 *
 * ENTITY-LINK-0 found that `entityMap` carries a positionId and an ownerPath and
 * is reversed by restoration as its own position, while lacking the registry
 * back-reference. The temptation is to hand collections a registry so `link()`
 * accepts them. ⚠️ That is the reasoning this audit refuses: the fix would be
 * chosen by what one API wants rather than by what the model says.
 *
 * ```text
 * NULL       every independently addressable SignalTree state position already
 *            carries enough ownership identity to name its tree; entityMap is
 *            intentionally exceptional
 * FALSIFIER  OTHER addressable positions also carry positionId / ownerPath while
 *            lacking the registry back-reference
 * ```
 *
 * The distinction being drawn:
 *
 * ```text
 * OWNER-REPLAY-2   every VALUE-CARRYING MUTATION names its owning tree  (done)
 * candidate here   every ADDRESSABLE LOCATION names its owning tree     (open)
 * ```
 *
 * Those are different invariants over different things, and the second is not
 * implied by the first.
 *
 * ## RESULT — the NULL is FALSIFIED, and entityMap was NOT exceptional
 *
 * ```text
 * addressable WITH owner      tree.$, branch, leaf, nested leaf, compared
 * addressable WITHOUT owner   entityMap, stored          <- BOTH, not one
 * not addressable at all      asyncSource (no positionId, no ownerPath)
 * ```
 *
 * The pattern is mechanical rather than semantic: the registry is attached at
 * the leaf/branch construction sites in `signal-tree.ts`, and a MARKER builds
 * its own node, so both marker-constructed positions missed it. `compared` has
 * it only because it routes through `wrapLeafSignal`.
 *
 * So the invariant the inventory supports is:
 *
 * > **Every independently addressable SignalTree state position names its
 * > owning PositionRegistry.**
 *
 * Fixed at the two MARKER CONSTRUCTION BOUNDARIES — `stored.ts` and
 * `entity-map.ts` — not at `link()`, and not by special-casing collections.
 */

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

type Row = { id: string; n: number };

type Shape = {
  positionIds: boolean;
  ownerPath: boolean;
  registry: boolean;
  callable: boolean;
};

const shapeOf = (node: unknown): Shape => ({
  positionIds: getOwnedPositionIds(node) !== undefined,
  ownerPath: getOwnedOwnerPath(node) !== undefined,
  registry: getPositionRegistry(node) !== undefined,
  callable: typeof node === 'function',
});

describe('OWNER-LOCATION-0: which node kinds name their owning tree?', () => {
  it('⚠️ the inventory across every materialisable node kind in core', async () => {
    const tree = signalTree(
      {
        leaf: 'l0',
        branch: { nested: 1 },
        rows: entityMap<Row, string>({ selectId: (r) => r.id }),
        cmp: compared({ a: 1 }, (x, y) => JSON.stringify(x) === JSON.stringify(y)),
        kept: stored('owner-location-0', 'v', { debounceMs: 0 }),
        src: asyncSource({ initial: 0, load: () => Promise.resolve(1) }),
      },
      { enhancers: [restoration(), transactions()] }
    );
    await flush();
    // Force marker materialisation.
    void tree.$.cmp;
    void tree.$.kept;
    void tree.$.src;
    await flush();

    const inventory: Record<string, Shape> = {
      'tree (root)': shapeOf(tree),
      'tree.$ (namespace)': shapeOf(tree.$),
      'branch accessor': shapeOf(tree.$.branch),
      leaf: shapeOf(tree.$.leaf),
      'nested leaf': shapeOf(tree.$.branch.nested),
      'entityMap node': shapeOf(tree.$.rows),
      'compared node': shapeOf(tree.$.cmp),
      'stored node': shapeOf(tree.$.kept),
      'asyncSource node': shapeOf(tree.$.src),
    };

    for (const [name, s] of Object.entries(inventory)) {
      // eslint-disable-next-line no-console
      console.log(
        `${name.padEnd(20)} pos=${s.positionIds ? 'Y' : 'n'} ownerPath=${
          s.ownerPath ? 'Y' : 'n'
        } registry=${s.registry ? 'Y' : 'n'} callable=${s.callable ? 'Y' : 'n'}`
      );
    }

    // ⚠️ THE FALSIFIER, stated as data rather than as a prediction: every node
    // that is addressable (has a positionId AND an ownerPath) but cannot name
    // its registry.
    const addressableWithoutOwner = Object.entries(inventory)
      .filter(([, s]) => s.positionIds && s.ownerPath && !s.registry)
      .map(([name]) => name);

    // eslint-disable-next-line no-console
    console.log('ADDRESSABLE-WITHOUT-OWNER:', JSON.stringify(addressableWithoutOwner));

    // The control: SOMETHING must be addressable-with-owner, or the query is
    // matching nothing for the wrong reason.
    const addressableWithOwner = Object.entries(inventory)
      .filter(([, s]) => s.positionIds && s.ownerPath && s.registry)
      .map(([name]) => name);
    expect(addressableWithOwner.length).toBeGreaterThan(0);

    expect(addressableWithoutOwner).toEqual([]);
  });
});

describe('OWNER-LOCATION-0: the invariant holds across trees', () => {
  it('two trees with the SAME collection path resolve DIFFERENT registries', async () => {
    const make = () =>
      signalTree(
        { data: { rows: entityMap<Row, string>({ selectId: (r) => r.id }) } },
        { enhancers: [restoration(), transactions()] }
      );
    const a = make();
    const b = make();
    await flush();

    const regA = getPositionRegistry(a.$.data.rows);
    const regB = getPositionRegistry(b.$.data.rows);

    expect(regA).toBeDefined();
    expect(regB).toBeDefined();
    expect(regA).not.toBe(regB);

    // Each resolves the SAME registry its own tree does — the point of the
    // invariant is that a location can name its tree, not merely that two
    // locations differ.
    expect(regA).toBe(getPositionRegistry(a.$));
    expect(regB).toBe(getPositionRegistry(b.$));

    // And the local position numbers still collide, deliberately: the namespace
    // is named, not eliminated.
    expect(getOwnedPositionIds(a.$.data.rows)).toEqual(
      getOwnedPositionIds(b.$.data.rows)
    );
  });

  it('a stored() node likewise names its own tree', async () => {
    const make = (key: string) =>
      signalTree(
        { kept: stored(key, 'v', { debounceMs: 0 }) },
        { enhancers: [restoration()] }
      );
    const a = make('owner-location-0-a');
    const b = make('owner-location-0-b');
    await flush();
    void a.$.kept;
    void b.$.kept;
    await flush();

    expect(getPositionRegistry(a.$.kept)).toBe(getPositionRegistry(a.$));
    expect(getPositionRegistry(b.$.kept)).toBe(getPositionRegistry(b.$));
    expect(getPositionRegistry(a.$.kept)).not.toBe(getPositionRegistry(b.$.kept));
  });
});
