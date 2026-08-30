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

  it('currently rejects a neutral callable returned from config.derived', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createDerivedReferenceStore();
    try {
      expect(
        (store.$ as unknown as Record<string, unknown>)['activeCount']
      ).toBeUndefined();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[ST2007] Derived "activeCount" dropped')
      );
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
