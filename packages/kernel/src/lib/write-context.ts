import { withDeferredWriteScope } from './internals/deferred-write-scope';
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
 * REPLAY WRITES (15.4.4). A replay of recorded state — undo, redo, jumpTo
 * (`origin: 'restoration'`), a rollback (`'transaction-rollback'`) — writes
 * back exactly what was recorded, so its OWN writes skip the entity
 * interceptors. A write a user callback makes while it runs (a tap, a
 * subscriber, an observer) inherits the replay's context but is new, forward
 * work, and must be intercepted (b6aec5a3 skipped it too).
 *
 * `userCallbacks` counts the user callbacks running synchronously right now
 * (`runUserCallback`); `replayDepth` is that count when a replay context was
 * entered, or -1. A write is the replay's own exactly while the two agree —
 * also when the replay itself was started from inside a callback. Shared by
 * every tree and collection, so a tap writing another one is covered.
 */
let userCallbacks = 0;
let replayDepth = -1;

/**
 * Run `fn` with `meta` set as the active write context. The previous context
 * (if any) is restored when `fn` returns or throws.
 *
 * Synchronous capture only — see module JSDoc for the `await` boundary trap.
 *
 * @returns The value returned by `fn`.
 */
export function withWriteContext<R>(meta: WriteMetadata, fn: () => R): R {
  const previous = activeContext;
  const previousReplay = replayDepth;
  activeContext = meta;
  replayDepth =
    meta.origin === 'restoration' || meta.origin === 'transaction-rollback'
      ? userCallbacks
      : -1;
  try {
    return withDeferredWriteScope(fn);
  } finally {
    activeContext = previous;
    replayDepth = previousReplay;
  }
}

/** @internal The current write is a replay writing itself back (see above). */
export const isRecordedReplayWrite = (): boolean =>
  replayDepth === userCallbacks;

/** @internal Run a user callback, counted (see above). */
export function runUserCallback<R>(callback: () => R): R {
  userCallbacks++;
  try {
    return callback();
  } finally {
    userCallbacks--;
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
