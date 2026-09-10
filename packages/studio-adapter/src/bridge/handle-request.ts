import { peekRegistry } from '../registry';
import { realizationSupport } from '../realization/support';
import {
  startRealizationCapture,
  StudioCaptureError,
  type CaptureTarget,
  type RealizationLease,
} from '../realization/lease';
import { type RealizationReadResult } from '../realization/types';

/** Panel-driven leases, so stop/read can find them. */
const leases = new Map<string, RealizationLease>();
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
      if (support.state === 'unsupported') {
        return {
          ...envelope, ok: false,
          error: { code: 'STUDIO_CAPABILITY_UNAVAILABLE', capability: 'committed-transactions' },
        };
      }
      if (leases.has(request.treeId)) {
        return { ...envelope, ok: true, value: { started: false, reason: 'already-active' } };
      }
      const target = attachment.createCaptureTarget?.() as CaptureTarget | undefined;
      if (!target) {
        return {
          ...envelope, ok: false,
          error: { code: 'STUDIO_CAPABILITY_UNAVAILABLE', capability: 'committed-transactions' },
        };
      }
      try {
        leases.set(
          request.treeId,
          startRealizationCapture({ ...target, treeId: request.treeId }, { maxEffects: request.maxEffects })
        );
      } catch (cause) {
        if (cause instanceof StudioCaptureError) {
          return { ...envelope, ok: false, error: { code: 'STUDIO_TREE_NOT_FOUND' } };
        }
        throw cause;
      }
      return { ...envelope, ok: true, value: { started: true } };
    }

    /**
     * ⚠️ The panel SNAPSHOTS before stopping, so the investigation survives
     * while the recorder releases its retained data. Stopping ends recording,
     * not the investigation.
     */
    case 'stopRealizationCapture': {
      const lease = leases.get(request.treeId);
      if (!lease) {
        return { ...envelope, ok: true, value: { stopped: false, reason: 'not-active' } };
      }
      const snapshot = lease.snapshot();
      lease.dispose();
      leases.delete(request.treeId);
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
          : leases.has(request.treeId)
            ? { support: 'supported', capture: 'active', snapshot: leases.get(request.treeId)!.snapshot() }
            : { support: 'supported', capture: 'inactive' };
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
