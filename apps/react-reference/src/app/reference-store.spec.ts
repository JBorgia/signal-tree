import {
  createDerivedReferenceStore,
  createReferenceStore,
} from './reference-store';

describe('greenfield reference state', () => {
  it('currently allocates a neutral owner snapshot on every read', () => {
    const store = createReferenceStore();
    try {
      expect(store()).not.toBe(store());
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
