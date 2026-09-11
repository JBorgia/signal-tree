import { readCanonicalSnapshot } from '@signal-tree/kernel/adapter';
import { type CapturedValue } from '@signal-tree/studio-query';
import { captureBoundedValue } from './bounded-value';

/**
 * The value at `path` in this tree **right now**.
 *
 *     THE PANEL MUST COMPARE AGAINST REALITY, NOT AGAINST ITS OWN HISTORY.
 *
 * ⚠️ WHY THIS EXISTS. Without it the Why? panel is tempted to treat
 * `latestRealization.after` as the current value — which would silently destroy
 * `currentValueExplained`, the warning that says retained evidence does NOT
 * explain what is on screen. That warning is only worth having if it is
 * computed against the live tree.
 *
 * ⚠️ NOT an `evalPath()` and not a string-expression evaluator. It reads the
 * canonical snapshot and walks it by the kernel's OWN path decomposition —
 * `applyAtRelativePath` splits on `'.'`, so this is the existing convention
 * rather than a new one.
 *
 * Cost note: this materializes a whole-tree snapshot to read one location. That
 * is acceptable for a diagnostic read on user action; it must not be put on any
 * hot path.
 */
export function readCurrentValue(
  tree: { readonly $: object },
  path: string
): CapturedValue {
  return readCurrentValues(tree, [path])[0]!.value;
}

export interface CurrentValueEntry {
  readonly path: string;
  readonly value: CapturedValue;
}

/** One canonical snapshot per batch. Returned values share a 2 MiB accounting budget,
 * with 64 KiB / 2048 visits per value. Snapshot materialization itself is not bounded. */
export function readCurrentValues(
  tree: { readonly $: object },
  paths: readonly string[]
): readonly CurrentValueEntry[] {
  if (paths.length > 200 || paths.some((path) => typeof path !== 'string')) {
    throw new RangeError(
      'Current-value reads require at most 200 string paths'
    );
  }
  if (paths.length === 0) return [];
  let snapshot: unknown;
  try {
    snapshot = readCanonicalSnapshot(tree);
  } catch (cause) {
    return paths.map((path) => ({
      path,
      value: {
        kind: 'unserializable',
        valueType: 'snapshot-failed',
        preview: String((cause as Error)?.message ?? cause),
      },
    }));
  }
  let remaining = 2 * 1024 * 1024;
  return paths.map((path) => {
    const result = valueAtSnapshotPath(
      snapshot,
      path,
      Math.min(64 * 1024, remaining)
    );
    remaining = Math.max(0, remaining - result.bytes);
    return { path, value: result.value };
  });
}

function valueAtSnapshotPath(
  node: unknown,
  path: string,
  limit: number
): { value: CapturedValue; bytes: number } {
  // Supported addresses are nonempty dot-separated own keys (including array
  // indices). There is no escaping grammar. A literal dotted key must never
  // be silently confused with nested state sharing the same display address.
  const segments = path.split('.');
  if (
    path.length > 2048 ||
    segments.length > 32 ||
    segments.some((segment) => segment.length === 0)
  ) {
    return {
      value: {
        kind: 'unserializable',
        valueType: 'unsupported-path',
        preview:
          'Studio paths require 1–32 nonempty dot-separated own keys (maximum 2048 characters).',
      },
      bytes: 256,
    };
  }
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!;
    if (node !== null && typeof node === 'object') {
      for (let end = index + 2; end <= segments.length; end++) {
        if (
          Object.prototype.hasOwnProperty.call(
            node,
            segments.slice(index, end).join('.')
          )
        ) {
          return {
            value: {
              kind: 'unserializable',
              valueType: 'ambiguous-path',
              preview:
                'A literal dotted key conflicts with this dot-separated address. Studio cannot identify this location unambiguously.',
            },
            bytes: 256,
          };
        }
      }
    }
    // ⚠️ KEY PRESENCE, NOT VALUE SHAPE.
    //
    //     `undefined` IS A LEGITIMATE SIGNALTREE VALUE.
    //
    // Reading the segment and testing the RESULT cannot tell `{ total:
    // undefined }` from a tree with no `total` at all — and this function's
    // whole job is to say truthfully what is at a location. An earlier version
    // guarded only that the CONTAINER was an object, which caught a broken
    // intermediate segment but let a missing FINAL segment through: asking for
    // `cart.nope` answered `{ kind: 'value', value: undefined }`, presenting
    // absence as a value. Verified in a real browser before it shipped.
    if (
      node === null ||
      typeof node !== 'object' ||
      !Object.prototype.hasOwnProperty.call(node, segment)
    ) {
      return {
        value: {
          kind: 'unserializable',
          valueType: 'unresolved-path',
          preview: path,
        },
        bytes: 256,
      };
    }
    const descriptor = Object.getOwnPropertyDescriptor(node, segment)!;
    if (!('value' in descriptor))
      return {
        value: {
          kind: 'unserializable',
          valueType: 'unread-accessor',
          preview:
            'Studio does not invoke property accessors while resolving a path.',
        },
        bytes: 256,
      };
    node = descriptor.value;
  }

  // Clone only the selected value, using the same bounded representation as history.
  return captureBoundedValue(node, limit);
}
