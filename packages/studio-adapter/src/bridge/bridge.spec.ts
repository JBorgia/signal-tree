import { signalTree, transactions } from '@signal-tree/kernel';
import { afterEach, describe, expect, it } from 'vitest';

import { attachStudio, type StudioAttachableTree } from '../index';
import {
  handleStudioRequest,
  isStudioBridgeRequest,
  STUDIO_PROTOCOL_VERSION,
  STUDIO_SCHEMA_VERSION,
} from './index';

type Cart = { total: number };

const opened: { detach: () => void }[] = [];
afterEach(() => {
  while (opened.length > 0) opened.pop()?.detach();
});

const transactional = () =>
  signalTree({ total: 12000 } as Cart, {
    enhancers: [transactions()],
  } as never) as never as StudioAttachableTree & {
    $: Record<string, (v?: unknown) => unknown>;
    transaction(fn: () => void): { confirm(): void };
  };

const open = (tree: StudioAttachableTree, label?: string) => {
  const a = attachStudio(tree, label ? { label } : {});
  opened.push(a);
  return a;
};

const req = (command: string, extra: Record<string, unknown> = {}) =>
  handleStudioRequest({
    protocol: STUDIO_PROTOCOL_VERSION,
    id: 'r1',
    command,
    ...extra,
  } as never);

describe('handleStudioRequest', () => {
  it('hello negotiates versions and advertises no capabilities', () => {
    const response = req('hello');
    expect(response).toEqual({
      protocol: STUDIO_PROTOCOL_VERSION,
      id: 'r1',
      ok: true,
      value: { protocol: STUDIO_PROTOCOL_VERSION, schema: STUDIO_SCHEMA_VERSION },
    });
    // Capability belongs to a tree, never to the handshake.
    expect(JSON.stringify(response)).not.toContain('committed-transactions');
  });

  /**
   * S1-BRIDGE-SPEC §4.2 — "installed, nothing attached" must not look like
   * "no Studio here". An empty list is a meaningful answer; silence is not.
   */
  it('listTrees returns [] with no attachments rather than failing', () => {
    const response = req('listTrees');
    expect(response.ok).toBe(true);
    if (response.ok) expect(response.value).toEqual([]);
  });

  it('listTrees reports capability per tree', () => {
    const bare = open(signalTree({ total: 1 } as Cart) as never, 'Bare');
    const rich = open(transactional(), 'Rich');

    const response = req('listTrees');
    expect(response.ok && response.value).toEqual([
      { id: bare.id, label: 'Bare', capabilities: [] },
      { id: rich.id, label: 'Rich', capabilities: ['committed-transactions'] },
    ]);
  });

  it('readConfirmedTurns serializes real committed effects', () => {
    const tree = transactional();
    const attachment = open(tree, 'AppTree');
    tree.transaction(() => tree.$['total'](9600)).confirm();

    const response = req('readConfirmedTurns', { treeId: attachment.id });
    expect(response.ok).toBe(true);
    if (!response.ok) return;

    const value = response.value as {
      treeId: string;
      retention: { truncated: boolean };
      turns: { effects: { path: string; before: unknown; after: unknown }[] }[];
    };
    expect(value.treeId).toBe(attachment.id);
    expect(value.retention.truncated).toBe(false);
    expect(value.turns[0]?.effects[0]).toMatchObject({
      path: 'total',
      before: 12000,
      after: 9600,
    });
  });

  it('refuses structurally for a tree lacking the capability', () => {
    const bare = open(signalTree({ total: 1 } as Cart) as never);
    const response = req('readConfirmedTurns', { treeId: bare.id });

    expect(response).toEqual({
      protocol: STUDIO_PROTOCOL_VERSION,
      id: 'r1',
      ok: false,
      error: {
        code: 'STUDIO_CAPABILITY_UNAVAILABLE',
        capability: 'committed-transactions',
      },
    });
  });

  it('reports an unknown tree distinctly from an incapable one', () => {
    open(transactional());
    const response = req('readConfirmedTurns', { treeId: 'tree-nope' });
    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe('STUDIO_TREE_NOT_FOUND');
  });

  it('rejects a protocol mismatch with both versions', () => {
    const response = handleStudioRequest({
      protocol: 99,
      id: 'r1',
      command: 'hello',
    } as never);

    expect(response).toEqual({
      protocol: STUDIO_PROTOCOL_VERSION,
      id: 'r1',
      ok: false,
      error: {
        code: 'STUDIO_PROTOCOL_MISMATCH',
        expected: STUDIO_PROTOCOL_VERSION,
        received: 99,
      },
    });
  });

  it('never returns a tree object, signal or reader — records only', () => {
    const tree = transactional();
    const attachment = open(tree);
    tree.transaction(() => tree.$['total'](9600)).confirm();

    const response = req('readConfirmedTurns', { treeId: attachment.id });
    // Structured-clone-safe payloads exclusively.
    expect(() => structuredClone(response)).not.toThrow();
  });
});

describe('isStudioBridgeRequest', () => {
  it('accepts the three commands and rejects everything else', () => {
    const base = { protocol: 1, id: 'x' };
    expect(isStudioBridgeRequest({ ...base, command: 'hello' })).toBe(true);
    expect(isStudioBridgeRequest({ ...base, command: 'listTrees' })).toBe(true);
    expect(
      isStudioBridgeRequest({ ...base, command: 'readConfirmedTurns', treeId: 't' })
    ).toBe(true);

    // readConfirmedTurns without a treeId is not a valid frame.
    expect(isStudioBridgeRequest({ ...base, command: 'readConfirmedTurns' })).toBe(false);
    // No mutation commands exist to accept.
    expect(isStudioBridgeRequest({ ...base, command: 'setValue', path: 'a' })).toBe(false);
    expect(isStudioBridgeRequest({ ...base, command: 'eval', code: '1' })).toBe(false);
    expect(isStudioBridgeRequest(null)).toBe(false);
    expect(isStudioBridgeRequest('hello')).toBe(false);
    expect(isStudioBridgeRequest({ command: 'hello' })).toBe(false);
  });
});
