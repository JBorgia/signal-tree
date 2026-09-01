import type { PreparedSubjectUpdates } from './subject-record-target';

export type PhysicalValueHandle = {
  readonly subjectId: number;
  readonly slot: number;
  readonly generation: number;
};

export type PhysicalValuePool<E extends Record<string, unknown>> = {
  readonly handlesBySubject: ReadonlyMap<number, PhysicalValueHandle>;
  readonly subjects: readonly (number | undefined)[];
  readonly generations: readonly number[];
  readonly values: readonly (E | undefined)[];
  readonly freeSlots: readonly number[];
};

class ImmutableMapView<K, V> implements ReadonlyMap<K, V> {
  readonly #entries: Map<K, V>;

  constructor(entries?: Iterable<readonly [K, V]>) {
    this.#entries = new Map(entries);
    Object.freeze(this);
  }

  get size(): number {
    return this.#entries.size;
  }

  get(key: K): V | undefined {
    return this.#entries.get(key);
  }

  has(key: K): boolean {
    return this.#entries.has(key);
  }

  entries(): MapIterator<[K, V]> {
    return this.#entries.entries();
  }

  keys(): MapIterator<K> {
    return this.#entries.keys();
  }

  values(): MapIterator<V> {
    return this.#entries.values();
  }

  forEach(
    callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    thisArg?: unknown
  ): void {
    for (const [key, value] of this.#entries) {
      callbackfn.call(thisArg, value, key, this);
    }
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.#entries[Symbol.iterator]();
  }
}

export function emptyPhysicalValuePool<
  E extends Record<string, unknown>
>(): PhysicalValuePool<E> {
  return Object.freeze({
    handlesBySubject: new ImmutableMapView<number, PhysicalValueHandle>(),
    subjects: Object.freeze([]),
    generations: Object.freeze([]),
    values: Object.freeze([]),
    freeSlots: Object.freeze([]),
  });
}

export function preparePhysicalValueTarget<E extends Record<string, unknown>>(
  current: PhysicalValuePool<E>,
  updates: PreparedSubjectUpdates<E>
): PhysicalValuePool<E> {
  const handlesBySubject = new Map(current.handlesBySubject);
  const subjects = [...current.subjects];
  const generations = [...current.generations];
  const values = [...current.values];
  const freeSlots = [...current.freeSlots];

  for (const update of updates) {
    if (update.value === undefined) {
      continue;
    }
    const currentHandle = current.handlesBySubject.get(update.subjectId);
    const slot = currentHandle?.slot ?? freeSlots.pop() ?? subjects.length;
    const generation = nextGeneration(generations[slot], slot);
    const handle = Object.freeze({
      subjectId: update.subjectId,
      slot,
      generation,
    });
    handlesBySubject.set(update.subjectId, handle);
    subjects[slot] = update.subjectId;
    generations[slot] = generation;
    values[slot] = update.value;
  }

  return freezePool({
    handlesBySubject,
    subjects,
    generations,
    values,
    freeSlots,
  });
}

export function preparePhysicalValueRelease<E extends Record<string, unknown>>(
  current: PhysicalValuePool<E>,
  subjectIds: readonly number[]
): PhysicalValuePool<E> {
  const handles = requireDistinctHandles(current, subjectIds);
  const handlesBySubject = new Map(current.handlesBySubject);
  const subjects = [...current.subjects];
  const generations = [...current.generations];
  const values = [...current.values];
  const freeSlots = [...current.freeSlots];

  for (const handle of handles) {
    handlesBySubject.delete(handle.subjectId);
    subjects[handle.slot] = undefined;
    values[handle.slot] = undefined;
    freeSlots.push(handle.slot);
  }

  return freezePool({
    handlesBySubject,
    subjects,
    generations,
    values,
    freeSlots,
  });
}

export function resolvePhysicalValue<E extends Record<string, unknown>>(
  pool: PhysicalValuePool<E>,
  handle: PhysicalValueHandle
): E | undefined {
  return pool.subjects[handle.slot] === handle.subjectId &&
    pool.generations[handle.slot] === handle.generation
    ? pool.values[handle.slot]
    : undefined;
}

export function valueHandleForSubject<E extends Record<string, unknown>>(
  pool: PhysicalValuePool<E>,
  subjectId: number
): PhysicalValueHandle | undefined {
  return pool.handlesBySubject.get(subjectId);
}

function requireDistinctHandles<E extends Record<string, unknown>>(
  pool: PhysicalValuePool<E>,
  subjectIds: readonly number[]
): PhysicalValueHandle[] {
  const seenSubjects = new Set<number>();
  return subjectIds.map((subjectId) => {
    assertSubjectId(subjectId);
    if (seenSubjects.has(subjectId)) {
      throw new Error(`Duplicate physical SubjectId ${String(subjectId)}`);
    }
    seenSubjects.add(subjectId);
    const handle = pool.handlesBySubject.get(subjectId);
    if (handle === undefined) {
      throw new Error(`SubjectId ${String(subjectId)} has no physical value`);
    }
    return handle;
  });
}

function freezePool<E extends Record<string, unknown>>(pool: {
  handlesBySubject: Map<number, PhysicalValueHandle>;
  subjects: (number | undefined)[];
  generations: number[];
  values: (E | undefined)[];
  freeSlots: number[];
}): PhysicalValuePool<E> {
  return Object.freeze({
    handlesBySubject: new ImmutableMapView(pool.handlesBySubject),
    subjects: Object.freeze(pool.subjects),
    generations: Object.freeze(pool.generations),
    values: Object.freeze(pool.values),
    freeSlots: Object.freeze(pool.freeSlots),
  });
}

function nextGeneration(current: number | undefined, slot: number): number {
  const generation = current ?? 0;
  if (!Number.isSafeInteger(generation) || generation < 0) {
    throw new Error(
      `Invalid physical value generation for slot ${String(slot)}`
    );
  }
  if (generation === Number.MAX_SAFE_INTEGER) {
    throw new Error(
      `Physical value generation exhausted for slot ${String(slot)}`
    );
  }
  return generation + 1;
}

function assertSubjectId(subjectId: number): void {
  if (!Number.isSafeInteger(subjectId) || subjectId <= 0) {
    throw new Error(`Invalid SubjectId ${String(subjectId)}`);
  }
}
