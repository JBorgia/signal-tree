import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { signalTree } from '../signal-tree';
import {
  entityCollection,
  type EntityCollectionStorageAdapter,
  invalidateTag,
  stableStringify,
} from './entity-collection';

interface Cust {
  id: string;
  name: string;
}
type Scope = { region: string };

const WEST: Cust[] = [{ id: 'w1', name: 'West Co' }];
const EAST: Cust[] = [{ id: 'e1', name: 'East Co' }];
const selectId = (c: Cust) => c.id;
const ROWS: Record<string, Cust[]> = { west: WEST, east: EAST };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('stableStringify()', () => {
  it('is insensitive to object key insertion order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });
  it('is sensitive to array order', () => {
    expect(stableStringify(['a', 'b'])).not.toBe(stableStringify(['b', 'a']));
  });
});

describe('scoped entityCollection — freshness per scope (equal)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  function makeTree(counter: { n: number }) {
    return signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: ({ region }) => {
          counter.n++;
          return of(ROWS[region]);
        },
        selectId,
        staleTime: '1h',
      }),
    });
  }

  it('same scope + fresh → no refetch; same scope + stale → refetch', async () => {
    const c = { n: 0 };
    const tree = makeTree(c);
    await tree.$.customers.load({ region: 'west' });
    expect(c.n).toBe(1);
    vi.setSystemTime(30 * 60_000);
    await tree.$.customers.load({ region: 'west' }); // fresh (default structural equal) → no-op
    expect(c.n).toBe(1);
    vi.setSystemTime(61 * 60_000);
    await tree.$.customers.load({ region: 'west' }); // past window → refetch
    expect(c.n).toBe(2);
  });

  it('scope change → refetch, entities replaced, params() updates (typed)', async () => {
    const c = { n: 0 };
    const tree = makeTree(c);
    await tree.$.customers.load({ region: 'west' });
    expect(tree.$.customers.all()).toEqual(WEST);
    expect(tree.$.customers.params()).toEqual({ region: 'west' });

    await tree.$.customers.load({ region: 'east' }); // new scope → refetch even though 'west' was fresh
    expect(c.n).toBe(2);
    expect(tree.$.customers.all()).toEqual(EAST);
    expect(tree.$.customers.params()).toEqual({ region: 'east' });
  });

  it('default equal compares scope by value (object key order agnostic)', async () => {
    const c = { n: 0 };
    const tree = signalTree({
      items: entityCollection<Cust, string, { a: number; b: number }>({
        load: (_scope) => {
          c.n++;
          return of(WEST);
        },
        selectId,
        staleTime: '1h',
      }),
    });
    await tree.$.items.load({ a: 1, b: 2 });
    await tree.$.items.load({ b: 2, a: 1 } as { a: number; b: number });
    expect(c.n).toBe(1); // same scope by value → fresh → no second fetch
  });

  it('honors a custom equal comparator', async () => {
    const c = { n: 0 };
    const tree = signalTree({
      customers: entityCollection<Cust, string, { region: string; ts: number }>({
        load: ({ region }) => {
          c.n++;
          return of(ROWS[region]);
        },
        equal: (a, b) => a.region === b.region, // ignore `ts`
        selectId,
        staleTime: '1h',
      }),
    });
    await tree.$.customers.load({ region: 'west', ts: 1 });
    await tree.$.customers.load({ region: 'west', ts: 999 }); // same region → equal → no-op
    expect(c.n).toBe(1);
  });
});

describe('scoped entityCollection — single-flight & supersede', () => {
  it('concurrent same-scope load()s coalesce into one fetch', async () => {
    const c = { n: 0 };
    const d = deferred<Cust[]>();
    const tree = signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: (_s) => {
          c.n++;
          return d.promise;
        },
        selectId,
      }),
    });
    const p1 = tree.$.customers.load({ region: 'west' });
    const p2 = tree.$.customers.load({ region: 'west' });
    expect(c.n).toBe(1);
    expect(p1).toBe(p2);
    d.resolve(WEST);
    await Promise.all([p1, p2]);
    expect(tree.$.customers.all()).toEqual(WEST);
    expect(c.n).toBe(1);
  });

  it('a different scope supersedes the in-flight load; the stale result never writes', async () => {
    const dWest = deferred<Cust[]>();
    const dEast = deferred<Cust[]>();
    const tree = signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: ({ region }) => (region === 'west' ? dWest.promise : dEast.promise),
        selectId,
      }),
    });
    const pW = tree.$.customers.load({ region: 'west' });
    const pE = tree.$.customers.load({ region: 'east' }); // supersedes west
    dWest.resolve(WEST); // late — must be ignored
    dEast.resolve(EAST);
    await Promise.all([pW, pE]); // neither hangs
    expect(tree.$.customers.params()).toEqual({ region: 'east' });
    expect(tree.$.customers.all()).toEqual(EAST);
  });

  it('rapid successive scope changes: only the last-requested scope writes', async () => {
    const NORTH: Cust[] = [{ id: 'n1', name: 'North Co' }];
    const defs: Record<string, ReturnType<typeof deferred<Cust[]>>> = {
      west: deferred<Cust[]>(),
      east: deferred<Cust[]>(),
      north: deferred<Cust[]>(),
    };
    const rows: Record<string, Cust[]> = { west: WEST, east: EAST, north: NORTH };
    const tree = signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: ({ region }) => defs[region].promise,
        selectId,
      }),
    });
    const pW = tree.$.customers.load({ region: 'west' });
    const pE = tree.$.customers.load({ region: 'east' });
    const pN = tree.$.customers.load({ region: 'north' }); // final winner
    defs['west'].resolve(rows['west']);
    defs['east'].resolve(rows['east']);
    defs['north'].resolve(rows['north']);
    await Promise.all([pW, pE, pN]);
    expect(tree.$.customers.params()).toEqual({ region: 'north' });
    expect(tree.$.customers.all()).toEqual(NORTH);
  });
});

describe('scoped entityCollection — refresh & invalidate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  function makeTree(c: { n: number }) {
    return signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: ({ region }) => {
          c.n++;
          return of(ROWS[region]);
        },
        selectId,
        staleTime: '1h',
      }),
    });
  }

  it('refresh(params) bypasses staleTime and scope-match', async () => {
    const c = { n: 0 };
    const tree = makeTree(c);
    await tree.$.customers.load({ region: 'west' });
    await tree.$.customers.refresh({ region: 'west' }); // forced despite fresh
    expect(c.n).toBe(2);
  });

  it('refresh() with no params re-runs the last-loaded scope', async () => {
    const c = { n: 0 };
    const tree = makeTree(c);
    await tree.$.customers.load({ region: 'east' });
    await tree.$.customers.refresh();
    expect(c.n).toBe(2);
    expect(tree.$.customers.all()).toEqual(EAST);
  });

  it('refresh() with no params before any load is a safe no-op on a scoped collection', async () => {
    const c = { n: 0 };
    const tree = makeTree(c);
    await tree.$.customers.refresh(); // no scope known yet
    expect(c.n).toBe(0);
    expect(tree.$.customers.loaded()).toBe(false);
  });

  it('invalidate() marks the current scope stale so the next same-scope load refetches', async () => {
    const c = { n: 0 };
    const tree = makeTree(c);
    await tree.$.customers.load({ region: 'west' });
    tree.$.customers.invalidate();
    await tree.$.customers.load({ region: 'west' }); // fresh, but invalidated → refetch
    expect(c.n).toBe(2);
  });
});

describe('scoped entityCollection — errors, swr, clearOnParamsChange', () => {
  it('a loader error routes to error() and load() still resolves', async () => {
    const tree = signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: (_s) => Promise.reject(new Error('nope')),
        selectId,
      }),
    });
    await tree.$.customers.load({ region: 'west' });
    expect(tree.$.customers.error()).toBeInstanceOf(Error);
    expect(tree.$.customers.loaded()).toBe(false);
  });

  it('clearOnParamsChange:true blanks rows immediately on a scope change', async () => {
    const dWest = deferred<Cust[]>();
    const dEast = deferred<Cust[]>();
    const tree = signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: ({ region }) => (region === 'west' ? dWest.promise : dEast.promise),
        selectId,
        clearOnParamsChange: true,
      }),
    });
    const pW = tree.$.customers.load({ region: 'west' });
    dWest.resolve(WEST);
    await pW;
    expect(tree.$.customers.all()).toEqual(WEST);

    const pE = tree.$.customers.load({ region: 'east' });
    expect(tree.$.customers.all()).toEqual([]); // blanked immediately
    expect(tree.$.customers.loaded()).toBe(false);
    dEast.resolve(EAST);
    await pE;
    expect(tree.$.customers.all()).toEqual(EAST);
  });

  it('default (keep-until-settled) keeps the old scope rows during the new load', async () => {
    const dWest = deferred<Cust[]>();
    const dEast = deferred<Cust[]>();
    const tree = signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: ({ region }) => (region === 'west' ? dWest.promise : dEast.promise),
        selectId,
      }),
    });
    const pW = tree.$.customers.load({ region: 'west' });
    dWest.resolve(WEST);
    await pW;
    const pE = tree.$.customers.load({ region: 'east' });
    expect(tree.$.customers.all()).toEqual(WEST); // old rows kept until east settles
    dEast.resolve(EAST);
    await pE;
    expect(tree.$.customers.all()).toEqual(EAST);
  });

  it('swr:true keeps loaded() true while revalidating the same scope', async () => {
    const d1 = deferred<Cust[]>();
    const d2 = deferred<Cust[]>();
    let n = 0;
    const tree = signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: (_s) => (n++ === 0 ? d1.promise : d2.promise),
        selectId,
        swr: true,
      }),
    });
    const p1 = tree.$.customers.load({ region: 'west' });
    d1.resolve(WEST);
    await p1;
    expect(tree.$.customers.loaded()).toBe(true);
    tree.$.customers.invalidate();
    expect(tree.$.customers.loaded()).toBe(true); // swr: stays true after invalidate
    const p2 = tree.$.customers.load({ region: 'west' });
    expect(tree.$.customers.loaded()).toBe(true); // still true mid-revalidation
    d2.resolve(WEST);
    await p2;
    expect(tree.$.customers.loaded()).toBe(true);
  });
});

describe('scoped entityCollection — invalidateTag & persist', () => {
  it('invalidateTag marks a scoped collection stale', async () => {
    const c = { n: 0 };
    const tree = signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: ({ region }) => {
          c.n++;
          return of(ROWS[region]);
        },
        selectId,
        staleTime: '1h',
        tags: ['crm'],
      }),
    });
    await tree.$.customers.load({ region: 'west' });
    expect(invalidateTag(tree, 'crm')).toBe(1);
    await tree.$.customers.load({ region: 'west' }); // stale → refetch
    expect(c.n).toBe(2);
  });

  it('persist write-through uses a per-scope storage key', async () => {
    const store = new Map<string, string>();
    const adapter: EntityCollectionStorageAdapter = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
      removeItem: (k) => {
        store.delete(k);
      },
    };
    const tree = signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: ({ region }) => of(ROWS[region]),
        selectId,
        persist: { adapter, key: 'cust' },
      }),
    });
    await tree.$.customers.load({ region: 'west' });
    await tree.$.customers.load({ region: 'east' });
    expect(store.get(`cust::${stableStringify({ region: 'west' })}`)).toBe(
      JSON.stringify(WEST)
    );
    expect(store.get(`cust::${stableStringify({ region: 'east' })}`)).toBe(
      JSON.stringify(EAST)
    );
  });

  it('scoped hydrateThenRevalidate with a SYNC adapter seeds the scope, then revalidates', async () => {
    const store = new Map<string, string>([
      [`cust::${stableStringify({ region: 'west' })}`, JSON.stringify(WEST)],
    ]);
    const adapter: EntityCollectionStorageAdapter = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
      removeItem: (k) => {
        store.delete(k);
      },
    };
    const d = deferred<Cust[]>();
    const tree = signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: (_s) => d.promise,
        selectId,
        persist: { adapter, key: 'cust', hydrateThenRevalidate: true },
      }),
    });
    const p = tree.$.customers.load({ region: 'west' });
    expect(tree.$.customers.all()).toEqual(WEST); // seeded synchronously before the fetch
    expect(tree.$.customers.loaded()).toBe(false); // seed is stale
    d.resolve(EAST);
    await p;
    expect(tree.$.customers.all()).toEqual(EAST);
    expect(tree.$.customers.loaded()).toBe(true);
  });

  it('scoped hydrateThenRevalidate with an ASYNC adapter seeds, then revalidates', async () => {
    const store = new Map<string, string>([
      [`cust::${stableStringify({ region: 'west' })}`, JSON.stringify(WEST)],
    ]);
    const adapter: EntityCollectionStorageAdapter = {
      getItem: (k) => Promise.resolve(store.get(k) ?? null), // ASYNC
      setItem: (k, v) => {
        store.set(k, v);
      },
      removeItem: (k) => {
        store.delete(k);
      },
    };
    const d = deferred<Cust[]>();
    const tree = signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: (_s) => d.promise,
        selectId,
        persist: { adapter, key: 'cust', hydrateThenRevalidate: true },
      }),
    });
    const p = tree.$.customers.load({ region: 'west' });
    await Promise.resolve();
    await Promise.resolve();
    expect(tree.$.customers.all()).toEqual(WEST); // seeded from async snapshot
    expect(tree.$.customers.loaded()).toBe(false);
    d.resolve(EAST);
    await p;
    expect(tree.$.customers.all()).toEqual(EAST);
    expect(tree.$.customers.loaded()).toBe(true);
  });
});

describe('entityCollection — NG0600-safe deferred auto-load', () => {
  it('a global (non-lazy) collection does not write signals synchronously at materialization', async () => {
    const c = { n: 0 };
    const tree = signalTree({
      items: entityCollection<Cust, string>({
        load: () => {
          c.n++;
          return of(WEST);
        },
        selectId,
      }),
    });
    // First `.$` read (as in a template) must NOT have triggered the load's
    // signal writes synchronously — it is deferred to a microtask.
    expect(tree.$.items.all()).toEqual([]);
    expect(tree.$.items.loading()).toBe(false);
    expect(c.n).toBe(0);
    await Promise.resolve();
    expect(c.n).toBe(1);
    expect(tree.$.items.all()).toEqual(WEST);
  });

  it('a scoped collection never auto-loads (waits for load(params))', async () => {
    const c = { n: 0 };
    const tree = signalTree({
      customers: entityCollection<Cust, string, Scope>({
        load: ({ region }) => {
          c.n++;
          return of(ROWS[region]);
        },
        selectId,
      }),
    });
    tree.$.customers.all(); // finalize
    await Promise.resolve();
    await Promise.resolve();
    expect(c.n).toBe(0); // no auto-load without a scope
  });
});

describe('scoped entityCollection — typing (compile-time)', () => {
  it('enforces load() vs load(params) at the type level', () => {
    const scoped = signalTree({
      c: entityCollection<Cust, string, Scope>({
        load: ({ region }) => of(ROWS[region]),
        selectId,
      }),
    });
    const global = signalTree({
      c: entityCollection<Cust, string>({
        load: () => of(WEST),
        selectId,
      }),
    });

    // Compile-time only — type-checked by tsc, never executed.
    if (false as boolean) {
      // @ts-expect-error scoped load() needs a scope argument
      scoped.$.c.load();
      void scoped.$.c.load({ region: 'west' });
      void global.$.c.load();
      // @ts-expect-error global load() takes no argument
      global.$.c.load({ region: 'west' });
    }

    expect(scoped.$.c.params()).toBeUndefined();
    expect(global.$.c.loaded()).toBeDefined();
  });
});
