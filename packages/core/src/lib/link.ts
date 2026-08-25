import type { WritableSignal } from '@angular/core';

import { deepEqual } from './utils';
import { external } from './external';
import { getOwnedOwnerPath } from './internals/owned-metadata';
import { getPathNotifier } from './path-notifier';
import { reportTreeError } from './internals/error-reporter';
import { getPositionRegistry } from './internals/position-registry';
import { scheduleDurableConsequence } from './internals/commit-consequence';
import type { EntityMapBuilder } from './markers/entity-map';
import type { EntitySignal } from './types';
import type { NodeAccessor } from './node-accessor';

/**
 * `link(x, y)` — synchronize a SignalTree location with an external endpoint.
 *
 * ```ts
 * const connection = link(tree.$.rows, {
 *   get: () => api.load(),
 *   set: (rows) => api.save(rows),
 *   subscribe: (next) => socket.on('rows', next),
 * });
 *
 * await connection.retrieve();
 * await connection.settled();
 * connection.dispose();
 * ```
 *
 * Three directions, one primitive:
 *
 * ```text
 * get        Y -> X   pulled on demand via retrieve()
 * set        X -> Y   pushed after every settled turn
 * subscribe  Y -> X   pushed live
 * ```
 *
 * A rejected `set()` is reported to `onTreeError` — once, with the owning
 * `treeId` and the linked location's `path`. `X` stays authored, the outbound
 * queue survives, and `settled()` RESOLVES rather than throwing. That is why the
 * handle needs no error member of its own.
 *
 * ⚠️ **X must be an OWNED SignalTree location.** That is enforced at RUNTIME,
 * not by the type: `LINK-2` measured that a `computed` and a bare
 * `WritableSignal` are structurally identical to an owned leaf — same call
 * signature, same `.set` — and ownership is a runtime fact on a non-enumerable
 * property. Making it a compile error needs a branded location type threaded
 * through every public return in the library, which is a far larger decision.
 */
export interface LinkEndpoint<T> {
  get?(): T | Promise<T>;
  set?(value: T): void | Promise<void>;
  subscribe?(next: (value: T) => void): () => void;
}

/**
 * The handle. Deliberately three members.
 *
 * No `subscribe()`, no `then()`, no retry/backoff/status, no `afterGet`/
 * `afterSet`/`afterChange` — none of those were earned by a demonstrated
 * third-party authoring need, and "might be useful" is UNPROVEN, not PUBLIC.
 */
export interface Link {
  /** Pull Y into X once. Rejects if the endpoint supplies no `get()`. */
  retrieve(): Promise<void>;
  /** Resolves when every outbound write in flight has been acknowledged. */
  settled(): Promise<void>;
  /** Stop synchronizing. Idempotent. */
  dispose(): void;
}

/**
 * The natural value of a source — derived from the SOURCE, never annotated by
 * the caller.
 *
 * ⚠️ The collection branch is first, and it is what LINK-COLLECTION-TYPE-0
 * earned. A collection node is deliberately NOT callable, and the previous
 * target union therefore rejected it outright — inference never reached the
 * endpoint. The finding that fixed it:
 *
 * > **node access shape != linked value shape**
 *
 * Making `link` generic over `S` rather than `T` is what lets contextual typing
 * flow into the endpoint callbacks, so `link(tree.$.rows, { set: (v) => ... })`
 * infers `v: Row[]` with no explicit generic.
 */
export type NaturalValue<S> =
  S extends EntitySignal<infer R, infer _K>
    ? R[]
    : S extends NodeAccessor<infer T>
      ? T
      : S extends WritableSignal<infer T>
        ? T
        : never;

/**
 * Does this declared value still contain a CONSTRUCTION MARKER?
 *
 * ⚠️ LINK-MATERIALIZED-VALUE-0 measured that a branch containing an `entityMap`
 * declares `{ users: EntityMapBuilder<...> }` while its runtime state reads
 * `{ users: { all: User[] } }` and accepts either shape on write. The declared
 * type therefore matches NEITHER side — it names the thing you PASS IN at
 * construction, not the state the tree synchronizes.
 *
 * > **construction marker type != synchronized runtime state type**
 */
type ContainsEntityMapMarker<T> = [T] extends [never]
  ? false
  : T extends EntityMapBuilder<infer _R, infer _K, infer _S>
    ? true
    : T extends readonly unknown[]
      ? false
      : T extends object
        ? true extends {
            [K in keyof T]-?: ContainsEntityMapMarker<T[K]>;
          }[keyof T]
          ? true
          : false
        : false;

/**
 * A source whose declared natural value is TRUTHFUL.
 *
 * ⚠️ The rule is about TYPE TRUTHFULNESS, not topology. It is deliberately NOT
 * "exclude the root": a root with no collection is admitted, and a nested BRANCH
 * containing one is rejected. `tree.$.nested` was measured exactly as untruthful
 * as the root, and `tree.$.plain` exactly as truthful.
 *
 * ⚠️ It rejects at the SOURCE parameter rather than by collapsing the endpoint
 * value to `never`, so a subscribe-only or oddly inferred endpoint cannot sneak
 * an untruthful source through.
 *
 * The escape hatch is not a flag — it is to link the collection ITSELF, which
 * has a correct public value:
 *
 * ```ts
 * link(tree.$.nested.users, endpoint)   // User[], truthful
 * ```
 */
export type TruthfulLinkSource<S> =
  ContainsEntityMapMarker<NaturalValue<S>> extends true ? never : S;

/**
 * Read/write accessors resolved from the NODE, not configured by the caller.
 *
 * ```text
 * collection   read all()      write setAll(value)
 * leaf         read signal()   write set(value)
 * branch/root  read source()   write source(value)
 * ```
 */
function accessorsFor<T>(x: unknown): {
  read: () => T;
  write: (value: T) => void;
} {
  const node = x as {
    all?: () => T;
    setAll?: (v: T) => void;
    set?: (v: T) => void;
  };

  if (typeof node.all === 'function' && typeof node.setAll === 'function') {
    return { read: () => node.all!(), write: (v: T) => node.setAll!(v) };
  }

  if (typeof node.set === 'function') {
    return { read: () => (x as () => T)(), write: (v: T) => node.set!(v) };
  }

  return {
    read: () => (x as () => T)(),
    write: (v: T) => (x as (v: T) => void)(v),
  };
}

export function link<S>(
  source: TruthfulLinkSource<S>,
  endpoint: LinkEndpoint<NaturalValue<S>>
): Link {
  type T = NaturalValue<S>;
  const x = source as unknown;

  // ⚠️ THE X CONSTRAINT, ENFORCED HERE. A registry is what makes this a location
  // the tree owns and can settle — a bare signal or a computed has none.
  const registry = getPositionRegistry(x);
  if (!registry) {
    throw new Error(
      'link: X must be an owned SignalTree location. A bare signal() or ' +
        'computed() has no owning tree, so there is nothing to settle against.'
    );
  }

  // ⚠️ AN EMPTY ENDPOINT IS REFUSED. Earned by DEMARCATION-0: a link with no
  // direction synchronizes nothing, and silently returning an inert handle
  // means `settled()` resolves and `retrieve()` throws for a reason the caller
  // did not cause. Fail where the mistake was written.
  if (!endpoint.get && !endpoint.set && !endpoint.subscribe) {
    throw new Error(
      'link: the endpoint must supply at least one of get, set or ' +
        'subscribe — a link with no direction synchronizes nothing.'
    );
  }

  const { read, write } = accessorsFor<T>(x);
  const ownerPath = getOwnedOwnerPath(x) ?? '';
  const notifier = getPathNotifier();

  let knownY: { value: T } | undefined;
  let disposed = false;
  let dirty = false;
  let chain: Promise<unknown> = Promise.resolve();
  let inboundSeq = 0;

  /**
   * WAITERS, NOT A COUNTER - earned by LINK-HANDLE-0.
   *
   * The first `settled()` polled a count across microtasks, so a settlement
   * arriving on a MACROTASK could never be observed and the loop hit its own
   * guard. Measured: it failed the moment a test confirmed via `setTimeout`.
   *
   * Each HELD observation - marked dirty and handed to the settlement authority
   * but not yet released - owns a promise that resolves when the authority
   * releases it, so `settled()` waits on a signal instead of spinning.
   */
  const held = new Set<{ promise: Promise<void>; resolve: () => void }>();

  /**
   * In-flight retrievals, as RELEASE SIGNALS rather than a counter - same
   * reason as `held`.
   *
   * LINK-HANDLE-1 chose INCLUDED over EXCLUDED: `settled()` means "this
   * relationship has no link-owned work in progress or held", and `retrieve()`
   * is work the link INITIATED AND OWNS. Having its own promise is not
   * sufficient to exclude it - per-operation promises and whole-object idle
   * promises routinely coexist.
   *
   * The deciding argument is that an excluded `retrieve()` can MUTATE X after
   * `settled()` has already returned, which is misleading in exactly the way
   * the WEAK outbound reading was.
   */
  const retrievals = new Set<{ promise: Promise<void>; resolve: () => void }>();

  /**
   * Inbound Y -> X.
   *
   * `external()` marks the write as coming from outside so it is not mistaken
   * for an authored mutation, and `seq` drops a stale emission that lost a race
   * to a newer one.
   */
  const acquire = (value: T, seq: number) => {
    if (disposed || seq < inboundSeq) return;
    inboundSeq = seq;
    knownY = { value };
    external(() => write(value));
  };

  const offSub = notifier.subscribe(
    '**',
    (v, prev, path, _o, _origin, _s, _pos, meta) => {
      if (disposed || !endpoint.set) return;
      // OWNER-PING-0. Two same-shaped trees give their collections the SAME
      // local position id, so identity is (registry, position) — never the
      // position alone.
      const m = (meta ?? {}) as Record<string, unknown>;
      if (m['ownerId'] !== registry.id) return;
      if (
        ownerPath !== '' &&
        path !== ownerPath &&
        !path.startsWith(`${ownerPath}.`)
      ) {
        return;
      }
      // A value-less ping is a notification, not a state change.
      if (v === undefined && prev === undefined) return;
      dirty = true;
    }
  );

  /**
   * ⚠️ THE TURN BOUNDARY IS REQUIRED, not an optimization.
   *
   * Outbound writes are sent once per settled turn, so a transaction that is
   * rolled back never reaches the endpoint, and a multi-write turn sends one
   * value rather than an intermediate for each write.
   */
  const offFlush = notifier.onFlush?.(() => {
    if (disposed || !dirty) return;
    dirty = false;
    // Registered BEFORE the consequence is scheduled, so an observation is
    // already visible to `settled()` while it waits behind settlement.
    let releaseHeld!: () => void;
    const heldPromise = new Promise<void>((r) => (releaseHeld = r));
    const entry = { promise: heldPromise, resolve: releaseHeld };
    held.add(entry);

    scheduleDurableConsequence({
      claimant: x as object,
      key: link,
      run: () => {
        held.delete(entry);
        entry.resolve();
        if (disposed) return;
        chain = chain
          .then(async () => {
            // LINK-RACE-1. Reconcile until X equals Y's acknowledged state.
            // Terminates on EQUALITY, not on a counter — a write that lands
            // while an earlier one is in flight is picked up by the next lap.
            for (;;) {
              if (disposed) return;
              const now = read();
              if (knownY !== undefined && deepEqual(now, knownY.value)) return;
              await endpoint.set?.(now);
              knownY = { value: now };
            }
          })
          .catch((error) => {
            // LINK-2 case 3. A rejected outbound `set()` reaches the EXISTING
            // central reporter, so `Link` needs NO error surface of its own:
            // no `failures`, no error signal, no status. Reusing the reporter
            // is why the handle stays three members.
            //
            // ⚠️ PUBLICLY OBSERVABLE, as of ERROR-SURFACE-2:
            //
            //     Rejected outbound Link sends are publicly observable through
            //     `onTreeError`.
            //
            // ERROR-SURFACE-1 had blocked that claim on two counts, both now
            // measured closed: the event carries a REQUIRED `treeId`, so two
            // same-shaped trees are distinguishable; and the `source` union is
            // deleted rather than frozen into public API.
            //
            // The queue must SURVIVE the failure too. Otherwise one rejection
            // wedges the link forever, which is a retry policy's failure mode
            // arriving without a retry policy.
            reportTreeError({
              error,
              operation: 'link:set',
              treeId: registry.id,
              // ⚠️ `ownerPath` was already known here and previously dropped.
              // Location, never identity — two trees share this string.
              path: ownerPath === '' ? undefined : ownerPath,
            });
          });
      },
    });
  });

  const offSource = endpoint.subscribe
    ? endpoint.subscribe((v) => acquire(v, ++inboundSeq))
    : undefined;

  return {
    async retrieve() {
      if (!endpoint.get) {
        throw new Error('link: endpoint supplies no get().');
      }
      const seq = ++inboundSeq;
      let resolve!: () => void;
      const promise = new Promise<void>((r) => (resolve = r));
      const entry = { promise, resolve };
      retrievals.add(entry);
      try {
        acquire((await endpoint.get()) as T, seq);
      } finally {
        // `finally`, so a rejected get() releases the waiter too - otherwise a
        // failing endpoint would wedge every future `settled()`.
        retrievals.delete(entry);
        entry.resolve();
      }
    },
    async settled() {
      // STRONG, not `await chain`. LINK-HANDLE-0 measured that the weak form
      // means only "the chain I can currently see is drained", which misses
      // observations HELD behind settlement and anything a completed send
      // caused the reconciler to enqueue.
      for (;;) {
        await chain;
        if (disposed) return;
        // Retrieval first: an acquisition can enqueue outbound work, so
        // draining the chain before the retrieval lands would miss it.
        if (retrievals.size > 0) {
          await Promise.race([...retrievals].map((r) => r.promise));
          continue;
        }
        if (held.size === 0) break;
        // The RELEASE SIGNAL, not a poll. Every appended send is preceded by a
        // held observation, so this also carries the loop across work enqueued
        // behind a completed send.
        await Promise.race([...held].map((h) => h.promise));
      }
    },
    dispose() {
      disposed = true;
      offSub();
      offFlush?.();
      offSource?.();
      // Release anyone already inside `settled()`: a disposed link owns no
      // further work, and a held observation's count never returns to zero on
      // its own.
      for (const h of [...held]) {
        held.delete(h);
        h.resolve();
      }
      for (const r of [...retrievals]) {
        retrievals.delete(r);
        r.resolve();
      }
    },
  };
}
