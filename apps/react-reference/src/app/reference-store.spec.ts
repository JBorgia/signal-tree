import {
  createDerivedReferenceStore,
  createReferenceStore,
  DEFAULT_FILTERS,
} from './reference-store';
import { readCanonicalSnapshot } from '@signal-tree/kernel/adapter';

describe('greenfield reference state', () => {
  it('keeps the root snapshot stable while committed truth is unchanged', () => {
    const store = createReferenceStore();
    try {
      const first = readCanonicalSnapshot(store);
      expect(readCanonicalSnapshot(store)).toBe(first);
      store.$.filters.team('South');
      expect(readCanonicalSnapshot(store)).not.toBe(first);
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
        team: 'North',
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
    // `showCompleted` is true by default, so the completed job survives its own
    // completion and KEEPS the selection — the successor branch is not taken.
    expect(store.$.jobs.activeId()).toBe('J-104');
    expect(store.$.activeJobCount()).toBe(1);

    store.destroy();
  });

  it('restores every filter field from one reset transaction', () => {
    const store = createReferenceStore();

    store.setTeam('South');
    store.setShowCompleted(false);
    expect(store.$.filtersAreDefault()).toBe(false);

    store.resetFilters();

    expect(store.$.filters.team()).toBe(DEFAULT_FILTERS.team);
    expect(store.$.filters.showCompleted()).toBe(DEFAULT_FILTERS.showCompleted);
    expect(store.$.filtersAreDefault()).toBe(true);

    store.destroy();
  });

  it('projects across domains — a filter-only write moves the visible set', () => {
    const store = createReferenceStore();

    expect(store.$.visibleJobs().map((job) => job.id)).toEqual([
      'J-104',
      'J-105',
      'J-106',
    ]);

    store.setTeam('South');
    expect(store.$.visibleJobs().map((job) => job.id)).toEqual(['J-201', 'J-202']);

    store.setShowCompleted(false);
    expect(store.$.visibleJobs().map((job) => job.id)).toEqual(['J-201']);

    store.destroy();
  });

  it('holds a hidden selection instead of writing into the jobs domain', () => {
    const store = createReferenceStore();

    expect(store.$.jobs.activeId()).toBe('J-104');
    expect(store.$.selectionHiddenByFilters()).toBe(false);

    store.setTeam('South');

    // The filter boundary does not clear the selection.
    expect(store.$.jobs.activeId()).toBe('J-104');
    expect(store.$.selectionHiddenByFilters()).toBe(true);

    store.resetFilters();
    expect(store.$.selectionHiddenByFilters()).toBe(false);

    store.destroy();
  });

  it('advances selection off a job its own completion hides', () => {
    const store = createReferenceStore();

    store.setShowCompleted(false);
    store.selectJob('J-104');

    store.advance('J-104');

    expect(store.$.jobs.byIdOrFail('J-104')().status).toBe('done');
    // J-104 left the visible set in the same transaction, so selection moved on.
    expect(store.$.jobs.activeId()).toBe('J-105');
    expect(store.$.selectionHiddenByFilters()).toBe(false);

    store.destroy();
  });

  it('separates a synchronous state read from notification timing', () => {
    const store = createReferenceStore();

    store.setTeam('South');
    // No await, no flush: the write is already canonical truth to a direct
    // reader. Only NOTIFICATION of observers is deferred, not the state itself.
    expect(store.$.filters.team()).toBe('South');
    expect(store.$.visibleJobs().map((job) => job.id)).toEqual(['J-201', 'J-202']);

    store.destroy();
  });
});
