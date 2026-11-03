/** Types for the standalone JS qualification harness; no public API augmentation. */
export interface LifecycleCase {
  readonly name: string;
  readonly kind: 'field' | 'collection';
  readonly terminal: 'confirm' | 'rollback';
  readonly late: boolean;
}
export interface LifecycleObservation {
  readonly name: string;
  readonly pass: boolean;
  readonly phase: string;
  readonly sent: readonly unknown[];
  readonly second: readonly unknown[];
  readonly third: readonly unknown[];
  readonly error?: { readonly name?: string; readonly message?: string };
}
export declare const lifecycleCases: readonly LifecycleCase[];
export declare function runLifecycle(
  api: typeof import('../../src/index'),
  test: LifecycleCase
): Promise<LifecycleObservation>;
