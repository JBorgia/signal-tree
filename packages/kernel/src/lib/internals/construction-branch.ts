import { isLeafDefinition } from '../leaf';
import { isRegisteredMarker } from './materialize-markers';
import { isBuiltInObject } from './utilities/is-built-in-object';

/** The same terminal boundaries used by ordinary tree construction. */
export function isConstructionBranch(value: unknown): value is object {
  return (
    value !== null &&
    typeof value === 'object' &&
    !isLeafDefinition(value) &&
    (value as Record<string, unknown>)['__isEntityMap'] !== true &&
    !isRegisteredMarker(value) &&
    !Array.isArray(value) &&
    !isBuiltInObject(value)
  );
}
