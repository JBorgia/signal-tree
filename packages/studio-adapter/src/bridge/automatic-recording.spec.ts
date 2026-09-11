import { external, signalTree, transactions } from '@signal-tree/kernel';
import { confirmedTurnReader } from '@signal-tree/kernel/internals';
import { afterEach, describe, expect, it } from 'vitest';

import { attachStudio } from '../attach-studio';
import { peekCapture } from '../realization/lease';
import { type RealizationCaptureSnapshot } from '../realization/types';
import { installStudioBridge, uninstallStudioBridge, type StudioBridgeHost } from './install';

const cleanup: (() => void)[] = [];
afterEach(() => { uninstallStudioBridge(); while (cleanup.length) cleanup.pop()?.(); });
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function tree() {
  const value = signalTree({ value: 0 }, { enhancers: [transactions()] });
  cleanup.push(() => value.destroy());
  return value;
}
function connect() {
  const listeners = new Set<(event: MessageEvent) => void>();
  const host: StudioBridgeHost = {
    addEventListener: (_, listener) => { listeners.add(listener); },
    removeEventListener: (_, listener) => { listeners.delete(listener); },
  };
  installStudioBridge(host);
  return () => {
    const messages: unknown[] = [];
    let id = 0;
    const port = {
      onmessage: null as null | ((event: MessageEvent) => void),
      start() { /* In-memory port is ready immediately. */ }, close() { /* No native handle is owned. */ }, postMessage(message: unknown) { messages.push(message); },
    };
    for (const listener of listeners) listener({ data: { type: 'SIGNALTREE_STUDIO_CONNECT', protocol: 1 }, ports: [port] } as unknown as MessageEvent);
    return {
      request<T>(command: string, treeId: string, extra: object = {}): T {
        const requestId = String(++id);
        port.onmessage?.({ data: { protocol: 1, id: requestId, command, treeId, ...extra } } as MessageEvent);
        const response = messages.find((message) => (message as { id?: string }).id === requestId) as { ok: boolean; value: T };
        expect(response?.ok).toBe(true);
        return response.value;
      },
      disconnect() { port.onmessage?.({ data: { protocol: 1, event: 'disconnect' } } as MessageEvent); },
    };
  };
}
type CaptureRead = { capture: string; snapshot: RealizationCaptureSnapshot };
type TurnRead = { historyEpoch: number; reset: boolean; turns: { id: number }[] };

describe('automatic connected Studio recording', () => {
  it('starts on connection, shares a lease across panels, and releases on last disconnect', async () => {
    const source = tree();
    const { id } = attachStudio(source);
    expect(peekCapture(id)).toBeUndefined();
    const open = connect();
    const first = open();
    const lease = peekCapture(id);
    expect(lease).toBeDefined();
    const second = open();
    expect(peekCapture(id)).toBe(lease);
    external(() => source.$.value(1));
    await settle();
    expect(first.request<CaptureRead>('readRealizations', id).snapshot.effects).toHaveLength(1);
    first.disconnect();
    expect(peekCapture(id)).toBe(lease);
    second.disconnect();
    expect(peekCapture(id)).toBeUndefined();
  });

  it('starts for late attachments and refuses unsupported observation', () => {
    const panel = connect()();
    const { id } = attachStudio(tree());
    expect(peekCapture(id)).toBeDefined();
    const bare = signalTree({ value: 0 });
    cleanup.push(() => bare.destroy());
    const unsupported = attachStudio(bare);
    expect(panel.request<{ support: string }>('readRealizations', unsupported.id).support).toBe('unsupported');
    expect(peekCapture(unsupported.id)).toBeUndefined();
  });

  it('shares pause/resume state, retains evidence, and declares the observation interruption', async () => {
    const source = tree();
    const { id } = attachStudio(source);
    const open = connect();
    const first = open();
    const second = open();
    external(() => source.$.value(1));
    await settle();
    first.request('pauseStudioRecording', id);
    external(() => source.$.value(2));
    await settle();
    const paused = second.request<CaptureRead>('readRealizations', id);
    expect(paused.capture).toBe('paused');
    expect(paused.snapshot.effects).toHaveLength(1);
    second.request('resumeStudioRecording', id);
    external(() => source.$.value(3));
    await settle();
    const resumed = first.request<CaptureRead>('readRealizations', id);
    expect(resumed.capture).toBe('active');
    expect(resumed.snapshot.captureId).toBe(paused.snapshot.captureId);
    expect(resumed.snapshot.effects).toHaveLength(2);
    expect(resumed.snapshot.coverage).toMatchObject({ interrupted: true });
  });

  it('does not lose a lower-id transaction confirmed after the incremental cursor', async () => {
    const source = tree();
    const { id } = attachStudio(source);
    const panel = connect()();
    const earlier = source.transaction(() => source.$.value(1));
    const later = source.transaction(() => source.$.value(2));
    later.confirm();
    const first = panel.request<TurnRead>('readConfirmedTurns', id);
    expect(first.turns).toHaveLength(1);
    earlier.confirm();
    await settle();
    const next = panel.request<TurnRead>('readConfirmedTurns', id, {
      historyEpoch: first.historyEpoch, knownTurnIds: first.turns.map(turn=>turn.id),
    });
    const kernel = confirmedTurnReader(source)!.readConfirmedTurns().turns;
    expect(kernel).toHaveLength(2);
    // Either a replacement window or an incremental update must contain the
    // newly confirmed transaction, regardless of its allocation order.
    expect(next.turns.some(turn => turn.id === kernel[0]!.id)).toBe(true);
  });

  it('clears only Studio history, changes capture identity, and resets incremental cursors', async () => {
    const source = tree();
    const { id } = attachStudio(source);
    const panel = connect()();
    source.transaction(() => source.$.value(1)).confirm();
    external(() => source.$.value(2));
    await settle();
    const before = panel.request<TurnRead>('readConfirmedTurns', id);
    const capture = panel.request<CaptureRead>('readRealizations', id).snapshot;
    expect(before.turns).toHaveLength(1);
    expect(panel.request<TurnRead>('readConfirmedTurns', id, { historyEpoch: before.historyEpoch, knownTurnIds: before.turns.map(turn=>turn.id) }).turns).toHaveLength(0);
    expect(panel.request<CaptureRead>('readRealizations', id, { captureId: capture.captureId, afterSequence: 0 }).snapshot.effects).toHaveLength(0);
    panel.request('clearStudioHistory', id);
    const cleared = panel.request<TurnRead>('readConfirmedTurns', id, { historyEpoch: before.historyEpoch, knownTurnIds: [999] });
    expect(cleared.reset).toBe(true);
    expect(cleared.historyEpoch).not.toBe(before.historyEpoch);
    expect(cleared.turns).toHaveLength(0);
    expect(confirmedTurnReader(source)?.readConfirmedTurns().turns).toHaveLength(1);
    expect(source.$.value()).toBe(2);
    source.transaction(() => source.$.value(3)).confirm();
    external(() => source.$.value(4));
    await settle();
    const after = panel.request<CaptureRead>('readRealizations', id, { captureId: capture.captureId, afterSequence: 999 }).snapshot;
    expect(after.captureId).not.toBe(capture.captureId);
    expect(after.effects).toHaveLength(1);
    expect(panel.request<TurnRead>('readConfirmedTurns', id, { historyEpoch: cleared.historyEpoch, knownTurnIds: before.turns.map(turn=>turn.id) }).turns).toHaveLength(1);
  });
});
