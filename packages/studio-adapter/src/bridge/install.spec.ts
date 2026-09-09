import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  installStudioBridge,
  studioBridgeInstalled,
  uninstallStudioBridge,
  type StudioBridgeHost,
} from './index';

/** The minimum browser surface, injected so the transport needs no DOM. */
const fakeHost = () => {
  const listeners = new Set<(event: MessageEvent) => void>();
  const host: StudioBridgeHost = {
    addEventListener: (_type, listener) => void listeners.add(listener),
    removeEventListener: (_type, listener) => void listeners.delete(listener),
  };
  return { host, listeners };
};

afterEach(() => uninstallStudioBridge());

describe('installStudioBridge', () => {
  it('installs and uninstalls its listener', () => {
    const { host, listeners } = fakeHost();
    expect(studioBridgeInstalled()).toBe(false);

    installStudioBridge(host);
    expect(studioBridgeInstalled()).toBe(true);
    expect(listeners.size).toBe(1);

    uninstallStudioBridge();
    expect(studioBridgeInstalled()).toBe(false);
    expect(listeners.size).toBe(0);
  });

  it('is idempotent — installing twice yields one listener', () => {
    const { host, listeners } = fakeHost();
    const first = installStudioBridge(host);
    const second = installStudioBridge(host);

    expect(first).toBe(second);
    expect(listeners.size).toBe(1);
  });

  it('uninstalling when nothing is installed is a no-op', () => {
    expect(() => uninstallStudioBridge()).not.toThrow();
    expect(studioBridgeInstalled()).toBe(false);
  });

  /**
   * Lifetime is INSTALLATION, not attachment (S1-BRIDGE-SPEC §4.2). The bridge
   * answers with zero trees attached, so "Studio enabled, nothing attached"
   * stays distinguishable from "no Studio here".
   */
  it('stays installed with no trees attached', () => {
    const { host } = fakeHost();
    installStudioBridge(host);
    expect(studioBridgeInstalled()).toBe(true);
  });

  it('ignores frames that are not a Studio connect', () => {
    const { host, listeners } = fakeHost();
    installStudioBridge(host);
    const onConnect = [...listeners][0]!;
    const port = { onmessage: null, start: vi.fn(), postMessage: vi.fn(), close: vi.fn() };

    for (const data of [null, 'hello', { type: 'OTHER' }, {}, { type: 'SIGNALTREE_STUDIO_CONNECT' }]) {
      onConnect({ data, ports: [port] } as unknown as MessageEvent);
    }
    // Never adopted: wrong type, or right type with no/!matching protocol.
    expect(port.start).not.toHaveBeenCalled();
  });

  /**
   * S1-BRIDGE-SPEC §4.0 — the initiator owns the channel. The bridge adopts a
   * TRANSFERRED port and never replies through event.source, which would assume
   * the connecting party is a page Window. A DevTools panel is not one.
   */
  it('adopts a transferred port and answers on it', () => {
    const { host, listeners } = fakeHost();
    installStudioBridge(host);
    const onConnect = [...listeners][0]!;

    const posted: unknown[] = [];
    const port = {
      onmessage: null as null | ((e: MessageEvent) => void),
      start: vi.fn(),
      postMessage: (value: unknown) => posted.push(value),
      close: vi.fn(),
    };

    onConnect({
      data: { type: 'SIGNALTREE_STUDIO_CONNECT', protocol: 1, nonce: 'n1' },
      ports: [port],
    } as unknown as MessageEvent);

    expect(port.start).toHaveBeenCalled();
    port.onmessage?.({
      data: { protocol: 1, id: 'r1', command: 'hello' },
    } as MessageEvent);

    expect(posted).toEqual([
      { protocol: 1, id: 'r1', ok: true, value: { protocol: 1, schema: 1 } },
    ]);
  });

  it('refuses a connect frame carrying no port', () => {
    const { host, listeners } = fakeHost();
    installStudioBridge(host);
    const onConnect = [...listeners][0]!;
    expect(() =>
      onConnect({
        data: { type: 'SIGNALTREE_STUDIO_CONNECT', protocol: 1 },
        ports: [],
      } as unknown as MessageEvent)
    ).not.toThrow();
  });
});
