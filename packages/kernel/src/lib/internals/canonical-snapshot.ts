import { materializeNode } from '../utils';
import { snapshotNodeKey } from './node-shape';

export interface CanonicalSnapshotOwner {
  readonly $: object;
}

/** Read the kernel-owned canonical whole-tree NaturalValue snapshot. */
export function readCanonicalSnapshotInternal<T>(
  owner: CanonicalSnapshotOwner
): T {
  return materializeNode<T>(snapshotNodeKey(owner.$));
}
