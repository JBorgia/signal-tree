import type {
  CollectionAddEffect,
  CollectionRemoveEffect,
  CollectionRekeyEffect,
} from './transactions';

type OccupancyEffect =
  | CollectionAddEffect
  | CollectionRemoveEffect
  | CollectionRekeyEffect;

/** Capture-interval facts. A canceled endpoint is retained until the interval
 * drains: a later rebind must still use the interval's original before-image. */
export interface OccupancyComposition {
  readonly first: OccupancyEffect;
  readonly beforeKey: string | number | undefined;
  readonly afterKey: string | number | undefined;
  readonly removal?: CollectionRemoveEffect;
  readonly latestRemoval?: CollectionRemoveEffect;
  readonly addition?: CollectionAddEffect;
}

/** Pure and bounded to one touched lifetime; safe to stage before installation.
 * Values and authored ordering have their own capture channels. These contexts
 * supply only the add/remove images required by the normalized occupancy fact. */
export function composeOccupancy(
  previous: OccupancyComposition | undefined,
  effect: OccupancyEffect
): OccupancyComposition {
  const before =
    effect.kind === 'add'
      ? undefined
      : effect.kind === 'remove'
      ? effect.key
      : effect.beforeKey;
  const after =
    effect.kind === 'remove'
      ? undefined
      : effect.kind === 'add'
      ? effect.key
      : effect.afterKey;
  if (previous && !Object.is(previous.afterKey, before)) {
    throw new Error('Discontinuous ordinary occupancy capture');
  }
  return {
    first: previous?.first ?? effect,
    beforeKey: previous ? previous.beforeKey : before,
    afterKey: after,
    removal:
      previous?.removal ?? (effect.kind === 'remove' ? effect : undefined),
    latestRemoval: effect.kind === 'remove' ? effect : previous?.latestRemoval,
    addition: effect.kind === 'add' ? effect : previous?.addition,
  };
}

export function occupancyEffect(
  state: OccupancyComposition
): OccupancyEffect | undefined {
  if (Object.is(state.beforeKey, state.afterKey)) return undefined;
  const { ownerPath, position, path, subject } = state.first;
  if (state.beforeKey === undefined) {
    if (!state.addition || state.afterKey === undefined)
      throw new Error('Missing ordinary addition context');
    return { ...state.addition, key: state.afterKey };
  }
  if (state.afterKey === undefined) {
    if (!state.removal) throw new Error('Missing ordinary removal context');
    return { ...state.removal, key: state.beforeKey };
  }
  return {
    kind: 'rekey',
    ownerPath,
    position,
    path,
    subject,
    beforeKey: state.beforeKey,
    afterKey: state.afterKey,
  };
}
