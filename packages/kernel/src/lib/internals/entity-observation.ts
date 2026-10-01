/** A collection can acquire notification identity when observation is first needed. */
const ACTIVATE = Symbol('SignalTree:EntityObservation');
export function defineEntityObservation(
  node: object,
  activate: () => void
): void {
  Object.defineProperty(node, ACTIVATE, { value: activate });
}
export function activateEntityObservation(node: object): boolean {
  const activate = (node as Record<symbol, unknown>)[ACTIVATE];
  if (typeof activate !== 'function') return false;
  activate();
  return true;
}
