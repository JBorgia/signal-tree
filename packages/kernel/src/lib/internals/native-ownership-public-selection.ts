/** Internal experiment selection. Not exported by any package or SDK barrel. */
const selected = new WeakSet<object>();
export function selectNativeOwnershipTransactions<T extends object>(
  enhancer: T
): T {
  selected.add(enhancer);
  return enhancer;
}
export function usesNativeOwnershipTransactions(enhancer: object): boolean {
  return selected.has(enhancer);
}
