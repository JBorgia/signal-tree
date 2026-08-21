/**
 * Is this value something a tree/path walk can descend into?
 *
 * Objects and functions both qualify: SignalTree leaves and node accessors are
 * callable, so object-only walkers skip the signal-shaped parts of a tree.
 */
export function isTraversableNode(value: unknown): value is object {
  return (
    value != null && (typeof value === 'object' || typeof value === 'function')
  );
}
