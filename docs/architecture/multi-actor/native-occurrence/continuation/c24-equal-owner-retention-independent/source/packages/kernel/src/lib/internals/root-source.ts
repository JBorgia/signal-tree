import { isTraversableNode } from './node-shape';

/**
 * THE ROOT AS A LINK SOURCE.
 *
 * `link(tree.$, endpoint)` typechecks cast-free, so the root is a supported
 * source. It failed at runtime for two independent reasons; this module carries
 * the second.
 *
 *   1. the root accessor had no owner registry — capability-gated exactly as
 *      ordinary leaves were, so a plain tree rejected it as unowned;
 *   2. `accessorsFor` fell through to a callable read, and `tree.$` is a plain
 *      OBJECT. That is the `"x is not a function"` failure.
 *
 * The root accessor now follows the same callable grammar as a branch. This
 * sidecar retains the privileged read/write authority used by Link and kernel
 * internals without making the controller callable or adding `.set`/`.update`
 * to the root location.
 *
 * ⚠️ ADDRESS vs VALUE. `tree.$` is the address; the whole-tree snapshot is the
 * value. This does not make arbitrary non-callable objects readable — only a
 * SignalTree-owned root that has been explicitly recorded.
 */
/**
 * ⚠️ A WeakMap, NOT a property on the node.
 *
 * The first attempt defined a symbol property on the root accessor pointing at
 * its tree. That failed 876 tests: the tree closes over the accessor, so the
 * property creates a cycle that the snapshot/unwrap walkers follow. A sidecar
 * keeps the reference entirely outside anything that enumerates the node.
 */
export interface RootStateAuthority {
  read(): unknown;
  replace(value: unknown): void;
  derive(update: (current: unknown) => unknown): void;
};

const ROOT_AUTHORITIES = new WeakMap<object, RootStateAuthority>();

/** @internal Record the authority that owns this root accessor. */
export function defineRootTree(
  rootAccessor: object,
  authority: RootStateAuthority
): void {
  ROOT_AUTHORITIES.set(rootAccessor, authority);
}

/** @internal The root authority, if this is a recorded root accessor. */
export function getRootTree(node: unknown): RootStateAuthority | undefined {
  if (!isTraversableNode(node)) {
    return undefined;
  }
  return ROOT_AUTHORITIES.get(node as object);
}

export function rootAuthorityFor(owner: { readonly $: object }): RootStateAuthority {
  const authority = getRootTree(owner.$);
  if (!authority) {
    throw new Error('SignalTree root authority is unavailable.');
  }
  return authority;
}
