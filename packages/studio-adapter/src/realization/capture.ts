import { type StudioTreeId } from '@signal-tree/studio-query';

import {
  type CapturedValue,
  type RealizationCaptureSnapshot,
  type RealizationEffect,
  type ScopeIntegrity,
} from './types';

/**
 * Snapshot a value at capture time.
 *
 * `structuredClone` is the right primitive here, chosen from what
 * CAPTURE-VALUE-0 actually measured rather than assumed: it preserves `Date`,
 * `Map` and `Set`, and handles cyclic objects — all of which a JSON round-trip
 * would lose or throw on. It rejects functions and symbols, and those become an
 * explicit `unserializable` record rather than vanishing.
 */
function capture(value: unknown): CapturedValue {
  try {
    return { kind: 'value', value: structuredClone(value) };
  } catch {
    return {
      kind: 'unserializable',
      valueType: typeof value,
      preview: previewOf(value),
    };
  }
}

function previewOf(value: unknown): string {
  if (typeof value === 'function') {
    return `function ${(value as { name?: string }).name || '(anonymous)'}`;
  }
  if (typeof value === 'symbol') {
    return String(value);
  }
  try {
    return String(value);
  } catch {
    return `[unrepresentable ${typeof value}]`;
  }
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
        // Snapshotted, never referenced — see CapturedValue's doc.
        before: capture(frame.before),
        after: capture(frame.after),
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
