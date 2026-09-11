import { readCanonicalSnapshot } from '@signal-tree/kernel/adapter';

/**
 * The SHAPE of a tree's state — keys and nesting, no values.
 *
 *     THE STATE PANE MUST SHOW THE STATE, NOT THE EVIDENCE.
 *
 * ⚠️ WHY THIS EXISTS AT ALL. The panel previously offered paths derived from
 * retained evidence, which is fine as a shortcut list and WRONG as a state
 * tree: it shows only locations something already happened to, so a location
 * nobody has written appears not to exist. Presenting that as "STATE" would be
 * the partial-history trap in a new costume.
 *
 * ⚠️ NO VALUES CROSS THE BRIDGE HERE. The pane needs names; values are read
 * per-path, on demand, by `readCurrentValue`. Sending a whole tree's values to
 * populate a sidebar would put arbitrary application data on the transport for
 * a UI that never displays it.
 *
 * Bounded, and it SAYS SO. A branch cut by a limit is marked `truncated`, never
 * emitted as a leaf — a truncated branch rendered as a leaf is a false claim
 * that the state ends there.
 */

export type StateNodeKind = 'branch' | 'leaf';

export interface StateNode {
  readonly key: string;
  /** Dot path, the same convention `readCurrentValue` consumes. */
  readonly path: string;
  readonly kind: StateNodeKind;
  readonly children?: readonly StateNode[];
  /** Present only on a branch this read did not fully enumerate. */
  readonly truncated?: 'depth' | 'breadth';
}

export interface StateShape {
  readonly nodes: readonly StateNode[];
  /** Whether anything anywhere was cut. Surfaced, not footnoted. */
  readonly truncated: boolean;
}

export type StateShapeResult =
  | { readonly ok: true; readonly shape: StateShape }
  | { readonly ok: false; readonly reason: string };

export interface StateShapeOptions {
  readonly maxDepth?: number;
  readonly maxKeys?: number;
}

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MAX_KEYS = 200;

function isBranch(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  // Dates, Maps, Sets and friends are single values to a state pane, not
  // namespaces to descend into. Only plain objects and arrays have paths
  // `readCurrentValue` can resolve by key.
  if (Array.isArray(value)) {
    return true;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function readStateShape(
  tree: { readonly $: object },
  options: StateShapeOptions = {}
): StateShapeResult {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxKeys = options.maxKeys ?? DEFAULT_MAX_KEYS;
  if (
    !Number.isInteger(maxDepth) ||
    maxDepth < 1 ||
    maxDepth > 32 ||
    !Number.isInteger(maxKeys) ||
    maxKeys < 1 ||
    maxKeys > 1000
  ) {
    return {
      ok: false,
      reason: 'Shape limits require maxDepth 1–32 and maxKeys 1–1000 integers',
    };
  }

  let root: unknown;
  try {
    root = readCanonicalSnapshot(tree);
  } catch (cause) {
    return { ok: false, reason: String((cause as Error)?.message ?? cause) };
  }
  if (!isBranch(root)) {
    return { ok: true, shape: { nodes: [], truncated: false } };
  }

  let addressError: string | undefined;
  let truncated = false;
  let remainingNodes = 2000; // Global output ceiling, independent of branching factor.

  const walk = (value: object, prefix: string, depth: number): StateNode[] => {
    const keys = Object.keys(value);
    // The bridge and kernel use dotted paths without an escape syntax. Refuse
    // this view instead of emitting two identical canvas addresses or hiding
    // a literal key while pretending the structure is complete.
    if (keys.some((key) => key.length === 0 || key.includes('.'))) {
      addressError =
        'State shape unavailable: literal dotted or empty keys cannot be represented unambiguously by Studio dot-separated paths.';
      return [];
    }
    const shown = keys.slice(0, maxKeys);
    if (shown.length < keys.length) {
      truncated = true;
    }

    const nodes: StateNode[] = [];
    for (const key of shown) {
      if (remainingNodes === 0) {
        truncated = true;
        break;
      }
      remainingNodes--;
      const path = prefix ? `${prefix}.${key}` : key;
      if (path.length > 2048) {
        addressError =
          'State shape unavailable: a path exceeds the 2048-character address limit.';
        return [];
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in descriptor)) {
        addressError =
          'State shape unavailable: accessor properties cannot be safely enumerated.';
        return [];
      }
      const child = descriptor.value;
      if (!isBranch(child)) {
        nodes.push({ key, path, kind: 'leaf' });
      } else if (depth + 1 >= maxDepth) {
        truncated = true;
        nodes.push({ key, path, kind: 'branch', truncated: 'depth' });
      } else {
        const children = walk(child as object, path, depth + 1);
        const total = Object.keys(child as object).length;
        nodes.push(
          children.length < total
            ? { key, path, kind: 'branch', children, truncated: 'breadth' }
            : { key, path, kind: 'branch', children }
        );
      }
    }
    return nodes;
  };

  const nodes = walk(root as object, '', 0);
  if (addressError) return { ok: false, reason: addressError };
  return { ok: true, shape: { nodes, truncated } };
}
