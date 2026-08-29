import type { WritableCell } from './cell-runtime';

import type { MutationCaptureRuntime } from './mutation-capture-runtime';
import { hasPathObservers, pathObservation } from './path-observation-port';
import type {
  WriteMetadata,
} from '../types';
import {
  OWNED_NODE_METADATA,
  type OwnedNodeMetadata,
} from './owned-metadata';

// The READ side of owned-node metadata is framework-neutral and lives in
// owned-metadata.ts; this file keeps the write side, which needs untracked().
// Re-exported so the public surface is unchanged.
export {
  getOwnedPositionIds,
  getOwnedSubjectIds,
  getOwnedOwnerPath,
  getOwnedOwnerId,
  hasIntrinsicMutationEmitter,
} from './owned-metadata';
import { getActiveWriteContext } from '../write-context';
import { withoutTracking } from './tracking-suppression';

type OwnedMutationIntent = NonNullable<WriteMetadata['mutationIntent']>;

type OwnedMetadataStorage = 'property' | 'sidecar';

type OwnedMutationOptions = {
  path: string;
  positionIds: readonly number[] | undefined;
  /** Registry namespace the position ids belong to. See PositionRegistry.id. */
  ownerId?: number;
  metadataStorage?: OwnedMetadataStorage;
  captureRuntime?: MutationCaptureRuntime;
};

type OwnedWriteHooks<TValue> = {
  afterSet?: (
    value: TValue,
    before: TValue,
    after: TValue,
    changed: boolean
  ) => void;
  afterUpdate?: (
    before: TValue,
    after: TValue,
    changed: boolean
  ) => void;
};

// ⚠️ `toSegments` WAS DELETED IN 15.0 with `MutationEnvelope` (ME-B).
//
// It split a string path into `PropertyKey[]` so the envelope could carry
// segments, and `joinPathSegments` in path-notifier immediately rejoined them
// with the same delimiter. Round-tripping split('.')/join('.') is string
// identity, so nothing observable depended on it — and the intermediate array
// was WRONG for any key containing a dot, which never mattered because no
// consumer ever read the segments. The one representation the envelope added
// over the protocol was the one nothing used.

function mergeOwnedNodeMetadata(
  node: object,
  patch: Partial<OwnedNodeMetadata>
): void {
  const existing = OWNED_NODE_METADATA.get(node) ?? {};
  OWNED_NODE_METADATA.set(node, { ...existing, ...patch });
}





export function defineOwnedPositionIds(
  node: object,
  positionIds: readonly number[] | undefined,
  storage: OwnedMetadataStorage = 'property'
): void {
  if (!positionIds || positionIds.length === 0) {
    return;
  }

  if (storage === 'sidecar') {
    mergeOwnedNodeMetadata(node, { positionIds: [...positionIds] });
    return;
  }

  Object.defineProperty(node, '__positionIds', {
    get: () => [...positionIds],
    enumerable: false,
    configurable: true,
  });
}

/**
 * ⚠️ `defineOwnedSubjectIds` WAS DELETED IN 15.0 — MUTATION-ENVELOPE-OWNERSHIP-0.
 *
 * It wrote `__subjectIds` onto a leaf, and had exactly one caller: a branch here
 * guarded by `if (options.subjectIds)`. No caller of `wrapOwnedWritableSignal`
 * ever supplied `subjectIds`, so the guard never opened and the writer never
 * ran. Proven by exit code, not inspection: throwing when `options.subjectIds`
 * was defined left the suite GREEN, while throwing when it was UNDEFINED turned
 * it RED — so the site is reached constantly and the field is never populated.
 *
 * `__subjectIds` itself is still written, by `entity-signal.ts`, through a
 * DIRECT `Object.defineProperty` — which is why `getSubjectIds` in
 * `intercept-leaf-signals.ts` still reads real data. Subject identity reaches
 * delivery on the entity path, never through owned-mutation. This function was
 * a second, unused writer for a fact entities already owned.
 */

export function defineOwnedOwnerPath(
  node: object,
  ownerPath: string,
  storage: OwnedMetadataStorage = 'property'
): void {
  if (storage === 'sidecar') {
    mergeOwnedNodeMetadata(node, { ownerPath });
    return;
  }

  Object.defineProperty(node, '__ownerPath', {
    value: ownerPath,
    enumerable: false,
    configurable: true,
  });
}

export function defineOwnedOwnerId(
  node: object,
  ownerId: number | undefined,
  storage: OwnedMetadataStorage = 'property'
): void {
  if (ownerId === undefined) {
    return;
  }

  if (storage === 'sidecar') {
    mergeOwnedNodeMetadata(node, { ownerId });
    return;
  }

  Object.defineProperty(node, '__ownerId', {
    value: ownerId,
    enumerable: false,
    configurable: true,
  });
}

// ⚠️ NOT EXPORTED. Used only inside this module; the `export` was surplus.
// (ORPHAN sweep, 15.0. Same-file-only proves the EXPORT is unnecessary — it says
// nothing about who owns the code, and this code is live.)
function defineIntrinsicMutationEmitter(
  node: object,
  storage: OwnedMetadataStorage = 'property'
): void {
  if (storage === 'sidecar') {
    mergeOwnedNodeMetadata(node, { emitsMutations: true });
    return;
  }

  Object.defineProperty(node, '__emitsMutations', {
    value: true,
    enumerable: false,
    configurable: true,
  });
}

export function emitOwnedMutation(
  options: OwnedMutationOptions,
  before: unknown,
  after: unknown,
  mutationIntent: OwnedMutationIntent
): void {
  const positionId = options.positionIds?.[0];
  if (positionId === undefined) {
    return;
  }

  // Through the PORT, not the engine: a subscriber-less consumer must not link
  // the delivery implementation at all. This guard already made the machinery
  // unreachable at RUNTIME; the port makes it unreachable to the BUNDLER too.
  if (!hasPathObservers()) {
    return;
  }

  // ⚠️ PUBLISHED DIRECTLY. There used to be a `MutationEnvelope` here, handed
  // to `port.emitMutation()`, which immediately unpacked it field-for-field
  // into exactly this `notify(...)` call — ME-B, MUTATION-ENVELOPE-OWNERSHIP-0.
  //
  //     A ONE-USE OBJECT THAT ONLY TRANSCODES INTO THE ALREADY-AUTHORITATIVE
  //     PROTOCOL IS NOT A SECOND SEMANTIC BOUNDARY.
  //
  // `notify` was already the shared protocol: entity structural mutations never
  // used the envelope and call it directly with live structural metadata.
  //
  // ⚠️ `ownerPath` IS PASSED AS `options.path` ON PURPOSE, not dropped. Every
  // reachable emission from this producer was measured to have ownerPath equal
  // to path and never undefined. That is a fact about THIS producer, not about
  // the protocol: other `notify` callers genuinely distinguish the event
  // address from the owning collection's address, so the parameter stays.
  pathObservation().notify(
    options.path,
    after,
    before,
    options.path,
    // subjectIds: this generic scalar route has no subject-identity producer
    // and must not acquire one. Entity/structural notification owns that fact.
    undefined,
    [positionId],
    {
      ...(getActiveWriteContext() ?? {}),
      mutationIntent,
    },
    options.ownerId
  );
}

export function runOwnedMutation<TValue>(
  read: () => TValue,
  apply: () => void,
  options: OwnedMutationOptions,
  mutationIntent: OwnedMutationIntent
): { before: TValue; after: TValue; changed: boolean } {
  const before = withoutTracking(read);
  apply();
  const after = withoutTracking(read);
  const changed = !Object.is(before, after);
  if (changed) {
    emitOwnedMutation(options, before, after, mutationIntent);
  }
  return { before, after, changed };
}

export function wrapOwnedWritableSignal<TValue>(
  leaf: WritableCell<TValue>,
  options: OwnedMutationOptions,
  hooks: OwnedWriteHooks<TValue> = {}
): void {
  const metadataStorage = options.metadataStorage ?? 'property';

  defineOwnedPositionIds(leaf as object, options.positionIds, metadataStorage);
  defineOwnedOwnerId(leaf as object, options.ownerId, metadataStorage);

  // ⚠️ THE OWNER-ADDRESS FACT SURVIVES; THE DUPLICATE INPUT DOES NOT.
  // `options.ownerPath ?? options.path` stood here, and `ownerPath` was
  // measured to equal `path` at every reachable emission. Installing persistent
  // `__ownerPath` metadata is a real semantic job and is kept — it is now
  // DERIVED from `path` at this producer instead of threaded as a second,
  // always-identical argument.
  defineOwnedOwnerPath(leaf as object, options.path, metadataStorage);
  defineIntrinsicMutationEmitter(leaf as object, metadataStorage);

  const originalSet = leaf.set.bind(leaf);
  const originalUpdate = leaf.update.bind(leaf);

  leaf.set = (value: TValue) => {
    const { before, after, changed } = runOwnedMutation(
      leaf,
      () => originalSet(value),
      options,
      'replace'
    );

    hooks.afterSet?.(value, before, after, changed);
  };

  leaf.update = (updater: (value: TValue) => TValue) => {
    const { before, after, changed } = runOwnedMutation(
      leaf,
      () => originalUpdate(updater),
      options,
      'derive'
    );

    hooks.afterUpdate?.(before, after, changed);
  };
}
