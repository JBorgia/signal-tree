/**
 * Production seam for restoration OBSERVATION (read-only tooling).
 *
 *     A DORMANT CAPABILITY IMPOSES NO ACTIVE-STATE MACHINERY.
 *
 * Restoration keeps what only it can know — stable entry ids, the transaction
 * that staged an entry, which errors are its own refusals — and calls an
 * observer that is `undefined` until `restorationReader` (from
 * `@signal-tree/kernel/internals`) first attaches. Snapshots, operation ids,
 * outcome classification, queueing and delivery live in
 * `restoration-reader.ts`, bundled only when imported.
 */
import type { TreeId } from './position-registry';

/** IDs are scoped by the snapshot/event treeId, and never reused after reset. */
export type RestorationEntryId = `restoration-entry:${number}`;

export interface RestorationSourceState {
  readonly entries: readonly {
    readonly id: number;
    readonly entryId: RestorationEntryId;
    readonly __transactionId?: number;
  }[];
  statusOf(turnId: number): string | undefined;
  readonly currentIndex: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface RestorationObserver {
  historyChanged(): void;
  /**
   * One undo/redo/jump ended. `applied` lists the entries whose reversal
   * installed. `failure` is present when the operation threw before it
   * completed (an error after completion is a delivery failure).
   */
  operation(
    operation: 'undo' | 'redo' | 'jump',
    applied: ReadonlySet<RestorationEntryId>,
    failure?: { readonly error: unknown }
  ): void;
}

export interface RestorationSource {
  readonly treeId: TreeId;
  read(): RestorationSourceState;
  attach(observer: RestorationObserver): void;
}

// A refusal is the error object restoration itself created when it declined an
// operation and changed nothing. Messages are not evidence: a validator or a
// listener may throw any text, including one that imitates ST1034.
const REFUSALS = new WeakSet<Error>();

/** @internal Restoration's own refusal: it declined and changed nothing. */
export function restorationRefusal(message: string): Error {
  const error = new Error(message);
  REFUSALS.add(error);
  return error;
}

export function isRestorationRefusal(error: unknown): boolean {
  return error instanceof Error && REFUSALS.has(error);
}

const SOURCES = new WeakMap<object, RestorationSource>();

/** @internal The restoration owner registers its source under the tree root. */
export function defineRestorationSource(
  root: object,
  source: RestorationSource
): void {
  SOURCES.set(root, source);
}

export function getRestorationSource(
  root: object
): RestorationSource | undefined {
  return SOURCES.get(root);
}
