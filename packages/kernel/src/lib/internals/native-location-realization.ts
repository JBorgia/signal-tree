import { markTreeCell } from './cell-identity';
import type {
  Location,
  ReadonlyLocation,
  WritableCell,
} from './cell-runtime';
import {
  registerIntrinsicMutationSource,
  unobservableMutationSource,
} from './intrinsic-mutation';
import {
  registerWritableLocationBinding,
  type LocationPublisher,
  type LocationRuntime,
  type WritableLocationBinding,
} from './location-runtime';
import type {
  EpochHandle,
  ObservationAdapter,
} from './observation-adapter';

export function createNativeLocationRuntime(
  observation: ObservationAdapter
): LocationRuntime {
  let invalidationGroupDepth = 0;
  const groupedPublishers = new Set<LocationPublisher>();

  const deliver = (publishers: readonly LocationPublisher[]): void => {
    const errors: unknown[] = [];
    observation.runInvalidationGroup(() => {
      for (const publisher of publishers) {
        try {
          publisher.notify();
        } catch (error) {
          errors.push(error);
        }
      }
    });
    if (errors.length > 0) throw errors[0];
  };

  const publish = (publishers: readonly LocationPublisher[]): void => {
    if (invalidationGroupDepth > 0) {
      for (const publisher of publishers) groupedPublishers.add(publisher);
      return;
    }
    deliver(publishers);
  };

  const runInvalidationGroup = (run: () => void): void => {
    observation.runInvalidationGroup(() => {
      let failure: unknown;
      let hasFailure = false;
      invalidationGroupDepth += 1;
      try {
        run();
      } catch (error) {
        failure = error;
        hasFailure = true;
      } finally {
        invalidationGroupDepth -= 1;
        if (invalidationGroupDepth === 0 && groupedPublishers.size > 0) {
          const publishers = [...groupedPublishers];
          groupedPublishers.clear();
          try {
            deliver(publishers);
          } catch (error) {
            if (!hasFailure) {
              failure = error;
              hasFailure = true;
            }
          }
        }
      }
      if (hasFailure) throw failure;
    });
  };

  const createWritable = <T>(
    read: () => T,
    write: (value: T, intent: 'replace' | 'derive') => boolean,
    /**
     * `SUBJECT-STATE-MINIMAL-0`. Pass false for a cell no caller can reach and
     * therefore no caller can observe — see `unobservableMutationSource`.
     */
    observable = true
  ): WritableLocationBinding<T> => {
    const realized = observation.createWritableCell?.(read);
    if (!realized)
      throw new Error('Expected a native writable cell realization');

    const location = markTreeCell(realized.cell as unknown as Location<T>);
    const mutationSource1 = observable
      ? registerIntrinsicMutationSource<T>(location as object)
      : unobservableMutationSource<T>();
    const binding: WritableLocationBinding<T> = {
      location,
      notify: () => realized.token.invalidate(),
      replace: (next) => {
        const observer = mutationSource1.observer;
        const before = observer ? realized.peek() : undefined;
        const changed = write(next, 'replace');
        if (observer) {
          observer({
            intent: 'replace',
            before: before as T,
            after: changed ? next : (before as T),
            changed,
          });
        }
        if (changed) publish([binding]);
      },
      derive: (update) => {
        const before = realized.peek();
        const next = update(before);
        const changed = write(next, 'derive');
        const observer = mutationSource1.observer;
        if (observer) {
          observer({
            intent: 'derive',
            before,
            after: changed ? next : before,
            changed,
          });
        }
        if (changed) publish([binding]);
      },
    };
    registerWritableLocationBinding(binding);
    realized.cell.set = binding.replace;
    realized.cell.update = binding.derive;
    return binding;
  };

  const createCell = <T>(
    initial: T,
    equal: (left: T, right: T) => boolean = Object.is
  ): Location<T> => {
    let value = initial;
    return createWritable(
      () => value,
      (next) => {
        if (equal(value, next)) return false;
        value = next;
        return true;
      },
      false
    ).location;
  };

  const createWritableProjection = <T>(
    compute: () => T,
    write: (value: T, intent: 'replace' | 'derive') => void
  ): Location<T> => {
    const realized = observation.createWritableProjection?.(compute);
    if (!realized) {
      throw new Error('Expected a native writable projection realization');
    }

    const location = markTreeCell(realized.cell as unknown as Location<T>);
    const mutationSource2 = registerIntrinsicMutationSource<T>(
      location as object
    );
    const binding: WritableLocationBinding<T> = {
      location,
      notify: () => undefined,
      replace: (value) => {
        const observer = mutationSource2.observer;
        const before = observer ? realized.peek() : undefined;
        write(value, 'replace');
        if (observer) {
          const after = realized.peek();
          observer({
            intent: 'replace',
            before: before as T,
            after,
            changed: !Object.is(before, after),
          });
        }
      },
      derive: (update) => {
        const before = realized.peek();
        write(update(before), 'derive');
        const observer = mutationSource2.observer;
        if (observer) {
          const after = realized.peek();
          observer({
            intent: 'derive',
            before,
            after,
            changed: !Object.is(before, after),
          });
        }
      },
    };
    registerWritableLocationBinding(binding);
    realized.cell.set = binding.replace;
    realized.cell.update = binding.derive;
    return location;
  };

  const createDerived = <T>(compute: () => T): ReadonlyLocation<T> => {
    const native = observation.createReadonlyCell?.(compute);
    if (!native) throw new Error('Expected a native readonly cell realization');
    return markTreeCell(native as unknown as ReadonlyLocation<T>);
  };

  /**
   * `SUBJECT-EPOCH-0`. A stable reactive anchor: call it to depend, `update` to
   * invalidate everyone who did.
   *
   * The first version returned `realized.cell` directly, to save the 192 B/entity
   * that a wrapper costs. That was WRONG, and wrong in a way that shipped:
   *
   * An adapter's raw cell is NOT writable on its own. The kernel is what makes
   * it writable, by assigning `cell.set = binding.replace` in `createWritable`.
   * Angular's cell happens to be a real `WritableSignal`, so calling `.update()`
   * on it worked by accident. Vue's `createWritableCell` ships
   * `cell.set = () => undefined` as a placeholder for the kernel to replace —
   * so on Vue the epoch never advanced, and entity invalidation was silently
   * dead. One Vue test caught it; nothing in the kernel or Angular suites could.
   *
   * The portable contract is the TOKEN, not the cell: `token.observe()` to
   * depend and `token.invalidate()` to publish, which every adapter implements
   * because the rest of the runtime already depends on it. Routing the advance
   * through `publish` also puts the epoch back inside invalidation grouping,
   * which returning the bare cell had opted it out of.
   */
  /**
   * `ANGULAR-NATIVE-EPOCH-0`. Prefer the framework's own epoch primitive when
   * the adapter supplies the create/advance PAIR; otherwise build a portable
   * one on `createToken`.
   *
   * The pair matters: the kernel never writes to an adapter-owned handle — the
   * adapter that created it advances it — so the assumption that silently
   * killed Vue's entity invalidation cannot be made here.
   */
  const nativeEpochs = Boolean(
    observation.createEpoch && observation.advanceEpoch
  );

  /**
   * ONE publisher for every epoch in this runtime, not one per subject.
   *
   * Per-epoch allocation is the entire economics here: a bare Angular signal is
   * 562 B/entity and any wrapper around it costs ~190 B more. Staging handles
   * in a shared set and publishing a single shared publisher keeps grouping
   * intact — `publish` dedupes it, and a group flush drains every pending
   * advance at once — while allocating nothing per subject beyond the
   * framework's own primitive.
   */
  const pendingEpochs = new Set<EpochHandle>();

  const advanceHandle = (handle: EpochHandle): void => {
    if (nativeEpochs) {
      observation.advanceEpoch?.(handle);
      return;
    }
    // A handle WE built, so updating it is not an assumption about an
    // adapter's cell.
    (handle as unknown as WritableCell<number>).update((v) => v + 1);
  };

  const epochPublisher: LocationPublisher = {
    notify: () => {
      if (pendingEpochs.size === 0) return;
      const draining = [...pendingEpochs];
      pendingEpochs.clear();
      for (const handle of draining) advanceHandle(handle);
    },
  };

  const createEpoch = (): EpochHandle => {
    if (nativeEpochs) return observation.createEpoch?.() as EpochHandle;
    let version = 0;
    const token = observation.createToken();
    const epoch = (() => {
      token.observe();
      return version;
    }) as WritableCell<number>;
    epoch.set = (next: number) => {
      version = next;
      token.invalidate();
    };
    epoch.update = (fn: (current: number) => number) => epoch.set(fn(version));
    epoch.asReadonly = () => epoch;
    return epoch as unknown as EpochHandle;
  };

  /** Stage an advance; grouping decides when it lands. */
  const advanceEpoch = (handle: EpochHandle): void => {
    pendingEpochs.add(handle);
    publish([epochPublisher]);
  };


  return {
    createCell,
    createEpoch,
    advanceEpoch,
    createDerived,
    createWritable,
    createWritableProjection,
    publish,
    runInvalidationGroup,
  };
}
