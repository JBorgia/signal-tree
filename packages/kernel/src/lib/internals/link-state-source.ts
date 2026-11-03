/**
 * Production seam for Link activity OBSERVATION (read-only tooling).
 *
 *     A DORMANT CAPABILITY IMPOSES NO ACTIVE-STATE MACHINERY.
 *
 * Each relationship registers one record (so a reader that attaches later
 * still sees it) and notifies through a slot whose observer is `undefined`
 * until `linkStateReader` (from `@signal-tree/kernel/internals`) attaches.
 * Views, sequences, queueing and delivery live in `link-state-view.ts`,
 * bundled only when imported. A record holds no values.
 */

/** dirty, held, queued, sending, retrieving, disposed — read at each call. */
export type LinkActivity = readonly [
  dirty: boolean,
  held: boolean,
  queued: number,
  sending: boolean,
  retrieving: number,
  disposed: boolean
];

export interface LinkRecord {
  readonly id: number;
  /** The linked source node; its owned positions are read on demand. */
  readonly source: object;
  readonly path: string;
  readonly endpoint: {
    readonly get?: unknown;
    readonly set?: unknown;
    readonly subscribe?: unknown;
  };
  activity(): LinkActivity;
}

export interface LinkStateSlot {
  next: number;
  readonly links: Map<number, LinkRecord>;
  observer?: (record: LinkRecord, kind?: string) => void;
}

const SLOTS = new WeakMap<object, LinkStateSlot>();

export function getLinkStateSlot(registry: object): LinkStateSlot {
  let slot = SLOTS.get(registry);
  if (!slot) SLOTS.set(registry, (slot = { next: 1, links: new Map() }));
  return slot;
}

/**
 * @internal Register one relationship. The returned notifier reports a change
 * (no argument), a named event, or `'disposed'` (which also retires the
 * record); `null` retires it silently (a construction that never returned).
 */
export function registerLinkState(
  registry: object,
  source: object,
  path: string,
  endpoint: LinkRecord['endpoint'],
  activity: () => LinkActivity
): (kind?: string | null) => void {
  const slot = getLinkStateSlot(registry);
  const record: LinkRecord = {
    id: slot.next++,
    source,
    path,
    endpoint,
    activity,
  };
  slot.links.set(record.id, record);
  return (kind) => {
    if (!slot.links.has(record.id)) return;
    if (kind === null || kind === 'disposed') slot.links.delete(record.id);
    if (kind !== null) slot.observer?.(record, kind);
  };
}
