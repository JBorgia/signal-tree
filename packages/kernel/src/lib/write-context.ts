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
 * (`origin: 'restoration'`), a rollback (`'transaction-rollback'`), a devtools
 * jump to a recorded state (`withWriteContext(meta, fn, true)`) — writes back
 * exactly what was recorded, so its OWN writes skip the entity
 * interceptors. A write a user callback makes while it runs (a tap, a
 * subscriber, an observer) inherits the replay's context but is new, forward
 * work, and must be intercepted (b6aec5a3 skipped it too).
 *
 * `userCallbacks` counts the user callbacks running synchronously right now
 * (`runUserCallback`); `replayDepth` is that count where the live replay
 * began, -1 outside any replay, or -2 inside a frame that merely inherited a
 * replay's origin. A write is the replay's own exactly while the depth matches
 * the count. Shared by every tree and collection, so a tap writing another one
 * is covered.
 *
 * WHERE A REPLAY BEGINS. A replay-origin frame begins one when its origin
 * differs from the frame around it — `undo()` run anywhere outside a replay,
 * also from a tap; a rollback inside an undo's tap — and continues the live
 * one when it is entered at that replay's own depth (its machinery's nested
 * frames). A frame entered inside a user callback with the SAME origin
 * inherited it by spreading the ambient context — `transaction()` and others
 * do — and is not a replay (31584797 snapshotted it as one, so a transaction a
 * tap opened during undo skipped every interceptor).
 */
let userCallbacks = 0;
let replayDepth = -1;

/**
 * Run `fn` with `meta` set as the active write context. The previous context
 * (if any) is restored when `fn` returns or throws. `replays` marks a frame
 * that replays recorded state without a replay origin (devtools: a jump it
 * verified as one of the tree's own recorded states); see above.
 *
 * Synchronous capture only — see module JSDoc for the `await` boundary trap.
 *
 * @returns The value returned by `fn`.
 */
export function withWriteContext<R>(
  meta: WriteMetadata,
  fn: () => R,
  replays = false
): R {
  const previous = activeContext;
  const previousReplay = replayDepth;
  const live = previousReplay === userCallbacks;
  activeContext = meta;
  replayDepth = !(
    replays ||
    meta.origin === 'restoration' ||
    meta.origin === 'transaction-rollback'
  )
    ? -1
    : replays || live || meta.origin !== previous?.origin
    ? userCallbacks
    : -2;
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
