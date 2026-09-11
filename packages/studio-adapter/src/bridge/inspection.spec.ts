import { signalTree, transactions } from '@signal-tree/kernel';
import { afterEach, describe, expect, it } from 'vitest';
import { attachStudio } from '../attach-studio';
import { registryForAttach, dropRegistryIfEmpty } from '../registry';
import { handleStudioRequest } from './handle-request';
import { isStudioBridgeRequest, type StudioInspectionResponse } from './protocol';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()?.(); });
const request = { protocol: 1, id: 'inspection', command: 'readInspection' as const, treeId: 'test', paths: ['value'] };
function inspect(treeId: string, extra: object = {}): StudioInspectionResponse {
  const result = handleStudioRequest({ ...request, treeId, ...extra });
  if (!result.ok) throw new Error(result.error.code);
  return result.value as StudioInspectionResponse;
}

describe('coherent inspection envelope', () => {
  it('returns existing reads together, with optional structure and incremental turns', () => {
    const tree = signalTree({ value: 1 }, { enhancers: [transactions()] }); cleanup.push(() => tree.destroy());
    const attached = attachStudio(tree); cleanup.push(() => attached.detach());
    tree.transaction(() => tree.$.value(2)).confirm();
    const first = inspect(attached.id, { includeStructure: true });
    expect(first.values).toMatchObject({ ok: true, value: { values: [{ path: 'value', value: { kind: 'value', value: 2 } }] } });
    expect(first.structure).toMatchObject({ ok: true, value: { ok: true, shape: { nodes: [{ path: 'value' }] } } });
    expect(first.turns).toMatchObject({ ok: true, value: { turns: [{ id: 1 }] } });
    expect(inspect(attached.id, { knownTurnIds: [1], historyEpoch: 0 }).turns).toMatchObject({ ok: true, value: { turns: [], reset: false } });
    expect(inspect(attached.id).structure).toBeUndefined();
  });
  it('retains capability failure beside successful current values', () => {
    const tree = signalTree({ value: 1 }); cleanup.push(() => tree.destroy());
    const attached = attachStudio(tree); cleanup.push(() => attached.detach());
    const result = inspect(attached.id);
    expect(result.turns).toMatchObject({ ok: false, error: { code: 'STUDIO_CAPABILITY_UNAVAILABLE' } });
    expect(result.realizations).toMatchObject({ ok: true, value: { support: 'unsupported' } });
    expect(result.values).toMatchObject({ ok: true });
  });
  it('does not publish pending transactions as confirmed history', () => {
    const tree = signalTree({ value: 1 }, { enhancers: [transactions()] }); cleanup.push(() => tree.destroy());
    const attached = attachStudio(tree); cleanup.push(() => attached.detach());
    const pending = tree.transaction(() => tree.$.value(2));
    expect(inspect(attached.id).turns).toMatchObject({ ok: true, value: { turns: [] } });
    pending.confirm();
    expect(inspect(attached.id).turns).toMatchObject({ ok: true, value: { turns: [{ id: 1 }] } });
  });
  it('rejects malformed cursors and bounds before port dispatch', () => {
    expect(isStudioBridgeRequest(request)).toBe(true);
    for (const bad of [
      { paths: Array(201).fill('x') }, { paths: [1] }, { knownTurnIds: [-1] },
      { knownTurnIds: Array(501).fill(1) }, { historyEpoch: NaN }, { afterSequence: -2 },
      { afterSequence: Infinity }, { captureId: 1 }, { includeStructure: 'yes' },
    ]) expect(isStudioBridgeRequest({ ...request, ...bad })).toBe(false);
    expect(handleStudioRequest(request)).toMatchObject({ ok: false, error: { code: 'STUDIO_TREE_NOT_FOUND' } });
  });
});


describe('bounded history normalization', () => {
  it('discards older records before inspecting effects and reports truncation', () => {
    const registry = registryForAttach();
    const old = { id: 1, positions: [], get effects(): never { throw new Error('discarded history must not normalize'); } };
    const id = registry.add('bounded-test', { capabilities: ['committed-transactions'], reader: {
      treeId: 'bounded-test', readConfirmedTurns: () => ({ turns: [old, { id: 2, positions: [], effects: [] }], retention: { truncated: false } }),
    } });
    cleanup.push(() => { registry.remove(id); dropRegistryIfEmpty(); });
    expect(registry.readConfirmedTurns(id, 1)).toMatchObject({ ok: true, value: { turns: [{ id: 2 }], retention: { truncated: true, firstAvailableTurnId: 2 } } });
    expect(registry.readConfirmedTurns(id, 0)).toMatchObject({ ok: false, error: { code: 'STUDIO_INVALID_LIMIT' } });
  });
});
