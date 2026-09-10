import { type StudioTreeId } from '@signal-tree/studio-query';

import {
  type RealizationCaptureSnapshot,
  type RealizationEffect,
  type ScopeIntegrity,
} from './types';

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
}

const DEFAULT_MAX_EFFECTS = 500;

export function createRealizationCapture(
  options: RealizationCaptureOptions
): RealizationCapture {
  const capacity = Math.max(1, options.maxEffects ?? DEFAULT_MAX_EFFECTS);
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

      effects.push({
        sequence: sequence++,
        path: frame.path,
        ownerPath: frame.ownerPath,
        before: frame.before,
        after: frame.after,
        origin: frame.origin,
        participation: 'realized',
      });

      while (effects.length > capacity) {
        effects.shift();
        truncated = true;
      }
      return true;
    },

    snapshot() {
      return {
        treeId: options.treeId,
        coverage: {
          completeFromTreeStart: false,
          scopeIntegrity,
          startedAtSequence,
        },
        retention: {
          capacity,
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
    },
  };
}
