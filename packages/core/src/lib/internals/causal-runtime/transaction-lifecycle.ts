/**
 * TURN-FEED-0 — the transaction lifecycle channel.
 *
 * One authority owns transactions; another may need to observe them. Before
 * this existed, `restoration()` recognised a pending transaction only by
 * comparing `meta.transactionOwner` against its OWN private token, so a
 * transaction opened by the `transactions()` enhancer was invisible to it and
 * its speculative writes landed in confirmed restoration history.
 *
 * Accepting any foreign token is not enough, and that was measured: routing
 * pending writes into a bucket is half a protocol, because nothing says when the
 * transaction CONFIRMS or ROLLS BACK, so the bucket never drains. (20 failures
 * became 34.) The missing half is this.
 *
 * ## Deliberately lifecycle only
 *
 * Four events, and the fourth was earned rather than designed in — see
 * `'staged'`. NOT a stream of mutation effects, however much a future diagnostic
 * journal might want one: that architecture has not been falsified yet, and this
 * one has. Widening this channel to carry effects would be inventing the journal
 * early under a smaller name.
 *
 * ## The identity is the PAIR — defensively
 *
 * `(owner, id)`, never the id alone. Ids come from per-enhancer allocators, so
 * the same number recurs across owners and across trees.
 *
 * ⚠️ Measured limit on that claim, because an earlier version of this comment
 * overstated it: two transaction owners cannot coexist on ONE tree. The
 * enhancer-configuration guard refuses a duplicate outright — *"enhancer
 * 'transactions' is configured 2 times; each enhancer may appear once"* — and
 * `transaction` is a single property, so only the last assigning enhancer is
 * ever reachable. Pinned in `turn-feed-0-1-identity.spec.ts`.
 *
 * So the pair is DEFENSIVE identity rather than a live collision fix. It is
 * still the right shape: it costs a string, it keeps observers from needing the
 * owner's private token, and it means a future second reachable owner is a
 * non-event here instead of a silent cross-talk bug. What it does NOT license is
 * treating per-tree bucket keys as unsafe; there is at most one owner minting
 * ids per tree, by construction.
 *
 * ## Announcing does not grant restoration rights
 *
 * An observer learning that a transaction confirmed says nothing about whether
 * the resulting causal turn is undoable. That remains `undoable()`'s decision.
 *
 * @internal
 */

export type TransactionLifecycleEvent =
  /** Accepting writes. Announced BEFORE the callback runs. */
  | { readonly kind: 'opened'; readonly owner: object; readonly id: number }
  /**
   * The transaction's writes are complete and it awaits a decision.
   *
   * Added by TURN-FEED-0 case 4, which proved `opened`/`confirmed`/`rolled-back`
   * insufficient. An observer needs a boundary at which the transaction's
   * contribution is COMPLETE but not yet decided: waiting until `confirmed`
   * meant surrounding writes had already flushed and recorded a snapshot that
   * contained the speculative state, so the transaction's own turn deduped away
   * against it and vanished.
   *
   * The lifecycle genuinely has four states. Three was a guess.
   */
  | { readonly kind: 'staged'; readonly owner: object; readonly id: number }
  | { readonly kind: 'confirmed'; readonly owner: object; readonly id: number }
  | {
      readonly kind: 'rolled-back';
      readonly owner: object;
      readonly id: number;
    };

export type TransactionLifecycleListener = (
  event: TransactionLifecycleEvent
) => void;

export interface TransactionLifecycleChannel {
  announce(event: TransactionLifecycleEvent): void;
  subscribe(listener: TransactionLifecycleListener): () => void;
}

/**
 * A stable key for an `(owner, id)` pair.
 *
 * Owners are opaque tokens, so they cannot be part of a string key directly —
 * they get an interned ordinal instead, held weakly so a discarded owner does
 * not pin its entry.
 *
 * `\u0000` separated, matching `effectKey` in the enhancers. A space would also
 * be injective here (both halves are numbers), but NUL is the convention in this
 * codebase for composite keys and the convention is worth more than the byte.
 */
const OWNER_ORDINALS = new WeakMap<object, number>();
let nextOwnerOrdinal = 1;

/** @internal */
export function transactionIdentityKey(owner: object, id: number): string {
  let ordinal = OWNER_ORDINALS.get(owner);
  if (ordinal === undefined) {
    ordinal = nextOwnerOrdinal++;
    OWNER_ORDINALS.set(owner, ordinal);
  }
  return `${ordinal}\u0000${id}`;
}

const TRANSACTION_LIFECYCLE = Symbol.for(
  'SignalTree:TransactionLifecycleChannel'
);

function createChannel(): TransactionLifecycleChannel {
  const listeners = new Set<TransactionLifecycleListener>();
  return {
    announce(event) {
      // Copied before iterating: a listener may unsubscribe during delivery,
      // and an observer that tears itself down on rollback is a normal case
      // rather than an exotic one.
      for (const listener of [...listeners]) {
        try {
          listener(event);
        } catch {
          // An observer must not be able to fail a transaction. It chose to
          // watch; the transaction did not choose to be watched.
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * The channel for a tree, created on first use.
 *
 * Attached under a `SignalTree:`-prefixed symbol so `unwrap`'s symbol walk skips
 * it and it can never reach a serialized payload.
 *
 * @internal
 */
export function getTransactionLifecycleChannel(
  host: object
): TransactionLifecycleChannel {
  const existing = (host as Record<symbol, unknown>)[TRANSACTION_LIFECYCLE];
  if (existing) {
    return existing as TransactionLifecycleChannel;
  }
  const channel = createChannel();
  Object.defineProperty(host, TRANSACTION_LIFECYCLE, {
    value: channel,
    enumerable: false,
    writable: false,
    configurable: true,
  });
  return channel;
}
