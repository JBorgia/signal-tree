import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { timeTravel } from '../restoration/restoration';
import { transactions } from '../transactions/transactions';
import { persistence } from './serialization';
import type { StorageAdapter } from './storage-adapters';

const settle = async () => { await Promise.resolve(); await new Promise(r => setTimeout(r, 350)); };
/**
 * Seed by ROUND-TRIPPING a real `save()` rather than hand-writing the payload.
 * The first version invented a shape, `load()` silently ignored it, and the
 * "nothing was restored" result was a fixture defect wearing a finding's
 * clothes — the same trap the microtask waits set three times in this audit.
 */
const seeded = (key: string, payload: unknown) => {
  const store = new Map<string, string>([[key, JSON.stringify(payload)]]);
  return {
    store,
    adapter: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    } as unknown as StorageAdapter,
  };
};

async function realPayload(key: string, state: { prefs: { theme: string } }) {
  const store = new Map<string, string>();
  const adapter = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  } as unknown as StorageAdapter;
  const donor = signalTree(state, {
    enhancers: [persistence({ key, storage: adapter, debounceMs: 0 })],
  }) as unknown as { save(): Promise<void> };
  await donor.save();
  return store.get(key) as string;
}

describe('PER-0: what IS a restore, causally?', () => {
  it('DIAGNOSTIC: what does a real save() actually write?', async () => {
    const raw = await realPayload('probe', { prefs: { theme: 'PERSISTED' } });
    console.log(`PAYLOAD ${raw.replace(/\s+/g, " ").slice(0, 200)}`);
    expect(typeof raw).toBe('string');
  });

  it('does hydrating persisted truth create undoable user history?', async () => {
    const raw = await realPayload('r1', { prefs: { theme: 'PERSISTED' } });
    const { adapter } = seeded('r1', JSON.parse(raw));
    const tree = signalTree(
      { prefs: { theme: 'default' } },
      { enhancers: [timeTravel({ maxHistorySize: 20 }), persistence({ key: 'r1', storage: adapter, debounceMs: 0 })] }
    ) as any;
    await settle();

    const restored = tree.$.prefs.theme();
    const len = tree.getRestorationHistory().length;
    const canUndo = tree.canUndo();
    let afterUndo = '(not attempted)';
    if (canUndo) { tree.undo(); await settle(); afterUndo = tree.$.prefs.theme(); }
    console.log(`RESTORE value=${restored} historyLen=${len} canUndo=${canUndo} afterUndo=${afterUndo}`);
    expect(true).toBe(true);
  });

  it('does an explicit load() mid-transaction disturb it?', async () => {
    const raw = await realPayload('r2', { prefs: { theme: 'PERSISTED' } });
    const { adapter } = seeded('r2', JSON.parse(raw));
    const tree = signalTree(
      { prefs: { theme: 'default' } },
      { enhancers: [transactions(), persistence({ key: 'r2', storage: adapter, autoLoad: false, debounceMs: 0 })] }
    ) as any;
    await settle();

    const p = tree.transaction(() => { tree.$.prefs.theme.set('OPTIMISTIC'); });
    await tree.load();
    await settle();
    const afterLoad = tree.$.prefs.theme();
    let err = 'none';
    try { p.rollback(); } catch (e) { err = (e as Error).message.replace(/\s+/g, ' ').slice(0, 80); }
    await settle();
    console.log(`LOAD-IN-TX afterLoad=${afterLoad} rollback="${err}" final=${tree.$.prefs.theme()}`);
    expect(true).toBe(true);
  });
});

describe('PER-0: is restore fixed by A1 ingress classification?', () => {
  it('load() wrapped as a realization', async () => {
    const { withWriteContext } = await import('../../lib/write-context');
    const raw = await realPayload('r3', { prefs: { theme: 'PERSISTED' } });
    const store = new Map<string, string>([['r3', raw]]);
    const adapter = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    } as unknown as StorageAdapter;

    const tree = signalTree(
      { prefs: { theme: 'default' } },
      { enhancers: [timeTravel({ maxHistorySize: 20 }), persistence({ key: 'r3', storage: adapter, autoLoad: false, debounceMs: 0 })] }
    ) as any;
    await settle();
    const before = tree.getRestorationHistory().length;

    await withWriteContext({ intent: 'system', participation: 'realized' }, () => tree.load());
    await settle();

    console.log(`RESTORE-AS-REALIZATION value=${tree.$.prefs.theme()} historyBefore=${before} after=${tree.getRestorationHistory().length} canUndo=${tree.canUndo()}`);
    expect(true).toBe(true);
  });
});
