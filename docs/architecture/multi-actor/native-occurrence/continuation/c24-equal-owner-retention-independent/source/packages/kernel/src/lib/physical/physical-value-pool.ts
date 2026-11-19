import type { PreparedSubjectUpdates } from './subject-record-target';

export type PhysicalValueHandle = {
  readonly subjectId: number;
  readonly slot: number;
  readonly generation: number;
};

export type PhysicalValueStorage<E extends Record<string, unknown>> = {
  readonly subjects: readonly (number | undefined)[];
  readonly generations: readonly number[];
  readonly values: readonly (E | undefined)[];
  readonly freeSlots: readonly number[];
};

export type PhysicalValuePool<E extends Record<string, unknown>> =
  PhysicalValueStorage<E> & {
    readonly handlesBySubject: ReadonlyMap<number, PhysicalValueHandle>;
  };

export type PhysicalValueAllocation<E extends Record<string, unknown>> = {
  readonly subjectId: number;
  readonly value: E;
  readonly currentHandle?: PhysicalValueHandle;
};

export type PreparedPhysicalValueAllocations<
  E extends Record<string, unknown>
> = {
  readonly storage: PhysicalValueStorage<E>;
  readonly handles: readonly PhysicalValueHandle[];
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
    ...emptyPhysicalValueStorage<E>(),
  });
}

export function emptyPhysicalValueStorage<
  E extends Record<string, unknown>
>(): PhysicalValueStorage<E> {
  return freezeStorage({
    subjects: [],
    generations: [],
    values: [],
    freeSlots: [],
  });
}

export function preparePhysicalValueTarget<E extends Record<string, unknown>>(
  current: PhysicalValuePool<E>,
  updates: PreparedSubjectUpdates<E>
): PhysicalValuePool<E> {
  const handlesBySubject = new Map(current.handlesBySubject);
  const allocations = updates
    .filter(
      (update): update is typeof update & { readonly value: E } =>
        update.value !== undefined
    )
    .map((update) => ({
      subjectId: update.subjectId,
      value: update.value,
      currentHandle: current.handlesBySubject.get(update.subjectId),
    }));
  const prepared = preparePhysicalValueAllocations(current, allocations);
  for (const handle of prepared.handles) {
    handlesBySubject.set(handle.subjectId, handle);
  }

  return freezePool({
    handlesBySubject,
    ...prepared.storage,
  });
}

export function preparePhysicalValueRelease<E extends Record<string, unknown>>(
  current: PhysicalValuePool<E>,
  subjectIds: readonly number[]
): PhysicalValuePool<E> {
  const handles = requireDistinctHandles(current, subjectIds);
  const handlesBySubject = new Map(current.handlesBySubject);
  for (const handle of handles) {
    handlesBySubject.delete(handle.subjectId);
  }
  const storage = preparePhysicalValueStorageRelease(current, handles);

  return freezePool({
    handlesBySubject,
    ...storage,
  });
}

export function preparePhysicalValueAllocations<
  E extends Record<string, unknown>
>(
  current: PhysicalValueStorage<E>,
  allocations: readonly PhysicalValueAllocation<E>[]
): PreparedPhysicalValueAllocations<E> {
  const seenSubjects = new Set<number>();
  for (const allocation of allocations) {
    assertSubjectId(allocation.subjectId);
    if (seenSubjects.has(allocation.subjectId)) {
      throw new Error(
        `Duplicate physical value for SubjectId ${String(allocation.subjectId)}`
      );
    }
    seenSubjects.add(allocation.subjectId);
    if (
      allocation.currentHandle !== undefined &&
      resolvePhysicalValue(current, allocation.currentHandle) === undefined
    ) {
      throw new Error(
        `Stale physical value handle for SubjectId ${String(
          allocation.subjectId
        )}`
      );
    }
    if (
      allocation.currentHandle !== undefined &&
      allocation.currentHandle.subjectId !== allocation.subjectId
    ) {
      throw new Error(
        `Physical value handle does not belong to SubjectId ${String(
          allocation.subjectId
        )}`
      );
    }
  }

  const subjects = [...current.subjects];
  const generations = [...current.generations];
  const values = [...current.values];
  const freeSlots = [...current.freeSlots];
  const handles: PhysicalValueHandle[] = [];
  for (const allocation of allocations) {
    const slot =
      allocation.currentHandle?.slot ?? freeSlots.pop() ?? subjects.length;
    const generation = nextGeneration(generations[slot], slot);
    const handle = Object.freeze({
      subjectId: allocation.subjectId,
      slot,
      generation,
    });
    subjects[slot] = allocation.subjectId;
    generations[slot] = generation;
    values[slot] = allocation.value;
    handles.push(handle);
  }

  return Object.freeze({
    storage: freezeStorage({ subjects, generations, values, freeSlots }),
    handles: Object.freeze(handles),
  });
}

export function preparePhysicalValueStorageRelease<
  E extends Record<string, unknown>
>(
  current: PhysicalValueStorage<E>,
  handles: readonly PhysicalValueHandle[]
): PhysicalValueStorage<E> {
  const seenSubjects = new Set<number>();
  for (const handle of handles) {
    if (seenSubjects.has(handle.subjectId)) {
      throw new Error(
        `Duplicate physical SubjectId ${String(handle.subjectId)}`
      );
    }
    seenSubjects.add(handle.subjectId);
    if (resolvePhysicalValue(current, handle) === undefined) {
      throw new Error(
        `Stale physical value handle for SubjectId ${String(handle.subjectId)}`
      );
    }
  }

  const subjects = [...current.subjects];
  const generations = [...current.generations];
  const values = [...current.values];
  const freeSlots = [...current.freeSlots];
  for (const handle of handles) {
    subjects[handle.slot] = undefined;
    values[handle.slot] = undefined;
    freeSlots.push(handle.slot);
  }
  return freezeStorage({ subjects, generations, values, freeSlots });
}

export function resolvePhysicalValue<E extends Record<string, unknown>>(
  pool: PhysicalValueStorage<E>,
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

function freezePool<E extends Record<string, unknown>>(
  pool: PhysicalValueStorage<E> & {
    handlesBySubject: Map<number, PhysicalValueHandle>;
  }
): PhysicalValuePool<E> {
  return Object.freeze({
    handlesBySubject: new ImmutableMapView(pool.handlesBySubject),
    subjects: pool.subjects,
    generations: pool.generations,
    values: pool.values,
    freeSlots: pool.freeSlots,
  });
}

function freezeStorage<E extends Record<string, unknown>>(storage: {
  subjects: (number | undefined)[];
  generations: number[];
  values: (E | undefined)[];
  freeSlots: number[];
}): PhysicalValueStorage<E> {
  return Object.freeze({
    subjects: Object.freeze(storage.subjects),
    generations: Object.freeze(storage.generations),
    values: Object.freeze(storage.values),
    freeSlots: Object.freeze(storage.freeSlots),
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
