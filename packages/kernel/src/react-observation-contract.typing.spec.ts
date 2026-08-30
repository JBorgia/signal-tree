import {
	observeOwnerInvalidation,
	type ReadableCell,
} from './adapter';
import * as kernelRoot from './index';
import type { SignalTree } from './index';

declare const cell: ReadableCell<number>;
declare const tree: SignalTree<{ count: number }>;

cell();

// A direct cell subscription is absent, but React does not require this exact
// granularity: owner-wide coherent invalidation plus direct reads is sufficient.
// @ts-expect-error neutral cells intentionally expose no subscription contract
cell.subscribe(() => undefined);

// @ts-expect-error SignalTree exposes no public change subscription
tree.subscribe(() => undefined);

const cleanup: () => void = observeOwnerInvalidation(tree, () => undefined);
cleanup();

// @ts-expect-error owner invalidation carries no value or metadata
observeOwnerInvalidation(tree, (_value: unknown) => undefined);

// @ts-expect-error owner invalidation is adapter SDK, not root application API
kernelRoot.observeOwnerInvalidation(tree, () => undefined);

export {};
