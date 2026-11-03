/** Types for the standalone JS qualification harness; no public API augmentation. */
export interface PublicCase {
  readonly name: string;
  readonly kind: 'field' | 'row' | 'collection';
  readonly foreign: boolean;
  readonly dependent: boolean;
}
export interface CaseObservation {
  readonly name: string;
  readonly pass: boolean;
  readonly phase: string;
  readonly sent: readonly unknown[];
  readonly error?: { readonly name?: string; readonly message?: string };
}
export declare const cases: readonly PublicCase[];
export declare function runCase(
  api: typeof import('../../src/index'),
  test: PublicCase
): Promise<CaseObservation>;
