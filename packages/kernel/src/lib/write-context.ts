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
 * REPLAY WRITES (15.4.4). A replay of recorded state — undo, redo, jumpTo, a
 * history replay, a rollback (explicit or automatic), a devtools jump to a
 * state the tree serialized — writes back exactly what was recorded, so its
 * OWN writes skip the entity interceptors. A write a user callback makes while
 * it runs (a tap, a subscriber, an observer) inherits the replay's context but
 * is new, forward work, and must be intercepted (b6aec5a3 skipped it too).
 *
 * `userCallbacks` counts the user callbacks running synchronously right now
 * (`runUserCallback`); `replayDepth` is that count where the live replay
 * began, or -1. A write is the replay's own exactly while the two agree.
 * Shared by every tree and collection, so a tap writing another one is
 * covered.
 *
 * A REPLAY BEGINS ONLY WHERE ITS ENTRY POINT SAYS SO: `withWriteContext(meta,
 * fn, true)` at restoration's and transactions' replay frames and devtools'
 * verified jumps, a separate argument so it never travels with a spread meta.
 * It snapshots the count at its own entry wherever it runs — also inside
 * another replay's tap, so an `undo()` or `rollback()` a tap starts is itself
 * a replay. Any other frame leaves the replay as it is (a frame that spreads
 * the ambient meta, as `transaction()` does, inherits its origin; inside a
 * tap it stays a forward write), or ends it when it names a different origin.
 * Inferring starts from the origin (9619b919) could not tell a tap's real
 * `undo()` from a `transaction()` that spread the inherited meta.
 */
let userCallbacks = 0;
let replayDepth = -1;

/**
 * Run `fn` with `meta` set as the active write context. The previous context
 * (if any) is restored when `fn` returns or throws. `replayStart` marks a
 * replay's entry point (see above).
 *
 * Synchronous capture only — see module JSDoc for the `await` boundary trap.
 *
 * @returns The value returned by `fn`.
 */
export function withWriteContext<R>(
  meta: WriteMetadata,
  fn: () => R,
  replayStart = false
): R {
  const previous = activeContext;
  const previousReplay = replayDepth;
  activeContext = meta;
  if (replayStart) replayDepth = userCallbacks;
  else if (meta.origin !== previous?.origin) replayDepth = -1;
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
