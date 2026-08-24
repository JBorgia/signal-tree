import type { PositionId } from '../types';
import { isTraversableNode } from './node-shape';

const POSITION_REGISTRY_SYMBOL = Symbol.for('SignalTree:PositionRegistry');

export interface PositionRegistry {
  /**
   * Process-unique identity for this registry's NAMESPACE.
   *
   * `positionId` means "position N in THIS registry" — it is allocated from 1
   * per registry, so two trees both call their first leaf 2. Every consumer of
   * position ids is tree-scoped and correct with that; the PROCESS-GLOBAL path
   * notifier was not, and coalesced two trees' writes into one
   * (NOTIFIER-SCOPE-0).
   *
   * The namespace is NAMED rather than eliminated. Making position ids globally
   * unique would have repaired the notifier by redefining what the identifier
   * means for the other 24 consumers, and would still leave a location unable
   * to say which tree owns it — which A2-3 independently needs.
   */
  readonly id: number;
  allocate(parent?: PositionId): PositionId;
  parentOf(position: PositionId): PositionId | undefined;
  contains(authority: PositionId, participant: PositionId): boolean;
}

let nextRegistryId = 1;

class TreePositionRegistry implements PositionRegistry {
  readonly id = nextRegistryId++;
  private nextPositionId = 1;
  private parents = new Map<PositionId, PositionId | undefined>();

  allocate(parent?: PositionId): PositionId {
    const positionId = this.nextPositionId++ as PositionId;
    this.parents.set(positionId, parent);
    return positionId;
  }

  parentOf(position: PositionId): PositionId | undefined {
    return this.parents.get(position);
  }

  contains(authority: PositionId, participant: PositionId): boolean {
    if (authority === participant) {
      return true;
    }

    const seen = new Set<PositionId>();
    let current: PositionId | undefined = participant;
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      const parent = this.parentOf(current);
      if (parent === authority) {
        return true;
      }
      current = parent;
    }

    return false;
  }
}

export function createPositionRegistry(): PositionRegistry {
  return new TreePositionRegistry();
}

export function definePositionRegistry(
  node: object,
  registry: PositionRegistry
): void {
  Object.defineProperty(node, POSITION_REGISTRY_SYMBOL, {
    value: registry,
    enumerable: false,
    configurable: true,
  });
}

export function getPositionRegistry(
  node: unknown
): PositionRegistry | undefined {
  if (!isTraversableNode(node)) {
    return undefined;
  }

  return (node as Record<symbol, PositionRegistry | undefined>)[
    POSITION_REGISTRY_SYMBOL
  ];
}
