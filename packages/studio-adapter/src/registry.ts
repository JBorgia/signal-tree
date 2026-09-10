import { type StudioTreeId, type StudioTurn } from '@signal-tree/studio-query';

import { type StudioCapability } from './capabilities';
import { type StudioResult } from './errors';
import { type ConfirmedTurnReader, type KernelRetention } from './kernel-contract';
import { toStudioTurn } from './normalize';
import { type StudioTreeId as _StudioTreeId } from '@signal-tree/studio-query';

export interface StudioBridgeTree {
  readonly id: StudioTreeId;
  readonly label?: string;
  readonly capabilities: readonly StudioCapability[];
}

export interface ConfirmedTurnsResponse {
  readonly treeId: StudioTreeId;
  readonly retention: KernelRetention;
  readonly turns: readonly StudioTurn[];
}

interface Attachment {
  readonly studioTreeId: StudioTreeId;
  readonly label?: string;
  /** `undefined` when the tree has no transactions() enhancer. */
  readonly reader: ConfirmedTurnReader | undefined;
  readonly capabilities: readonly StudioCapability[];
  /** S2 hooks. Absent for a probe-injected attachment in tests. */
  readonly structure?: { readonly capabilities: readonly string[] | undefined };
  readonly createCaptureTarget?: () => unknown;
  readonly readCurrentValue?: (path: string) => unknown;
  readonly readStateShape?: (options: { maxDepth?: number; maxKeys?: number }) => unknown;
}

export interface StudioRegistry {
  add(runtimeTreeId: unknown, attachment: Omit<Attachment, 'studioTreeId'>): StudioTreeId;
  /** The attachment record, for S2 bridge commands. Never creates. */
  attachment(treeId: StudioTreeId): Attachment | undefined;
  remove(studioTreeId: StudioTreeId): void;
  listTrees(): readonly StudioBridgeTree[];
  readConfirmedTurns(treeId: StudioTreeId): StudioResult<ConfirmedTurnsResponse>;
  size(): number;
}

/**
 * Session id allocation, deliberately OUTSIDE the registry's lifetime.
 *
 * ⚠️ THESE TWO RULES CONFLICT IF THE COUNTER LIVES IN THE REGISTRY, and a test
 * caught it: dropping the registry on the last detach would reset numbering, so
 * a later tree would be handed `tree-0001` again. A panel still holding that id
 * would then silently read a DIFFERENT tree's history — the exact
 * cross-tree confusion `effectKey` and C11 exist to prevent, arriving through
 * the front door.
 *
 * Recycling is the dangerous half, so the counter survives registry drops. It
 * is a monotonic integer, not a reference: it pins no tree, no reader and no
 * DOM, so "release all Studio references" still holds exactly.
 */
let nextTreeOrdinal = 1;

function createRegistry(): StudioRegistry {
  const attachments = new Map<StudioTreeId, Attachment>();
  // Runtime identity -> session id, for THIS registry's lifetime. Keyed by the
  // opaque runtime value, which is the one use its contract permits.
  const assigned = new Map<unknown, StudioTreeId>();

  return {
    add(runtimeTreeId, attachment) {
      const studioTreeId =
        assigned.get(runtimeTreeId) ??
        `tree-${String(nextTreeOrdinal++).padStart(4, '0')}`;
      assigned.set(runtimeTreeId, studioTreeId);
      attachments.set(studioTreeId, { ...attachment, studioTreeId });
      return studioTreeId;
    },

    attachment(treeId) {
      return attachments.get(treeId);
    },

    remove(studioTreeId) {
      attachments.delete(studioTreeId);
      for (const [runtime, id] of assigned) {
        if (id === studioTreeId) {
          // Drop the runtime->session mapping too, so a rebuilt tree is a new
          // tree rather than inheriting a retired id.
          assigned.delete(runtime);
        }
      }
    },

    listTrees() {
      return [...attachments.values()].map((a) => ({
        id: a.studioTreeId,
        label: a.label,
        capabilities: a.capabilities,
      }));
    },

    readConfirmedTurns(treeId) {
      const attachment = attachments.get(treeId);
      if (!attachment) {
        // Never existed, or its attachment was removed — including by destroy
        // eviction, which is why DESTROYED rarely reaches a caller here.
        return { ok: false, error: { code: 'STUDIO_TREE_NOT_FOUND' } };
      }

      if (!attachment.reader) {
        // The tree is attached and inspectable; it simply cannot answer THIS
        // question. Refuse structurally rather than returning an empty list,
        // which would read as "this transaction history is empty".
        return {
          ok: false,
          error: {
            code: 'STUDIO_CAPABILITY_UNAVAILABLE',
            capability: 'committed-transactions',
          },
        };
      }

      let snapshot;
      try {
        snapshot = attachment.reader.readConfirmedTurns();
      } catch (cause) {
        // The reader observed destruction while the attachment was still live.
        if ((cause as { code?: string })?.code === 'STUDIO_TREE_DESTROYED') {
          return { ok: false, error: { code: 'STUDIO_TREE_DESTROYED' } };
        }
        throw cause;
      }

      return {
        ok: true,
        value: {
          treeId,
          retention: snapshot.retention,
          turns: snapshot.turns.map((turn) => toStudioTurn(treeId, turn)),
        },
      };
    },

    size() {
      return attachments.size;
    },
  };
}

/**
 * ⚠️ LAZY BY CONTRACT, NOT BY HABIT. Importing `@signal-tree/studio-adapter`
 * must create nothing: a module-level registry would put Studio state into
 * every bundle that so much as imports the package, and the "absent in
 * production" boundary is what makes the whole bridge defensible.
 *
 * Created on the FIRST attachment, dropped with the LAST detachment.
 */
let active: StudioRegistry | undefined;

export function registryForAttach(): StudioRegistry {
  return (active ??= createRegistry());
}

/** The live registry, or `undefined` when nothing is attached. Never creates. */
export function peekRegistry(): StudioRegistry | undefined {
  return active;
}

export function dropRegistryIfEmpty(): void {
  if (active && active.size() === 0) {
    active = undefined;
  }
}
