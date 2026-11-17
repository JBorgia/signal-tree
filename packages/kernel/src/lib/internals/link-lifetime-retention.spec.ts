import { describe, expect, it } from 'vitest';

import { link, type LinkEndpoint } from '../link';
import { signalTree } from '../signal-tree';

/**
 * A Link bound to a tree retains nothing once it is disposed — by its own
 * `dispose()` or by `tree.destroy()`.
 *
 * f0f15d18 made `destroy()` reach the Links through `PositionRegistry.close`,
 * installed by `bindLinkToTree`. The closure was created INSIDE
 * `bindLinkToTree`, so it shared that call's scope with the unbind closure,
 * which captures the Link's `dispose` — and through it the Link, its endpoint
 * and the tree. The registry was reachable from every owned location, and
 * location-runtime's dependency FinalizationRegistry held a consumer's
 * dependency map strongly; that map reached the consumer itself through
 * location -> registry -> close -> dispose -> tree, so the consumer was never
 * finalized and a destroyed tree with a Link was retained forever.
 * The original reproducer was the now-retired persistence enhancer.
 * e37d1536c isolated the registry close closure; 713f8a458 later replaced the
 * finalizer's strong dependency-map holdings with cleanupEdges containing
 * weak consumer references. The abandoned derived-chain case in
 * location-runtime-retention.spec.ts covers that finalizer fix directly.
 * These cases cover current scalar/root Link ownership and release, including
 * a root endpoint that captures and reads its owner during a real delivery.
 *
 * A bare tree must be collected; a live Link retains its payload; destroying
 * the tree releases that payload. A disposed Link must also release its endpoint
 * while the owning tree remains alive and usable.
 *
 * Requires `--expose-gc` (vitest.retention.config.ts, gate `retention-gc`).
 */

const collect = () => {
  const gc = (globalThis as { gc?: () => void }).gc;
  for (let pass = 0; pass < 6; pass++) gc?.();
};

const applyPressure = async () => {
  for (let round = 0; round < 4; round++) {
    collect();
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  let ballast: object[] = [];
  for (let index = 0; index < 200_000; index++) ballast.push({ index });
  ballast = [];
  collect();
  await new Promise((resolve) => setTimeout(resolve, 20));
  collect();
};

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

const makeTree = () => signalTree({ a: 'a0', obj: null as unknown });
type Tree = ReturnType<typeof makeTree>;
const endpointFor = (): LinkEndpoint<string> => ({
  set: () => undefined,
  subscribe: () => () => undefined,
});

// Keep endpoint closures outside probe's scope: only the root endpoint should
// intentionally capture its owner, and neither route may capture probe's
// cleanup references or otherwise keep its specimen alive through the test.
const connectScalar = (tree: Tree) => {
  const sent: string[] = [];
  const ownerReads: string[] = [];
  const relationship = link(tree.$.a, {
    set: (value) => void sent.push(value),
    subscribe: () => () => undefined,
  });
  return { relationship, sent, ownerReads };
};

const connectRoot = (tree: Tree) => {
  const sent: string[] = [];
  const ownerReads: string[] = [];
  const relationship = link(tree.$, {
    set: (value) => {
      sent.push(value.a);
      ownerReads.push(tree.$().a);
    },
    subscribe: () => () => undefined,
  });
  return { relationship, sent, ownerReads };
};

describe('Link lifetime retention', () => {
  it('runs with a real collector', () => {
    expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
  });

  const probe = async (
    route: 'scalar' | 'root',
    mode: 'none' | 'live' | 'destroyed'
  ) => {
    let payload: unknown = { marker: 'link-lifetime-payload' };
    const ref = new WeakRef(payload as object);
    let tree: Tree | null = makeTree();
    tree.$.obj(payload);
    payload = null;
    let connection =
      mode === 'none'
        ? null
        : route === 'root'
          ? connectRoot(tree)
          : connectScalar(tree);
    const treeRef = new WeakRef(tree);
    tree.$.a('a1');
    // Exercise the current snapshot dependency path on every control, without
    // retaining the snapshot (and its payload) in the test itself.
    void tree.$();
    await flush();
    if (connection) {
      await connection.relationship.settled();
      expect(connection.sent).toEqual(['a1']);
      if (route === 'root') expect(connection.ownerReads).toEqual(['a1']);
    }
    connection = null;
    if (mode === 'destroyed') tree.destroy();
    tree = null;
    await applyPressure();
    const alive = ref.deref() !== undefined;
    // Release the positive-control owner too, without keeping the destroyed
    // specimen alive during collection through a captured cleanup closure.
    treeRef.deref()?.destroy();
    return alive;
  };

  describe.each(['scalar', 'root'] as const)('%s Link route', (route) => {
    it('control: a bare abandoned tree is collected', async () => {
      expect(await probe(route, 'none')).toBe(false);
    });

    it('control: a live tree with a Link keeps its state', async () => {
      expect(await probe(route, 'live')).toBe(true);
    });

    it('a destroyed tree with a Link is released', async () => {
      expect(await probe(route, 'destroyed')).toBe(false);
    });
  });

  it('a disposed Link is not retained by the tree that still lives', async () => {
    const tree = makeTree();
    try {
      let endpoint: LinkEndpoint<string> | null = endpointFor();
      const ref = new WeakRef(endpoint);
      let relationship: { dispose(): void } | null = link(tree.$.a, endpoint);
      endpoint = null;
      await flush();
      relationship.dispose();
      // The handle closes over the endpoint itself; drop it, so only the tree
      // could still hold the Link.
      relationship = null;
      await applyPressure();
      expect(ref.deref()).toBeUndefined();
      // The tree is still alive and usable.
      tree.$.a('a1');
      expect(tree.$.a()).toBe('a1');
    } finally {
      tree.destroy();
    }
  });
});
