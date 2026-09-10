import type { WriteMetadata } from '../mutation-types';
import { getPathNotifier } from '../path-notifier';

/**
 * @internal One observed write, flattened for tooling.
 *
 * ⚠️ `ownerId` may be ABSENT. It is the only trustworthy tree namespace —
 * `positionId` is allocated from 1 per tree and collides across trees — so a
 * frame without it CANNOT be attributed. Consumers must decide deliberately
 * what an absent owner means rather than guessing.
 */
export interface ObservedWriteFrame {
  readonly path: string;
  readonly ownerPath: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly origin?: WriteMetadata['origin'];
  readonly participation?: WriteMetadata['participation'];
  readonly ownerId?: number;
  readonly transactionId?: number;
  readonly subjectIds?: readonly number[];
  readonly positionIds?: readonly number[];
}

/**
 * @internal Observe writes across **every** tree in this process.
 *
 *     THE NOTIFIER IS PROCESS-GLOBAL. THIS ACCESSOR DOES NOT HIDE THAT.
 *
 * A subscriber receives writes belonging to other trees and must filter on
 * `ownerId` itself. Naming this `observeTreeWrites(tree, ...)` would imply a
 * scoping guarantee the mechanism does not provide — the exact assumption that
 * produced `NOTIFIER-SCOPE-0` and, later, the diagnostic journal's cross-tree
 * capture defect.
 *
 * Deliberately generic: kernel truth about writes, not any consumer's model of
 * them.
 *
 * @returns an unsubscribe function. Calling it must leave no subscriber behind.
 */
export function observeWrites(
  handler: (frame: ObservedWriteFrame) => void
): () => void {
  return getPathNotifier().subscribe(
    '**',
    (next, prev, path, ownerPath, origin, subjectIds, positionIds, meta) => {
      const m = (meta ?? {}) as WriteMetadata;
      handler({
        path,
        ownerPath: ownerPath ?? path,
        before: prev,
        after: next,
        origin: (origin as WriteMetadata['origin']) ?? m.origin,
        participation: m.participation,
        ownerId: m.ownerId,
        transactionId: typeof m.transactionId === 'number' ? m.transactionId : undefined,
        subjectIds,
        positionIds,
      });
    }
  );
}
