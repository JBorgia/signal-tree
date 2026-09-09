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
    const source = { postMessage: vi.fn() };

    for (const data of [null, 'hello', { type: 'OTHER' }, {}]) {
      onConnect({ data, source } as unknown as MessageEvent);
    }
    expect(source.postMessage).not.toHaveBeenCalled();
  });
});
