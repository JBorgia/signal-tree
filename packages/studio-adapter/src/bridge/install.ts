import { handleStudioRequest } from './handle-request';
import {
  isStudioBridgeRequest,
  STUDIO_CONNECT,
  STUDIO_PROTOCOL_VERSION,
} from './protocol';

/**
 * The minimum of the browser this module needs. Injectable so the transport is
 * testable without a DOM.
 */
export interface StudioBridgeHost {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

export interface InstalledStudioBridge {
  readonly uninstall: () => void;
}

let installed: InstalledStudioBridge | undefined;

/**
 * Install the page-realm bridge. **Development builds only.**
 *
 * ```ts
 * import { installStudioBridge } from '@signal-tree/studio-adapter/bridge';
 * installStudioBridge();
 * ```
 *
 * ⚠️ THIS MODULE IS THE GATE. It is a separate entry point rather than a
 * `typeof window` branch inside `attachStudio`, because a runtime environment
 * check cannot be tree-shaken and would ship the bridge in every bundle — the
 * same trap `debug-enhancers.prod.ts` and the `no-restricted-imports` rule
 * exist to prevent. A build that never imports this file does not contain it,
 * and that absence is the security boundary (S1-BRIDGE-SPEC §4A, §4.1).
 *
 * Lifetime is INSTALLATION, not attachment: once installed the bridge answers
 * even with zero trees attached, so "Studio enabled, nothing attached" stays
 * distinguishable from "no Studio here" (§4.2).
 */
export function installStudioBridge(
  host: StudioBridgeHost = globalThis as unknown as StudioBridgeHost
): InstalledStudioBridge {
  if (installed) {
    return installed;
  }

  const ports = new Set<MessagePort>();

  const onConnect = (event: MessageEvent) => {
    // Same-window frames only. This is hygiene against stray cross-frame
    // traffic, NOT authentication — see S1-BRIDGE-SPEC §4.
    if (event.source !== undefined && event.source !== host) {
      return;
    }

    const data = event.data as Record<string, unknown> | null;
    if (typeof data !== 'object' || data === null) {
      return;
    }
    if (data['type'] !== STUDIO_CONNECT) {
      return;
    }
    if (data['protocol'] !== STUDIO_PROTOCOL_VERSION) {
      return;
    }

    // ⚠️ THE INITIATOR OWNS THE CHANNEL. The bridge accepts a transferred port
    // and NEVER replies through `event.source`.
    //
    // The first implementation created the channel here and posted `port2`
    // back to `event.source`, which assumed the connecting party is a page
    // Window whose WindowProxy arrives on the event. A DevTools panel is not a
    // page window — it reaches the page through a content script — so that
    // reply channel was wrong, and the shape of it hid the mistake behind a
    // plausible-looking line of code.
    const port = event.ports?.[0];
    if (!port) {
      return;
    }

    port.onmessage = (message: MessageEvent) => {
      // Nothing is trusted because it arrived on the port. A malformed frame is
      // ignored rather than answered — there is no id to answer to.
      if (!isStudioBridgeRequest(message.data)) {
        return;
      }
      port.postMessage(handleStudioRequest(message.data));
    };
    port.start?.();
    ports.add(port);
  };

  host.addEventListener('message', onConnect);

  installed = {
    uninstall() {
      host.removeEventListener('message', onConnect);
      for (const port of ports) {
        port.close();
      }
      ports.clear();
      installed = undefined;
    },
  };
  return installed;
}

/** No-op when nothing is installed. */
export function uninstallStudioBridge(): void {
  installed?.uninstall();
}

/** Whether a bridge is currently installed. */
export function studioBridgeInstalled(): boolean {
  return installed !== undefined;
}
