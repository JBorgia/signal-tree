import { peekRegistry } from '../registry';
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
