import {
  getPositionRegistry,
  type PositionRegistry,
} from './position-registry';

/**
 * TREE-OWNED LINK LIFETIME (15.4.4).
 *
 * `tree.destroy()` disposes every Link bound to the tree, with exactly the
 * semantics of each relationship's own `dispose()`. Since 15.3.1 a destroyed
 * tree left its Links running: a `settled()` waiter on a send that never
 * settled hung forever, queued sends still reached the endpoint, and the
 * endpoint's `subscribe()` cleanup never ran.
 *
 * Keyed by the tree's position registry, which every owned location already
 * carries, so `link()` needs no reference to the tree object. A Link removes
 * itself when disposed first, so nothing disposed is retained until destroy.
 * `destroy()` reaches this module only through `PositionRegistry.close`,
 * installed on the first bind, so a program that never imports `link()` pays
 * only for an optional call (the entity bundle budget has bytes, not
 * kilobytes, of headroom).
 */
const linksByTree = new WeakMap<PositionRegistry, Set<() => void>>();

/**
 * The registry's `close`, built HERE rather than inside `bindLinkToTree` so it
 * closes over the registry alone. A closure created there shares that call's
 * scope with the unbind closure, which holds the Link's `dispose` — so the
 * registry, reachable from every owned location, kept the first-bound Link
 * (its endpoint and its tree) alive after the Link was disposed, and after
 * `destroy()`: location-runtime's dependency finalizer holds a consumer's
 * dependency map strongly, that map reached the consumer itself through
 * location -> registry -> close -> dispose -> tree, and the consumer was never
 * finalized (f0f15d18; `a2-5-lifetime` red in the retention-gc gate).
 */
const closerFor = (registry: PositionRegistry) => () =>
  disposeTreeLinks(registry);

/** @internal Bind a relationship's disposal to its tree. Returns the unbind. */
export function bindLinkToTree(
  registry: PositionRegistry,
  dispose: () => void
): () => void {
  let links = linksByTree.get(registry);
  if (!links) {
    linksByTree.set(registry, (links = new Set()));
    registry.close = closerFor(registry);
  }
  const bound = links;
  bound.add(dispose);
  return () => {
    bound.delete(dispose);
  };
}

/** `tree.destroy()`, through `PositionRegistry.close`. */
function disposeTreeLinks(registry: PositionRegistry): void {
  const links = linksByTree.get(registry);
  if (!links) return;
  linksByTree.delete(registry);
  for (const dispose of [...links]) {
    try {
      dispose();
    } catch {
      // Only an endpoint's own unsubscribe can throw, after the Link has
      // released everything it owns. Destroy swallows cleanup errors so every
      // cleanup still runs; `link.dispose()` called directly still throws.
    }
  }
}

/** @internal Live Links bound to the tree that owns `node`. */
export function getTreeLinkCountForTesting(node: unknown): number {
  const registry = getPositionRegistry(node);
  return registry ? linksByTree.get(registry)?.size ?? 0 : 0;
}
