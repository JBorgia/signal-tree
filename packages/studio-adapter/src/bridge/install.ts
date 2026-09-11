import { acquireStudioRecording } from './recording';
import { observeRegistryChanges, peekRegistry } from '../registry';
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
  postMessage?(message: unknown, targetOrigin: string): void;
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

  const ports = new Map<MessagePort, () => void>();
  const invalidators = new Set<(treeId?: string) => void>();

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

    const stopRecording = acquireStudioRecording();
    let closed = false;
    let queued = false;
    const observers = new Map<string, { attachment: unknown; dispose: () => void }>();
    // An invalidation is not evidence. Coalesce a settled burst, then let the
    // panel read current truth and retained history through existing queries.
    const changedTrees = new Set<string>();
    let topologyChanged = false;
    const notify = (treeId?: string) => {
      if (closed) return;
      if (treeId === undefined) topologyChanged = true;
      else changedTrees.add(treeId);
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        if (!closed) {
          if (topologyChanged) port.postMessage({ protocol: STUDIO_PROTOCOL_VERSION, event: 'changed' });
          else for (const id of changedTrees) port.postMessage({ protocol: STUDIO_PROTOCOL_VERSION, event: 'changed', treeId: id });
        }
        topologyChanged = false;
        changedTrees.clear();
      });
    };
    const reconcile = () => {
      const registry = peekRegistry();
      for (const [id, observer] of observers) {
        if (registry?.attachment(id) !== observer.attachment) {
          observer.dispose();
          observers.delete(id);
        }
      }
      for (const tree of registry?.listTrees() ?? []) {
        const attachment = registry?.attachment(tree.id);
        if (attachment?.observeChanges && !observers.has(tree.id)) {
          observers.set(tree.id, { attachment, dispose: attachment.observeChanges(() => notify(tree.id)) });
        }
      }
    };
    const stopRegistry = observeRegistryChanges(() => { reconcile(); notify(); });
    reconcile();
    const close = () => {
      if (closed) return;
      closed = true;
      stopRegistry();
      stopRecording();
      invalidators.delete(notify);
      for (const observer of observers.values()) observer.dispose();
      observers.clear();
      ports.delete(port);
      port.close();
    };
    port.onmessageerror = close;
    port.onmessage = (message: MessageEvent) => {
      if (closed) return;
      if (message.data?.protocol === STUDIO_PROTOCOL_VERSION && message.data?.event === 'disconnect') {
        close();
        return;
      }
      // Nothing is trusted because it arrived on the port. A malformed frame is
      // ignored rather than answered — there is no id to answer to.
      if (!isStudioBridgeRequest(message.data)) {
        return;
      }
      port.postMessage(handleStudioRequest(message.data));
      if (message.data.command === 'startRealizationCapture' || message.data.command === 'stopRealizationCapture' || message.data.command === 'pauseStudioRecording' || message.data.command === 'resumeStudioRecording' || message.data.command === 'clearStudioHistory') {
        for (const invalidate of invalidators) invalidate(message.data.treeId);
      }
    };
    port.start?.();
    ports.set(port, close);
    invalidators.add(notify);
  };

  host.addEventListener('message', onConnect);
  host.postMessage?.({ type: 'SIGNALTREE_STUDIO_READY', protocol: STUDIO_PROTOCOL_VERSION }, '*');

  installed = {
    uninstall() {
      host.removeEventListener('message', onConnect);
      for (const close of ports.values()) close();
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
