import type { EnhancerMeta, TreeCapability } from '../types';

const TREE_CAPABILITY_ORDER: readonly TreeCapability[] = [
  'mutation-capture',
  'position-topology',
  'causal-runtime',
  'temporal-snapshots',
];

const TREE_CAPABILITY_DEPENDENCIES: Record<
  TreeCapability,
  readonly TreeCapability[]
> = {
  'mutation-capture': [],
  'position-topology': [],
  'causal-runtime': ['mutation-capture', 'position-topology'],
  'temporal-snapshots': [],
};

export type ResolvedTreeCapabilities = {
  requestedCapabilities: readonly TreeCapability[];
  resolvedCapabilities: readonly TreeCapability[];
};

const canonicalizeCapabilities = (
  capabilities: Iterable<TreeCapability>
): readonly TreeCapability[] => {
  const set = new Set(capabilities);
  return TREE_CAPABILITY_ORDER.filter((capability) => set.has(capability));
};

export function collectRequestedTreeCapabilities(
  enhancerMeta: Iterable<EnhancerMeta | undefined>
): readonly TreeCapability[] {
  const requested = new Set<TreeCapability>();
  for (const meta of enhancerMeta) {
    for (const capability of meta?.capabilities ?? []) {
      requested.add(capability);
    }
  }

  return canonicalizeCapabilities(requested);
}

export function resolveTreeCapabilities(
  requestedCapabilities: Iterable<TreeCapability>
): ResolvedTreeCapabilities {
  assertTreeCapabilityGraphAcyclic();
  const requested = canonicalizeCapabilities(requestedCapabilities);
  const resolved = new Set<TreeCapability>(requested);
  const queue = [...requested];

  while (queue.length > 0) {
    const capability = queue.shift();
    if (!capability) {
      continue;
    }

    for (const dependency of TREE_CAPABILITY_DEPENDENCIES[capability]) {
      if (resolved.has(dependency)) {
        continue;
      }

      resolved.add(dependency);
      queue.push(dependency);
    }
  }

  return {
    requestedCapabilities: requested,
    resolvedCapabilities: canonicalizeCapabilities(resolved),
  };
}

export function assertTreeCapabilityGraphAcyclic(): void {
  const visiting = new Set<TreeCapability>();
  const visited = new Set<TreeCapability>();

  const visit = (capability: TreeCapability): void => {
    if (visited.has(capability)) {
      return;
    }

    if (visiting.has(capability)) {
      throw new Error(
        `SignalTree: capability dependency cycle detected at "${capability}".`
      );
    }

    visiting.add(capability);
    for (const dependency of TREE_CAPABILITY_DEPENDENCIES[capability]) {
      visit(dependency);
    }
    visiting.delete(capability);
    visited.add(capability);
  };

  for (const capability of TREE_CAPABILITY_ORDER) {
    visit(capability);
  }
}

const TREE_CAPABILITIES = Symbol.for('SignalTree:TreeCapabilities');

/**
 * @internal Record the capability set a tree was CONSTRUCTED with.
 *
 *     A CONSTRUCTION-TIME FACT, NOT AN OBSERVED BEHAVIOUR.
 *
 * ⚠️ WHY THIS EXISTS. `buildPlan` is local to `signalTree()` and never
 * retained, so nothing could ask a finished tree what it was built with. The
 * only alternative for a tool was to probe behaviour — write something and see
 * whether an observer fires — which cannot distinguish "this composition cannot
 * observe" from "nothing has happened yet". That is the same class of error as
 * inferring a semantic fact from a value's shape.
 *
 * Stores the plan's existing array by reference; no allocation.
 *
 * Deliberately GENERIC. Kernel truth about construction, not a consumer's
 * question — no `supportsX`-shaped accessor belongs here. A consumer translates
 * capabilities into its own capability model.
 */
export function defineTreeCapabilities(
  tree: object,
  capabilities: readonly TreeCapability[]
): void {
  Object.defineProperty(tree, TREE_CAPABILITIES, {
    value: capabilities,
    enumerable: false,
    configurable: true,
  });
}

/**
 * @internal The capabilities this tree was built with, or `undefined` when the
 * subject is not a tree.
 *
 * ⚠️ An EMPTY array is a meaningful answer — a bare tree — and must not be
 * conflated with `undefined`.
 */
export function getTreeCapabilities(
  tree: unknown
): readonly TreeCapability[] | undefined {
  if (typeof tree !== 'object' || tree === null) {
    return undefined;
  }
  return (tree as Record<symbol, readonly TreeCapability[] | undefined>)[
    TREE_CAPABILITIES
  ];
}
