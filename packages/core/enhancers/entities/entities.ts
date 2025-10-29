import { createSignal } from '../../src/lib/signal-tree';

import type { ISignal } from '../../src/lib/types';
export interface EntityMap<T> {
  byId: Record<string, T>;
  allIds: string[];
}

export function createEntitySignal<T>(name?: string): ISignal<EntityMap<T>> {
  return createSignal<EntityMap<T>>({ byId: {}, allIds: [] }, { name });
}
