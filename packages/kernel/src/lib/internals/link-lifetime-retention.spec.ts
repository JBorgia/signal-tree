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
 * and the tree. The registry is reachable from every owned location, and
 * location-runtime's dependency FinalizationRegistry holds a consumer's
 * dependency map strongly; that map reaches the consumer itself through
 * location -> registry -> close -> dispose -> tree, so the consumer was never
 * finalized and a destroyed tree with a Link was retained forever.
 * `a2-5-lifetime` (persistence() is built on link()) went red at f0f15d18.
 *
 * Arms, as in a2-5:
 *
 * ```text
 * live tree, Link bound               payload must LIVE  -> the harness measures
 *                                                           a real retention
 * tree destroyed                      payload must DIE   -> destroy() releases it
 * Link disposed, tree alive           endpoint must DIE  -> a disposed Link is
 *                                                           not kept by its tree
 * ```
 *
 * The disposed-Link arm is the direct carrier (red at f0f15d18..3e42c133). The
 * destroyed arm here stays green there too: it needs a consumer whose
 * dependency map reaches the registry, which persistence()'s autoSave creates
 * and a bare tree does not — `a2-5-lifetime` arm C is that carrier.
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

type Tree = {
  $: {
    (): unknown;
    a: { (): string; (value: string): void };
    obj(value: unknown): void;
  };
  destroy(): void;
};
const makeTree = () =>
  signalTree({ a: 'a0', obj: null as unknown }) as unknown as Tree;
const endpointFor = (): LinkEndpoint<string> => ({
  set: () => undefined,
  subscribe: () => () => undefined,
});

describe('Link lifetime retention', () => {
  it('runs with a real collector', () => {
    expect(typeof (globalThis as { gc?: unknown }).gc).toBe('function');
  });

  const probe = async (mode: 'live' | 'destroyed') => {
    let payload: unknown = { marker: 'link-lifetime-payload' };
    const ref = new WeakRef(payload as object);
    let tree: Tree | null = makeTree();
    tree.$.obj(payload);
    payload = null;
    link(tree.$.a as never, endpointFor());
    // A whole-state read, as persistence's autoSave does: it leaves a
    // dependency consumer registered with location-runtime's finalizer, whose
    // held dependency map is what made the registry's closure fatal.
    void tree.$();
    await flush();
    if (mode === 'destroyed') tree.destroy();
    tree = null;
    await applyPressure();
    return ref.deref();
  };

  it('control: a live tree with a Link keeps its state', async () => {
    expect(await probe('live')).toBeDefined();
  });

  it('a destroyed tree with a Link is released', async () => {
    expect(await probe('destroyed')).toBeUndefined();
  });

  it('a disposed Link is not retained by the tree that still lives', async () => {
    const tree = makeTree();
    try {
      let endpoint: LinkEndpoint<string> | null = endpointFor();
      const ref = new WeakRef(endpoint);
      let relationship: { dispose(): void } | null = link(
        tree.$.a as never,
        endpoint
      );
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
