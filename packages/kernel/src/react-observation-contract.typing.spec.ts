import {
	observeOwnerInvalidation,
} from './adapter';
import * as kernelRoot from './index';
import type { ReadonlyLocation, SignalTree } from './index';

declare const location: ReadonlyLocation<number>;
declare const tree: SignalTree<{ count: number }>;

location();
const releaseLocation: () => void = location.subscribe(() => undefined);
releaseLocation();

// @ts-expect-error SignalTree exposes no public change subscription
tree.subscribe(() => undefined);

const cleanup: () => void = observeOwnerInvalidation(tree, () => undefined);
cleanup();

// @ts-expect-error owner invalidation carries no value or metadata
observeOwnerInvalidation(tree, (_value: unknown) => undefined);

// @ts-expect-error owner invalidation is adapter SDK, not root application API
kernelRoot.observeOwnerInvalidation(tree, () => undefined);

export {};
