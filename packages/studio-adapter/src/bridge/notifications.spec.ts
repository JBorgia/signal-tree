import { external, signalTree, transactions } from '@signal-tree/kernel';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { attachStudio } from '../attach-studio';
import { isCaptureActive } from '../realization/lease';
import { installStudioBridge, uninstallStudioBridge, type StudioBridgeHost } from './install';

const cleanups: (() => void)[] = [];
afterEach(() => {
  uninstallStudioBridge();
  while (cleanups.length) cleanups.pop()?.();
});

const settle = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};

function makeTree() {
  const tree = signalTree({ value: 0 }, { enhancers: [transactions()] });
  cleanups.push(() => tree.destroy());
  return tree;
}

function connectBridge() {
  const listeners = new Set<(event: MessageEvent) => void>();
  const host: StudioBridgeHost = {
    addEventListener: (_type, listener) => { listeners.add(listener); },
    removeEventListener: (_type, listener) => { listeners.delete(listener); },
  };
  installStudioBridge(host);
  return () => {
    const posted: unknown[] = [];
    const port = {
      onmessage: null as null | ((event: MessageEvent) => void),
      start: vi.fn(),
      postMessage: (value: unknown) => { posted.push(value); },
      close: vi.fn(),
    };
    for (const listener of listeners) listener({
      data: { type: 'SIGNALTREE_STUDIO_CONNECT', protocol: 1 },
      ports: [port],
    } as unknown as MessageEvent);
    return {
      posted,
      port,
      send: (data: object) => port.onmessage?.({ data } as MessageEvent),
      changes: () => posted.filter((value) =>
        (value as { event?: string }).event === 'changed'),
    };
  };
}

describe('bridge owner notifications', () => {
  it('observes authored and external changes with automatic recording, and coalesces bursts', async () => {
    const tree = makeTree();
    const attachment = attachStudio(tree);
    const connection = connectBridge()();
    tree.$.value(1);
    tree.$.value(2);
    await settle();
    expect(connection.changes()).toEqual([{ protocol: 1, event: 'changed', treeId: attachment.id }]);
    external(() => tree.$.value(3));
    await settle();
    expect(connection.changes()).toHaveLength(2);
    expect(isCaptureActive(attachment.id)).toBe(true);
  });

  it('reconciles attachment, detach, replacement registry and destruction', async () => {
    const connection = connectBridge()();
    const first = makeTree();
    const attachment = attachStudio(first);
    await settle();
    expect(connection.changes()).toHaveLength(1);
    attachment.detach();
    await settle();
    expect(connection.changes()).toHaveLength(2);
    first.$.value(1);
    await settle();
    expect(connection.changes()).toHaveLength(2);
    const second = makeTree();
    attachStudio(second);
    await settle();
    expect(connection.changes()).toHaveLength(3);
    second.$.value(1);
    await settle();
    expect(connection.changes()).toHaveLength(4);
    second.destroy();
    await settle();
    expect(connection.changes()).toHaveLength(5);
  });

  it('isolates unrelated trees and releases one port without disabling another', async () => {
    const tree = makeTree();
    const unrelated = makeTree();
    attachStudio(tree);
    const connect = connectBridge();
    const first = connect();
    const second = connect();
    unrelated.$.value(1);
    await settle();
    expect(first.changes()).toHaveLength(0);
    expect(second.changes()).toHaveLength(0);
    tree.$.value(1);
    await settle();
    expect(first.changes()).toHaveLength(1);
    expect(second.changes()).toHaveLength(1);
    first.send({ protocol: 1, event: 'disconnect' });
    expect(first.port.close).toHaveBeenCalledTimes(1);
    tree.$.value(2);
    await settle();
    expect(first.changes()).toHaveLength(1);
    expect(second.changes()).toHaveLength(2);
    uninstallStudioBridge();
    tree.$.value(3);
    await settle();
    expect(second.changes()).toHaveLength(2);
    expect(second.port.close).toHaveBeenCalledTimes(1);
  });

  it('cancels pending notifications on uninstall and stops registry notifications', async () => {
    const connection = connectBridge()();
    const tree = makeTree();
    const attachment = attachStudio(tree);
    uninstallStudioBridge();
    await settle();
    attachment.detach();
    attachStudio(makeTree());
    await settle();
    expect(connection.changes()).toHaveLength(0);
  });

  it('does not turn read requests into more invalidations', async () => {
    const tree = makeTree();
    const attachment = attachStudio(tree);
    const connection = connectBridge()();
    tree.$.value(1);
    await settle();
    for (const command of ['listTrees', 'readConfirmedTurns', 'readCurrentValue', 'readStateShape']) {
      connection.send({ protocol: 1, id: command, command, treeId: attachment.id, path: 'value' });
    }
    await settle();
    expect(connection.changes()).toHaveLength(1);
    expect(connection.posted.filter((value) => (value as { ok?: boolean }).ok)).toHaveLength(4);
  });

  it('publishes confirmed history after settlement without another write', async () => {
    const tree = makeTree();
    const attachment = attachStudio(tree);
    const connection = connectBridge()();
    const pending = tree.transaction(() => tree.$.value(4));
    await settle();
    expect(connection.changes()).toHaveLength(0);
    pending.confirm();
    await settle();
    expect(connection.changes()).toHaveLength(1);
    connection.send({ protocol: 1, id: 'history', command: 'readConfirmedTurns', treeId: attachment.id });
    const response = connection.posted.find((value) => (value as { id?: string }).id === 'history');
    expect(response).toMatchObject({ ok: true, value: { turns: [expect.objectContaining({})] } });
    await settle();
    expect(connection.changes()).toHaveLength(1);
  });
});

describe('notification scope', () => {
  it('preserves distinct affected owners in one coalesced burst', async () => {
    const a = makeTree(); const b = makeTree();
    const first = attachStudio(a); const second = attachStudio(b);
    const connection = connectBridge()();
    a.$.value(1); b.$.value(2);
    await settle();
    expect(connection.changes()).toEqual([
      { protocol: 1, event: 'changed', treeId: first.id },
      { protocol: 1, event: 'changed', treeId: second.id },
    ]);
  });
  it('a topology change supersedes narrower queued notifications', async () => {
    const a = makeTree(); attachStudio(a);
    const connection = connectBridge()();
    a.$.value(1);
    attachStudio(makeTree());
    await settle();
    expect(connection.changes()).toContainEqual({ protocol: 1, event: 'changed' });
  });
});
