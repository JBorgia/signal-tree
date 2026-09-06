import { markTreeCell } from './cell-identity';
import type { Location, ReadonlyLocation } from './cell-runtime';
import {
  getIntrinsicMutationObserver,
  registerIntrinsicMutationSource,
} from './intrinsic-mutation';
import {
  registerWritableLocationBinding,
  type LocationPublisher,
  type LocationRuntime,
  type WritableLocationBinding,
} from './location-runtime';
import type { ObservationAdapter } from './observation-adapter';

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
    write: (value: T, intent: 'replace' | 'derive') => boolean
  ): WritableLocationBinding<T> => {
    const realized = observation.createWritableCell?.(read);
    if (!realized)
      throw new Error('Expected a native writable cell realization');

    const location = markTreeCell(realized.cell as unknown as Location<T>);
    registerIntrinsicMutationSource(location as object);
    const binding: WritableLocationBinding<T> = {
      location,
      notify: () => realized.token.invalidate(),
      replace: (next) => {
        const observer = getIntrinsicMutationObserver<T>(location as object);
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
        const observer = getIntrinsicMutationObserver<T>(location as object);
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
      }
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
    registerIntrinsicMutationSource(location as object);
    const binding: WritableLocationBinding<T> = {
      location,
      notify: () => undefined,
      replace: (value) => {
        const observer = getIntrinsicMutationObserver<T>(location as object);
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
        const observer = getIntrinsicMutationObserver<T>(location as object);
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

  return {
    createCell,
    createDerived,
    createWritable,
    createWritableProjection,
    publish,
    runInvalidationGroup,
  };
}
