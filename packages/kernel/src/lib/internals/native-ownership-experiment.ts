/** Internal research seam. Not exported by any package entry point. */
export type Installation = {
  key: number | string;
  before: unknown;
  after: unknown;
};
export type PreparedInstallation = { validate(): void; install(): void };
export type PrepareInstallation = (
  changes: readonly Installation[]
) => PreparedInstallation | undefined;
const preparations = new WeakMap<object, PrepareInstallation>();
const physical = new WeakMap<object, object>();
export function bindPhysicalRuntime(facade: object, kernel: object): void {
  physical.set(facade, kernel);
}
export function attachPreparation(
  target: object,
  prepare: PrepareInstallation
): void {
  preparations.set(physical.get(target) ?? target, prepare);
}
export function detachPreparation(target: object): void {
  preparations.delete(physical.get(target) ?? target);
}
export function prepareInstallation(
  target: object,
  changes: readonly Installation[]
): PreparedInstallation | undefined {
  return preparations.get(target)?.(changes);
}
