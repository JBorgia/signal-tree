import {
  createDerivedReferenceStore,
  createReferenceStore,
} from './reference-store';
import { readSignalTreeSnapshot } from './use-signal-tree.proof';

describe('greenfield reference state', () => {
  it('keeps the root snapshot stable while committed truth is unchanged', () => {
    const store = createReferenceStore();
    try {
      const first = readSignalTreeSnapshot(store);
      expect(readSignalTreeSnapshot(store)).toBe(first);
      store.$.filters.team.set('South');
      expect(readSignalTreeSnapshot(store)).not.toBe(first);
    } finally {
      store.destroy();
    }
  });

  it('realizes a neutral callable returned from config.derived', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createDerivedReferenceStore();
    try {
      store.$.jobs.addOne({
        id: 'a',
        title: 'Inspect neutral derivation',
        site: 'Reference app',
        owner: 'SignalTree',
        priority: 'routine',
        status: 'active',
      });
      expect(store.$.activeCount()).toBe(1);
      expect(
        warn.mock.calls.some((call) => String(call[0]).includes('ST2007'))
      ).toBe(false);
    } finally {
      store.destroy();
      warn.mockRestore();
    }
  });

  it('applies the coherent transaction result to direct readers', () => {
    const store = createReferenceStore();

    store.advance('J-104');

    expect(store.$.jobs.byIdOrFail('J-104')().status).toBe('done');
    expect(store.$.filters.showCompleted()).toBe(false);
    expect(
      store.$.jobs.all().filter((job) => job.status === 'active').length
    ).toBe(1);

    store.destroy();
  });
});
