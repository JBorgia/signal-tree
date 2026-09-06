import type { WriteMetadata } from './mutation-types';

/**
 * Ambient write-context channel for tagging tree writes with `WriteMetadata`.
 *
 * Enhancers (guardrails, validation, devtools) observe writes via location
 * interceptors, but the canonical `location(value)` signature does not carry
 * metadata. This module provides a synchronous ambient channel that the
 * interceptor captures at write time.
 *
 * Internal callers tag a batch of writes with intent, and internal observers
 * can read that active context while processing leaf writes.
 *
 * ## Synchronous capture only
 *
 * The context is restored before `fn` returns and **does not survive `await`
 * boundaries**. This is correct:
 *
 * ```ts
 * withWriteContext({ intent: 'hydrate' }, () => tree.$.x(value));
 * ```
 *
 * This is wrong — the `await` yields control, and the context is restored
 * before the location write runs:
 *
 * ```ts
 * withWriteContext({ intent: 'hydrate' }, async () => {
 *   await fetch('/api/state');     // context restored to previous frame here
 *   tree.$.x(value);               // runs with NO context
 * });
 * ```
 *
 * Restructure so the writes happen synchronously after the await:
 *
 * ```ts
 * const data = await fetch('/api/state');
 * withWriteContext({ intent: 'hydrate' }, () => tree.$.x(data));
 * ```
 *
 * ## Multi-tree / SSR
 *
 * `activeContext` is a module-level singleton. In a single-threaded JavaScript
 * runtime (browser, single Node worker) this is safe for the synchronous
 * capture pattern. SSR with concurrent requests sharing a tree across requests
 * is an antipattern; use per-request trees.
 */

let activeContext: WriteMetadata | undefined;

/**
 * Run `fn` with `meta` set as the active write context. The previous context
 * (if any) is restored when `fn` returns or throws.
 *
 * Synchronous capture only — see module JSDoc for the `await` boundary trap.
 *
 * @returns The value returned by `fn`.
 */
export function withWriteContext<R>(
  meta: WriteMetadata,
  fn: () => R
): R {
  const previous = activeContext;
  activeContext = meta;
  try {
    return fn();
  } finally {
    activeContext = previous;
  }
}

/**
 * Read the active write context, if any.
 *
 * Returns `undefined` outside a `withWriteContext` frame.
 *
 * @public — Enhancer-author API. Read inside an `onWrite` callback from
 *   `interceptLeafSignals` (or anywhere the enhancer observes writes) to
 *   capture the ambient `WriteMetadata`. Application code should not use
 *   this directly.
 */
export function getActiveWriteContext(): WriteMetadata | undefined {
  return activeContext;
}
