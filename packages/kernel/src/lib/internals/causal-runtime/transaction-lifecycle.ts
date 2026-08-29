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
 * A stable key for one transaction WITHIN one tree's lifecycle channel.
 *
 * ## MATRIX-CLOSE S5 — the owner component is GONE, and why that is safe
 *
 * This used to intern each `owner` object to an ordinal and return
 * `` `${ordinal}\u0000${id}` ``. M6 replaced the whole body with `String(id)`
 * and the entire 1885-test suite stayed green — including
 * `turn-feed-0-1-identity.spec.ts`, which was written specifically as this
 * falsifier and did not falsify.
 *
 * The invariant that makes a bare id sufficient was already measured by
 * DIAG-JOURNAL-1.1:
 *
 * > **A channel is installed on one tree's canonical host, and exactly ONE owner
 * > announces on it.** `restoration()` holds a `transactionOwnerToken` of its own
 * > but only LISTENS; the single per-tree transaction runtime is the only
 * > announcer, and its counter is the only source of ids.
 *
 * Two trees both mint id 1 — and never share a channel, so no observer can see
 * both. The owner ordinal was disambiguating a collision that cannot occur in
 * the only scope that reads this key.
 *
 * ## What was KEPT, deliberately
 *
 * `TransactionLifecycleEvent.owner` stays. It does a DIFFERENT job that is
 * independently earned: restoration compares it directly
 * (`event.owner === transactionOwnerToken`) to ignore its own announcements and
 * act only on foreign ones. That filter is not this key.
 *
 * ```text
 * owner on the EVENT    earned — the foreign/own filter
 * owner inside the KEY  unproven, and now removed
 * ```
 *
 * @internal
 */
export function transactionIdentityKey(id: number): string {
  return String(id);
}

const TRANSACTION_LIFECYCLE = Symbol.for(
  'SignalTree:TransactionLifecycleChannel'
);

/**
 * Records that SOME transaction owner set this tree up.
 *
 * Separate from the channel itself, and that separation is the whole point: it
 * is what lets an observer tell a missing channel apart from a tree that never
 * had one. Established by `installTransactionLifecycleChannel`, an operation
 * only an owner performs — so the authority fact comes from the act of
 * ownership rather than from recognising a particular owner.
 *
 * It deliberately does NOT record WHICH owner, or how many. Both `transactions()`
 * and `restoration()` install, and nothing needs to distinguish them; if owner
 * identity is ever needed this becomes a registry, but widening it before there
 * is a consumer would be inventing the requirement.
 */
const TRANSACTION_LIFECYCLE_OWNER = Symbol.for(
  'SignalTree:TransactionLifecycleOwnerPresent'
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
 * The CANONICAL host for a tree's lifecycle channel.
 *
 * TURN-FEED-0.2. The object an enhancer is handed is NOT the object
 * `signalTree()` returns — `applyEnhancers` runs first and `createBuilder`
 * produces the public tree afterwards — so a channel attached to the enhancer's
 * argument is unreachable from the tree an application holds. Measured across
 * both the enhancer input, the `applyEnhancers` output and the public tree,
 * `tree.$` is the one object identical at all three points, so it is the host.
 *
 * The fallback exists for the internal callers that pass a node directly.
 */
function canonicalHost(tree: object): object {
  const dollar = (tree as { $?: unknown }).$;
  return dollar && typeof dollar === 'object' ? (dollar as object) : tree;
}

/**
 * Install the channel. **Owner side only.**
 *
 * Idempotent: the second authority to set up on a tree gets the first one's
 * channel. Both `transactions()` and `restoration()` own transactions, so both
 * install, and neither depends on enhancer order to be heard.
 *
 * @internal
 */
export function installTransactionLifecycleChannel(
  tree: object
): TransactionLifecycleChannel {
  const host = canonicalHost(tree);

  // Marked BEFORE the early return, so a second owner installing onto an
  // existing channel still asserts the fact, and so the marker survives a
  // channel that is later lost.
  if (!(host as Record<symbol, unknown>)[TRANSACTION_LIFECYCLE_OWNER]) {
    Object.defineProperty(host, TRANSACTION_LIFECYCLE_OWNER, {
      value: true,
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }

  const existing = (host as Record<symbol, unknown>)[TRANSACTION_LIFECYCLE];
  if (existing) {
    return existing as TransactionLifecycleChannel;
  }
  const channel = createChannel();
  // Attached under a `SignalTree:`-prefixed symbol so `unwrap`'s symbol walk
  // skips it and it can never reach a serialized payload.
  Object.defineProperty(host, TRANSACTION_LIFECYCLE, {
    value: channel,
    enumerable: false,
    writable: false,
    configurable: true,
  });
  return channel;
}

/**
 * Did a transaction OWNER set this tree up?
 *
 * TURN-FEED-0.2.1. This used to read `__transactions`, the handle the
 * transactions enhancer publishes — which narrowed a general ownership concept
 * to one concrete producer. `restoration()` is also a transaction owner and
 * publishes no such handle, so a restoration-only tree whose channel had been
 * lost reported "no transaction capability" instead of corruption: the loud
 * failure was loud for one enhancer and silent for the other.
 *
 * The fact now comes from the act of ownership itself — the marker is written by
 * `installTransactionLifecycleChannel`, which only an owner calls. Replacing one
 * owner-specific check with two (`__transactions || __restoration`) would have
 * kept the same defect and merely enumerated more of it.
 */
function hasTransactionOwner(tree: object): boolean {
  const host = canonicalHost(tree);
  return !!(host as Record<symbol, unknown>)[TRANSACTION_LIFECYCLE_OWNER];
}

/**
 * Resolve a tree's lifecycle channel, or `undefined` when the tree simply has
 * no transaction capability. **Observer side. Never creates one.**
 *
 * @internal
 */
export function tryGetTransactionLifecycleChannel(
  tree: object
): TransactionLifecycleChannel | undefined {
  const host = canonicalHost(tree);
  return (host as Record<symbol, unknown>)[TRANSACTION_LIFECYCLE] as
    | TransactionLifecycleChannel
    | undefined;
}

/**
 * Resolve a tree's lifecycle channel. **Observer side. Never creates one.**
 *
 * TURN-FEED-0.2, and the reason this function no longer creates: it used to do
 * two jobs — "create if missing" for the owner and "find" for an observer — so
 * an observer that asked the WRONG object silently got a brand-new channel that
 * could never fire. Reachability then depended on which other enhancers were
 * installed, which is precisely the ownership independence TURN-FEED claims.
 *
 * The distinction this preserves:
 *
 * ```text
 * no transaction authority        absence      -> tryGet() returns undefined
 * authority present, no channel   CORRUPTION   -> ST1036, loudly
 * ```
 *
 * @throws `ST1036` if the tree has a transaction authority whose channel cannot
 *   be resolved, or if it has no transaction capability at all. Use
 *   {@link tryGetTransactionLifecycleChannel} where absence is legitimate.
 * @internal
 */
export function getTransactionLifecycleChannel(
  tree: object
): TransactionLifecycleChannel {
  const channel = tryGetTransactionLifecycleChannel(tree);
  if (channel) {
    return channel;
  }
  if (hasTransactionOwner(tree)) {
    throw new Error(
      'ST1036: this tree has a transaction authority but no lifecycle channel ' +
        'could be resolved. The channel is installed by that owner on the ' +
        "tree's canonical host; failing to find one here means the install and " +
        'the lookup disagree about that host, which would silently deliver no ' +
        'lifecycle events at all.'
    );
  }
  throw new Error(
    'ST1036: this tree has no transaction capability, so it has no lifecycle ' +
      'channel. Add `transactions()` to the enhancers, or use ' +
      '`tryGetTransactionLifecycleChannel()` where absence is legitimate.'
  );
}
