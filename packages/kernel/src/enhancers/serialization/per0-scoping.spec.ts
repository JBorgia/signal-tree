import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { persistence } from './serialization';
import type { StorageAdapter } from './storage-adapters';

const settle = async () => { await Promise.resolve(); await new Promise(r => setTimeout(r, 350)); };
const rec = () => {
  const store = new Map<string, string>();
  const adapter = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  } as unknown as StorageAdapter;
  return { adapter, store };
};

describe('PER-0: can the CURRENT form serve the production need?', () => {
  it('is there any selection/scoping option?', async () => {
    const { adapter, store } = rec();
    const tree = signalTree(
      { prefs: { theme: 'dark' }, huge: { rows: [1, 2, 3], secret: 'do-not-persist' } },
      { enhancers: [persistence({ key: 'whole', storage: adapter, debounceMs: 0 })] }
    ) as any;
    await settle();
    tree.$.prefs.theme('light');
    await settle();
    const payload = store.get('whole') ?? '';
    console.log(`PER0-SCOPE persistsSecret=${payload.includes('do-not-persist')} bytes=${payload.length}`);
    expect(true).toBe(true);
  });

  it('can two persistence enhancers coexist with different keys?', async () => {
    const a = rec(); const b = rec();
    let err = 'none';
    try {
      const tree = signalTree(
        { prefs: { theme: 'dark' }, other: { x: 1 } },
        { enhancers: [
          persistence({ key: 'k-a', storage: a.adapter, debounceMs: 0 }),
          persistence({ key: 'k-b', storage: b.adapter, debounceMs: 0 }),
        ] }
      ) as any;
      await settle();
      tree.$.prefs.theme('light');
      await settle();
      console.log(`PER0-MULTI aWrote=${!!a.store.get('k-a')} bWrote=${!!b.store.get('k-b')} sameContent=${a.store.get('k-a') === b.store.get('k-b')}`);
    } catch (e) { err = (e as Error).message.replace(/\s+/g, " ").slice(0, 220); }
    console.log(`PER0-MULTI err="${err}"`);
    expect(true).toBe(true);
  });
});
