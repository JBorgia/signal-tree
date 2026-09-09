/// <reference types="chrome" />

import {
  isTransportEnvelope,
  STUDIO_CONNECT,
  STUDIO_EXTENSION_PORT,
  STUDIO_PROTOCOL_VERSION,
  type TransportEnvelope,
} from '../transport/protocol';

/**
 * The transport adapter, and nothing else.
 *
 * Two entirely different channels meet here, which is exactly why the
 * translation belongs at this layer:
 *
 *     chrome.runtime.Port     DevTools panel <-> content script
 *     MessagePort             content script <-> application main world
 *
 * ⚠️ THIS FILE MUST STAY SEMANTICS-FREE. It never inspects a payload beyond the
 * envelope, so a new Studio command needs no change here.
 */

let pagePort: MessagePort | undefined;
const pending = new Map<string, (payload: unknown) => void>();

/**
 * ⚠️ THE INITIATOR OWNS THE CHANNEL (S1-BRIDGE-SPEC §4.0). The content script
 * creates it and transfers `port2` into the page; the bridge adopts that port
 * and never replies through `event.source`, which would wrongly assume the
 * connecting party is a page Window.
 */
function connectToPage(): MessagePort {
  const channel = new MessageChannel();

  channel.port1.onmessage = (event: MessageEvent) => {
    const id = (event.data as { id?: string } | null)?.id;
    if (typeof id !== 'string') {
      return;
    }
    pending.get(id)?.(event.data);
    pending.delete(id);
  };
  channel.port1.start();

  window.postMessage(
    {
      type: STUDIO_CONNECT,
      protocol: STUDIO_PROTOCOL_VERSION,
      // Matches a response to its request. NOT authentication: any script in
      // this page's main realm can see it. See S1-BRIDGE-SPEC §4.
      nonce: Math.random().toString(36).slice(2),
    },
    '*',
    [channel.port2]
  );

  return channel.port1;
}

chrome.runtime.onConnect.addListener((extensionPort) => {
  if (extensionPort.name !== STUDIO_EXTENSION_PORT) {
    return;
  }

  pagePort ??= connectToPage();

  extensionPort.onMessage.addListener((message: unknown) => {
    if (!isTransportEnvelope(message)) {
      return;
    }
    const envelope = message as TransportEnvelope;

    // If the page never answers — no bridge installed — the panel's own timeout
    // resolves it as "no Studio". Silence is a meaningful answer here.
    pending.set(envelope.id, (payload) => {
      extensionPort.postMessage({ id: envelope.id, payload });
    });
    pagePort?.postMessage(envelope.payload);
  });

  extensionPort.onDisconnect.addListener(() => {
    pending.clear();
  });
});
