import { describe, expect, it } from 'vitest';
import { signalTree } from '../../lib/signal-tree';
import { transactions } from '../transactions/transactions';
import { persistence } from './serialization';
import type { StorageAdapter } from './storage-adapters';

// autoSave debounces through setTimeout, so microtasks are not enough — the
// same class of test defect that made trackHistory look broken in TH-0.
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((r) => setTimeout(r, 350));
};

function recordingAdapter() {
  const writes: string[] = [];
  const store = new Map<string, string>();
  const adapter: StorageAdapter = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { writes.push(v); store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  } as unknown as StorageAdapter;
  return { adapter, writes, store };
}

/**
 * A2-0 discriminators, run against the SHIPPED `persistence()` enhancer rather
 * than the withheld `stored()` marker — `persistence` is what actually ships,
 * so it is what the audit must characterise.
 *
 * Timing note: autoSave debounces through `setTimeout`, and outside an Angular
 * injection context it falls back to a 100ms polling loop. Three separate
 * probes in this audit have now been fooled by awaiting only microtasks; the
 * waits below are deliberately past the poll interval.
 */
describe('A2 discriminators against the SHIPPED persistence enhancer', () => {
  it('case 3: is a rolled-back intermediate value ever persisted?', async () => {
    const { adapter, writes } = recordingAdapter();
    const tree = signalTree(
      { prefs: { theme: 'dark' }, count: 0 },
      { enhancers: [transactions(), persistence({ key: 'k', storage: adapter, debounceMs: 0 })] }
    ) as any;
    await flush();
    writes.length = 0;

    const p = tree.transaction(() => { tree.$.prefs.theme.set('OPTIMISTIC'); });
    await flush();
    const midWrites = writes.filter(w => w.includes('OPTIMISTIC')).length;
    p.rollback();
    await flush();

    // THE PREDICTED SEAM, AND IT IS ALREADY CLOSED. The optimistic value is
    // never written: autoSave defers while the tree has an unsettled scope and
    // re-arms on settlement, so persistence observes committed truth only.
    expect(midWrites).toBe(0);
    expect(tree.$.prefs.theme()).toBe('dark');
  });

  it('case 5/7: can the host force a drain, and what does destroy do?', async () => {
    const { adapter, writes } = recordingAdapter();
    const tree = signalTree(
      { prefs: { theme: 'dark' } },
      { enhancers: [persistence({ key: 'k2', storage: adapter, debounceMs: 5000 })] }
    ) as any;
    await flush();
    writes.length = 0;

    tree.$.prefs.theme.set('changed-just-before-background');
    await flush();
    const beforeDrain = writes.length;

    await tree.save();
    const afterSave = writes.length;
    const hasInternalFlush = typeof tree.__flushAutoSave === 'function';

    // The host CAN force a drain, through the PUBLIC `save()`. A 5s debounce
    // has written nothing; `save()` writes immediately. This is what a
    // Capacitor background handler needs, and it does not require a global
    // flush function.
    expect(beforeDrain).toBe(0);
    expect(afterSave).toBe(1);
    expect(hasInternalFlush).toBe(true);
  });

  it('case 8: can a tree exist with no storage platform?', async () => {
    let threw = 'none';
    try {
      signalTree({ a: 1 }, { enhancers: [persistence({ key: 'k3', storage: undefined as never })] });
    } catch (e) { threw = (e as Error).message.slice(0, 60); }
    // In a DOM environment `storage: undefined` silently falls back to
    // window.localStorage. Without a window it throws AT CONSTRUCTION — a tree
    // with persistence() cannot be built on a platform with no storage, it
    // does not degrade.
    expect(threw).toBe('none');
  });

  it('case 9: scoping — does persistence write the WHOLE tree?', async () => {
    const { adapter, store } = recordingAdapter();
    const tree = signalTree(
      { prefs: { theme: 'dark' }, transient: { scratch: 'should-not-persist' } },
      { enhancers: [persistence({ key: 'k4', storage: adapter, debounceMs: 0 })] }
    ) as any;
    await flush();
    tree.$.prefs.theme.set('light');
    await flush();
    const payload = store.get('k4') ?? '';
    // WHOLE-TREE, and this is the real gap against the production need.
    // TruckTrax persists three scoped leaves; `persistence()` writes everything,
    // transient state included.
    expect(payload.includes('should-not-persist')).toBe(true);
  });
});
