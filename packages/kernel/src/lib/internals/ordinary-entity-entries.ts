import type { WriteMetadata } from '../mutation-types';
import {
  getEntityOrdinaryChanges,
  ordinaryEntityEntry,
  withoutEntityOrdinaryChanges,
} from './entity-value-transition';

/** Select prepared ordinary responsibility once; an empty list is affirmative evidence. */
export function ordinaryEntityEntries<
  T extends {
    readonly path: string;
    readonly newValue: unknown;
    readonly oldValue: unknown;
    readonly subjectIds?: readonly number[];
    readonly meta?: WriteMetadata;
  }
>(entry: T): T[] {
  const changes = getEntityOrdinaryChanges(entry.meta);
  if (changes === undefined) return [ordinaryEntityEntry(entry)];
  const clean = withoutEntityOrdinaryChanges(entry.meta);
  return changes.map((change) => ({
    ...entry,
    path: change.path ?? entry.path,
    newValue: change.after,
    oldValue: change.before,
    subjectIds: [change.subject],
    meta: { ...clean, structuralEffect: change.structuralRecord },
  }));
}
