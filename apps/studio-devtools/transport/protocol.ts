/**
 * Transport envelope — the ONLY thing the content script understands.
 *
 * ⚠️ The content script knows nothing about transactions, trees, effects,
 * retention, or what a StudioTreeId means. It forwards opaque payloads.
 * Protocol and schema validation live in
 * `@signal-tree/studio-adapter/bridge`, and semantics live above that again.
 */
export interface TransportEnvelope {
  readonly id: string;
  readonly payload: unknown;
}

/** Extension-messaging port name; unrelated to the page MessagePort. */
export const STUDIO_EXTENSION_PORT = 'signaltree-studio';

/** Page-realm connect signal. Must match the adapter's constant. */
export const STUDIO_CONNECT = 'SIGNALTREE_STUDIO_CONNECT';

export const STUDIO_PROTOCOL_VERSION = 1;

export function isTransportEnvelope(value: unknown): value is TransportEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { id?: unknown }).id === 'string' &&
    'payload' in value
  );
}
