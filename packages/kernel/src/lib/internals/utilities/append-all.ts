/**
 * Appends every item to `target` in order.
 *
 * `target.push(...items)` passes each item as a call argument, and V8 throws
 * "Maximum call stack size exceeded" past ~10^5 arguments, so a large entity
 * batch must never be spread into a call.
 */
export function appendAll<T>(target: T[], items: readonly T[]): void {
  for (let i = 0; i < items.length; i++) target.push(items[i]);
}
