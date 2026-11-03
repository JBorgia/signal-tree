import { isTraversableNode } from './node-shape';

/** Collection-owned physical preparation read; not a public collection API. */
type EntityPreparationReader = (key: string | number) => unknown;
const READER = Symbol('signaltree.entityPreparationReader');

export function defineEntityPreparationReader(
  api: object,
  reader: EntityPreparationReader
): void {
  Object.defineProperty(api, READER, {
    value: reader,
    enumerable: false,
    configurable: true,
  });
}

export function getEntityPreparationReader(
  node: unknown
): EntityPreparationReader | undefined {
  if (!isTraversableNode(node)) {
    return undefined;
  }
  const reader = (node as Record<symbol, unknown>)[READER];
  return typeof reader === 'function'
    ? (reader as EntityPreparationReader)
    : undefined;
}
