import { type StudioTreeId } from '@signal-tree/studio-query';

import { type StudioCapability } from './capabilities';
import { StudioRequirementError } from './errors';
import { type ConfirmedTurnReader } from './kernel-contract';
import { disposeCapture } from './realization/lease';
import { dropRegistryIfEmpty, registryForAttach } from './registry';

/**
 * How the adapter reaches a tree's kernel facts.
 *
 * ⚠️ AN ADAPTER IMPLEMENTATION DETAIL, NOT A PRODUCT API. Application code
 * calls `attachStudio(tree, ...)` and never constructs one of these;
 * `probeSignalTree` derives it. Kept as a seam because it lets most adapter
 * tests run without building real trees, and isolates the adapter from kernel
 * internals moving.
 */
export interface StudioTreeProbe {
  /** Opaque runtime identity — equality/Map-key only, never serialized. */
  readonly runtimeTreeId: unknown;
  /** `undefined` when the tree has no transactions() enhancer. */
  readonly confirmedTurnReader: ConfirmedTurnReader | undefined;
  /** Called with an eviction callback; returns nothing. */
  readonly onDestroy?: (evict: () => void) => void;
  /** Construction-time capabilities, for structural support decisions. */
  readonly structure?: { readonly capabilities: readonly string[] | undefined };
  /** Build a realization capture target for this tree, if it is one. */
  readonly createCaptureTarget?: () => unknown;
  /** The value at `path` right now — compared against retained evidence. */
  readonly readCurrentValue?: (path: string) => unknown;
  /** Key structure for the state pane. Never values. */
  readonly readStateShape?: (options: { maxDepth?: number; maxKeys?: number }) => unknown;
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

export function attachStudioProbe(
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

  // The registry — and therefore the session id — is touched only AFTER every
  // `require` check has passed. Repeated bad wiring must not advance the
  // observable session id sequence for trees that never entered Studio.
  const registry = registryForAttach();
  const id = registry.add(probe.runtimeTreeId, {
    label: options.label,
    reader: probe.confirmedTurnReader,
    capabilities,
    structure: probe.structure,
    createCaptureTarget: probe.createCaptureTarget,
    readCurrentValue: probe.readCurrentValue,
    readStateShape: probe.readStateShape,
  });

  let detached = false;
  const detach = () => {
    if (detached) {
      return;
    }
    detached = true;
    // ⚠️ RELEASE THE OBSERVER BEFORE DELISTING THE TREE.
    //
    //     STUDIO MUST NOT KEEP CHARGING WRITES FOR A TREE IT HAS STOPPED
    //     PRESENTING.
    //
    // Capture was bridge-driven and the registry knew nothing about it, so
    // detaching removed the attachment and left the process-global write
    // observer installed and retaining evidence — with the tree no longer
    // listed, nothing could ever stop it. Destruction reached the same state by
    // the other route: `probe.onDestroy` calls this.
    //
    // Not the panel's job. Detach and destroy are not user actions, so
    // "press Stop first" is not a mechanism. Idempotent, and a no-op for the
    // overwhelmingly common attached-but-never-captured tree.
    disposeCapture(id);
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
