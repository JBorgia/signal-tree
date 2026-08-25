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
 * A branch accessor is callable and answers with its own value; the root
 * accessor is not. Rather than make it callable — a shape consumers already
 * observe — the owning tree is recorded here, because the tree IS the root's
 * canonical reader and writer: `tree()` produces the whole-tree snapshot and
 * `tree(value)` applies one.
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
type RootReadWrite = {
  (): unknown;
  (value: unknown): void;
};

const ROOT_TREES = new WeakMap<object, RootReadWrite>();

/** @internal Record the tree that owns this root accessor. */
export function defineRootTree(rootAccessor: object, tree: RootReadWrite): void {
  ROOT_TREES.set(rootAccessor, tree);
}

/** @internal The owning tree, if this node is a recorded root accessor. */
export function getRootTree(node: unknown): RootReadWrite | undefined {
  if (node === null || typeof node !== 'object') return undefined;
  return ROOT_TREES.get(node as object);
}
