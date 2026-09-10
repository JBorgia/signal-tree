import { REALIZATION_CAPABILITY } from '../capabilities';
import { peekRegistry } from '../registry';
import { realizationSupport } from '../realization/support';
import {
  disposeCapture,
  peekCapture,
  startRealizationCapture,
  StudioCaptureError,
  type CaptureTarget,
} from '../realization/lease';
import { type RealizationReadResult } from '../realization/types';
import {
  STUDIO_PROTOCOL_VERSION,
  STUDIO_SCHEMA_VERSION,
  type StudioBridgeRequest,
  type StudioBridgeResponse,
} from './protocol';

/**
 * The whole bridge, minus transport.
 *
 *     THE TRANSPORT IS DUMB SERIALIZATION.
 *
 * It never touches a kernel tree, never sees `TreeId`, never wires destruction
 * and never infers a capability — the registry already did all of that. This
 * function is deliberately environment-neutral and directly testable without a
 * DOM, a port, or a browser.
 */
export function handleStudioRequest(
  request: StudioBridgeRequest
): StudioBridgeResponse {
  const envelope = { protocol: STUDIO_PROTOCOL_VERSION, id: request.id } as const;

  if (request.protocol !== STUDIO_PROTOCOL_VERSION) {
    return {
      ...envelope,
      ok: false,
      error: {
        code: 'STUDIO_PROTOCOL_MISMATCH',
        expected: STUDIO_PROTOCOL_VERSION,
        received: request.protocol,
      },
    };
  }

  switch (request.command) {
    case 'hello':
      // Version negotiation only. Capability belongs to a TREE, not to the
      // handshake — two trees in one application can differ.
      return {
        ...envelope,
        ok: true,
        value: { protocol: STUDIO_PROTOCOL_VERSION, schema: STUDIO_SCHEMA_VERSION },
      };

    case 'listTrees':
      // A dropped registry means zero attached trees — a meaningful answer, not
      // an error. "Studio installed, nothing attached" and "no Studio at all"
      // must stay distinguishable (S1-BRIDGE-SPEC §4.2).
      return { ...envelope, ok: true, value: peekRegistry()?.listTrees() ?? [] };

    /**
     * ⚠️ Instrumentation control, not application mutation. Recording never
     * starts merely because DevTools opened.
     */
    case 'startRealizationCapture': {
      const attachment = peekRegistry()?.attachment(request.treeId);
      if (!attachment) {
        return { ...envelope, ok: false, error: { code: 'STUDIO_TREE_NOT_FOUND' } };
      }
      const support = realizationSupport({ capabilities: attachment.structure?.capabilities });
      // ⚠️ The capability named must be the one that is missing. Naming
      // `committed-transactions` here detected the right condition and stated
      // the wrong reason, and the panel renders the reason.
      if (support.state === 'unsupported') {
        return {
          ...envelope, ok: false,
          error: { code: 'STUDIO_CAPABILITY_UNAVAILABLE', capability: REALIZATION_CAPABILITY },
        };
      }
      if (peekCapture(request.treeId)) {
        return { ...envelope, ok: true, value: { started: false, reason: 'already-active' } };
      }
      const target = attachment.createCaptureTarget?.() as CaptureTarget | undefined;
      if (!target) {
        // Attached and structurally capable, but this attachment cannot build a
        // capture target — still a realization gap, not a missing tree.
        return {
          ...envelope, ok: false,
          error: { code: 'STUDIO_CAPABILITY_UNAVAILABLE', capability: REALIZATION_CAPABILITY },
        };
      }
      try {
        startRealizationCapture(
          { ...target, treeId: request.treeId },
          { maxEffects: request.maxEffects }
        );
      } catch (cause) {
        if (!(cause instanceof StudioCaptureError)) {
          throw cause;
        }
        // Report what was refused. Flattening these to NOT_FOUND told the panel
        // the tree had vanished when it was attached the whole time.
        return cause.error.code === 'STUDIO_CAPTURE_ALREADY_ACTIVE'
          ? { ...envelope, ok: true, value: { started: false, reason: 'already-active' } }
          : { ...envelope, ok: false, error: cause.error };
      }
      return { ...envelope, ok: true, value: { started: true } };
    }

    /**
     * ⚠️ The panel SNAPSHOTS before stopping, so the investigation survives
     * while the recorder releases its retained data. Stopping ends recording,
     * not the investigation.
     */
    case 'stopRealizationCapture': {
      const lease = peekCapture(request.treeId);
      if (!lease) {
        return { ...envelope, ok: true, value: { stopped: false, reason: 'not-active' } };
      }
      const snapshot = lease.snapshot();
      disposeCapture(request.treeId);
      return { ...envelope, ok: true, value: { stopped: true, snapshot } };
    }

    case 'readRealizations': {
      const attachment = peekRegistry()?.attachment(request.treeId);
      if (!attachment) {
        return { ...envelope, ok: false, error: { code: 'STUDIO_TREE_NOT_FOUND' } };
      }
      const support = realizationSupport({ capabilities: attachment.structure?.capabilities });
      // Three states, never collapsed to an empty array.
      const result: RealizationReadResult =
        support.state === 'unsupported'
          ? { support: 'unsupported', reason: 'leaf-observation-unavailable' }
          : (() => {
              // Asked of the lease module, never of a bridge-local copy: a
              // lease disposed by detach or destroy must stop reading active
              // the moment it stops observing.
              const lease = peekCapture(request.treeId);
              return lease
                ? { support: 'supported', capture: 'active', snapshot: lease.snapshot() }
                : { support: 'supported', capture: 'inactive' };
            })();
      return { ...envelope, ok: true, value: result };
    }

    /** Compared against retained evidence — never inferred from it. */
    case 'readCurrentValue': {
      const attachment = peekRegistry()?.attachment(request.treeId);
      if (!attachment?.readCurrentValue) {
        return { ...envelope, ok: false, error: { code: 'STUDIO_TREE_NOT_FOUND' } };
      }
      return { ...envelope, ok: true, value: attachment.readCurrentValue(request.path) };
    }

    case 'readConfirmedTurns': {
      const registry = peekRegistry();
      if (!registry) {
        return { ...envelope, ok: false, error: { code: 'STUDIO_TREE_NOT_FOUND' } };
      }
      const result = registry.readConfirmedTurns(request.treeId);
      return result.ok
        ? { ...envelope, ok: true, value: result.value }
        : { ...envelope, ok: false, error: result.error };
    }
  }
}
