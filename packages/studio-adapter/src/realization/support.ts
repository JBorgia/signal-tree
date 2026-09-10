import { type RealizationSupport } from './types';

/**
 * Structural facts the adapter needs from the kernel. Injected so this stays
 * testable and so no consumer-shaped predicate leaks into the kernel.
 */
export interface TreeStructure {
  /** Capabilities the tree was CONSTRUCTED with. `undefined` = not a tree. */
  readonly capabilities: readonly string[] | undefined;
}

/**
 * Can this tree composition provide COMPLETE realization observation?
 *
 *     DECIDED STRUCTURALLY, NEVER BY PROBING BEHAVIOUR.
 *
 * ⚠️ Probing — write something and see whether an observer fires — cannot
 * distinguish "this composition cannot observe" from "nothing has happened
 * yet". The capture lease must know synchronously, before it installs anything.
 *
 * The predicate is `causal-runtime`, verified rather than assumed
 * (`LEAF-OBSERVATION-SUPPORT-0`): bare and `batching()` are unobservable;
 * `transactions()`, `restoration()` and a direct `capabilities:
 * ['causal-runtime']` request are all observable. That last case is why the
 * capability is the predicate and "an enhancer is attached" is not — leaf
 * interception is installed by the capability's machinery, not by a name.
 */
export function realizationSupport(structure: TreeStructure): RealizationSupport {
  const capabilities = structure.capabilities;

  if (!capabilities?.includes('causal-runtime')) {
    // S2-11: support less and refuse loudly. Some entity effects would be
    // observable here, but exposing partial coverage while silently missing
    // scalar leaves is the partial-history trap.
    return { state: 'unsupported', reason: 'leaf-observation-unavailable' };
  }

  return { state: 'supported', capture: 'inactive' };
}
