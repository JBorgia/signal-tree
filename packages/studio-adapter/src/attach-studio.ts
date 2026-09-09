import { type StudioTreeId } from '@signal-tree/studio-query';

import { type StudioCapability } from './capabilities';
import { StudioRequirementError } from './errors';
import { type ConfirmedTurnReader } from './kernel-contract';
import { dropRegistryIfEmpty, registryForAttach } from './registry';

/**
 * How the adapter reaches a tree's kernel facts. Injected rather than imported
 * so this package does not hard-depend on a kernel entry point, and so tests
 * can drive attachment without building a real tree.
 */
export interface StudioTreeProbe {
  /** Opaque runtime identity — equality/Map-key only, never serialized. */
  readonly runtimeTreeId: unknown;
  /** `undefined` when the tree has no transactions() enhancer. */
  readonly confirmedTurnReader: ConfirmedTurnReader | undefined;
  /** Called with an eviction callback; returns nothing. */
  readonly onDestroy?: (evict: () => void) => void;
}

export interface AttachStudioOptions {
  /** Presentation only. Never identity, never a key; trees may share one. */
  readonly label?: string;
  /**
   * Declare capabilities this attachment REQUIRES.
   *
   * ⚠️ Only this form may throw. A plain `attachStudio` succeeds for any tree
   * and reports missing capabilities through `listTrees`, because capability is
   * a property of the tree's enhancer composition and not a precondition for
   * being inspectable — see S1-BRIDGE-SPEC §1.
   */
  readonly require?: readonly StudioCapability[];
}

export interface StudioAttachment {
  readonly id: StudioTreeId;
  readonly capabilities: readonly StudioCapability[];
  /** Idempotent. */
  readonly detach: () => void;
}

export function attachStudio(
  probe: StudioTreeProbe,
  options: AttachStudioOptions = {}
): StudioAttachment {
  const capabilities: StudioCapability[] = [];
  if (probe.confirmedTurnReader) {
    capabilities.push('committed-transactions');
  }

  const missing = (options.require ?? []).filter(
    (required) => !capabilities.includes(required)
  );
  if (missing.length > 0) {
    // The caller declared an expectation; a development-time wiring mistake.
    // Nothing is registered, so a failed require leaves no Studio state behind.
    throw new StudioRequirementError(missing);
  }

  const registry = registryForAttach();
  const id = registry.add(probe.runtimeTreeId, {
    label: options.label,
    reader: probe.confirmedTurnReader,
    capabilities,
  });

  let detached = false;
  const detach = () => {
    if (detached) {
      return;
    }
    detached = true;
    registry.remove(id);
    // Last one out drops the registry, so "nothing attached" and "never
    // attached" are the same observable state.
    dropRegistryIfEmpty();
  };

  // Destruction evicts automatically — a destroyed tree must stop being listed
  // rather than lingering as an entry whose reader throws.
  probe.onDestroy?.(detach);

  return { id, capabilities, detach };
}
