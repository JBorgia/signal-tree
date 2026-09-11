import { type StudioTreeId } from '@signal-tree/studio-query';

import {
  type RealizationCaptureSnapshot,
  type RealizationEffect,
  type ScopeIntegrity,
} from './types';

import { captureBoundedValue as capture } from './bounded-value';

function boundedInteger(value: number, maximum: number, name: string): number {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`${name} must be an integer from 1 to ${maximum}`);
  }
  return value;
}

/**
 * One observed write frame, as the adapter receives it. Structural, so this
 * package does not depend on kernel internals.
 */
export interface ObservedFrame {
  readonly path: string;
  readonly ownerPath: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly origin?: RealizationEffect['origin'];
  readonly participation?: string;
  /** Tree namespace. Absent means UNATTRIBUTABLE — see `accept`. */
  readonly ownerId?: number;
  readonly transactionId?: number;
  readonly subjectIds?: readonly number[];
  readonly positionIds?: readonly number[];
}

export interface RealizationCapture {
  /** Feed one observed frame. Returns whether it was attributed. */
  accept(frame: ObservedFrame): boolean;
  snapshot(): RealizationCaptureSnapshot;
  dispose(): void;
}

export interface RealizationCaptureOptions {
  readonly treeId: StudioTreeId;
  readonly ownerId: number;
  readonly maxEffects?: number;
  readonly maxBytes?: number;
}

const DEFAULT_MAX_EFFECTS = 500;

export function createRealizationCapture(
  options: RealizationCaptureOptions
): RealizationCapture {
  const capacity = boundedInteger(
    options.maxEffects ?? DEFAULT_MAX_EFFECTS,
    10_000,
    'maxEffects'
  );
  const maxBytes = boundedInteger(
    options.maxBytes ?? 2 * 1024 * 1024,
    16 * 1024 * 1024,
    'maxBytes'
  );
  // getRandomValues is available on HTTP development origins too; randomUUID
  // is restricted to secure contexts in browsers.
  const captureId = Array.from(
    globalThis.crypto.getRandomValues(new Uint32Array(4)),
    (part) => part.toString(16).padStart(8, '0')
  ).join('');
  const sizes: number[] = [];
  let retainedBytes = 0;
  const effects: RealizationEffect[] = [];

  let sequence = 0;
  const startedAtSequence = 0;
  let scopeIntegrity: ScopeIntegrity = 'complete';
  let truncated = false;
  let disposed = false;

  return {
    accept(frame) {
      if (disposed) {
        return false;
      }
      if (frame.participation !== 'realized') {
        return false;
      }

      // OWNER-EVIDENCE-0: attribute only on a matching owner. An absent owner
      // CANNOT be classified — no positive discriminator exists — so it is
      // neither attributed nor silently dropped: it degrades scope integrity.
      if (typeof frame.ownerId !== 'number') {
        scopeIntegrity = 'incomplete-unscoped-evidence';
        return false;
      }
      if (frame.ownerId !== options.ownerId) {
        // Positively another tree's write. Not evidence about this tree, and
        // not a gap in this tree's coverage either.
        return false;
      }

      let metadataOmitted = false;
      const identities = (
        ids: readonly number[] | undefined
      ): readonly number[] | undefined => {
        if (ids === undefined) return undefined;
        if (
          ids.length > 2000 ||
          ids.some((id) => !Number.isSafeInteger(id) || id < 0)
        ) {
          metadataOmitted = true;
          return undefined;
        }
        return [...ids];
      };
      const subjectIds = identities(frame.subjectIds),
        positionIds = identities(frame.positionIds);
      const transactionId =
        frame.transactionId !== undefined &&
        Number.isSafeInteger(frame.transactionId) &&
        frame.transactionId >= 0
          ? frame.transactionId
          : undefined;
      if (frame.transactionId !== undefined && transactionId === undefined)
        metadataOmitted = true;
      const valueLimit = Math.min(64 * 1024, Math.floor(maxBytes / 4));
      const before = capture(frame.before, valueLimit);
      const after = capture(frame.after, valueLimit);
      const size =
        256 +
        frame.path.length * 2 +
        frame.ownerPath.length * 2 +
        before.bytes +
        after.bytes +
        ((subjectIds?.length ?? 0) + (positionIds?.length ?? 0)) * 8;
      effects.push({
        captureId,
        sequence: sequence++,
        path: frame.path,
        ownerPath: frame.ownerPath,
        // Snapshotted, never referenced — see CapturedValue's doc.
        before: before.value,
        after: after.value,
        origin: frame.origin,
        participation: 'realized',
        ...(transactionId !== undefined ? { transactionId } : {}),
        ...(subjectIds !== undefined ? { subjectIds } : {}),
        ...(positionIds !== undefined ? { positionIds } : {}),
        ...(metadataOmitted ? { metadataOmitted: true as const } : {}),
      });

      sizes.push(size);
      retainedBytes += size;
      while (effects.length > capacity || retainedBytes > maxBytes) {
        effects.shift();
        retainedBytes -= sizes.shift()!;
        truncated = true;
      }
      return true;
    },

    snapshot() {
      return {
        treeId: options.treeId,
        captureId,
        coverage: {
          completeFromTreeStart: false,
          scopeIntegrity,
          startedAtSequence,
        },
        retention: {
          capacity,
          maxBytes,
          retainedBytes,
          retained: effects.length,
          truncated,
          firstRetainedSequence: effects[0]?.sequence,
          lastRetainedSequence: effects.at(-1)?.sequence,
        },
        effects: [...effects],
      };
    },

    dispose() {
      disposed = true;
      effects.length = 0;
      sizes.length = 0;
      retainedBytes = 0;
    },
  };
}
