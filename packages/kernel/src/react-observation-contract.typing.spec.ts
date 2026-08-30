import type { ReadableCell } from './adapter';
import type { SignalTree } from './index';

declare const cell: ReadableCell<number>;
declare const tree: SignalTree<{ count: number }>;

cell();

// A direct cell subscription is absent, but React does not require this exact
// granularity: owner-wide coherent invalidation plus direct reads is sufficient.
// @ts-expect-error neutral cells intentionally expose no subscription contract
cell.subscribe(() => undefined);

// REACT-REALIZATION-0 discriminator: no public owner-wide invalidation source
// currently pairs tree reads with cleanup. If this starts compiling, R-A must
// be reevaluated against the newly public observation fact.
// @ts-expect-error SignalTree exposes no public change subscription
tree.subscribe(() => undefined);

export {};
