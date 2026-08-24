import { Assert, Equals } from '../test-helpers/types-equals';
import { restoration, RestorationConfig } from './restoration';

import type { Enhancer, RestorationMethods } from '../../lib/types';

/**
 * `restoration()` returns the NEUTRAL enhancer contract.
 *
 * This asserted the realization-facing shape,
 * `(config?) => <T>(tree: ISignalTree<T>) => ISignalTree<T> & RestorationMethods`.
 * That was the implementation vocabulary, and migrating to `Enhancer<TAdded>`
 * is exactly what changed it — so the row went red and was updated
 * deliberately, not worked around.
 *
 * This file does NOT stand in for the consumer contract. Asserting
 * `restoration`'s own declared shape says nothing about whether a call site
 * still gets `RestorationHistoryEntry<AppState>[]` out of `getRestorationHistory()` — which is the
 * one property this migration could plausibly have broken, since the state is
 * recovered from polymorphic `this` and `EnhancerHost` is not a `NodeAccessor`.
 * That is `restoration-contract.typing.spec.ts`, proven green BEFORE this
 * signature changed and re-run unchanged afterwards.
 */
type ExpectedSignature = (config?: RestorationConfig) => Enhancer<RestorationMethods>;

type ActualSignature = typeof restoration;

type _ContractCheck = Assert<Equals<ActualSignature, ExpectedSignature>>;

// .with() preserves accumulated types via `this & TAdded` pattern.

export {};
