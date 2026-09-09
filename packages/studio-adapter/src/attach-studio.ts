import {
  attachStudioProbe,
  type AttachStudioOptions,
  type StudioAttachment,
} from './attach-studio-probe';
import { probeSignalTree, type StudioAttachableTree } from './probe-signal-tree';

/**
 * Attach a SignalTree to Studio. Development-only, explicit, opt-in.
 *
 * ```ts
 * const { detach } = attachStudio(appTree, { label: 'AppTree' });
 * ```
 *
 * This is the whole public experience. Callers do not build probes, do not see
 * `TreeId`, and do not wire destruction — the tree's own cleanup evicts the
 * attachment.
 *
 * ⚠️ NOTHING EXISTS UNTIL THIS IS CALLED. No registry, no bridge, no listeners.
 * A production build that never calls this has no Studio surface to reach,
 * which is the security boundary the whole design rests on — not a disabled
 * flag, an absent mechanism.
 */
export function attachStudio(
  tree: StudioAttachableTree,
  options: AttachStudioOptions = {}
): StudioAttachment {
  return attachStudioProbe(probeSignalTree(tree), options);
}
