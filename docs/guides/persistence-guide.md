# Persistence Guide

The old `stored(key, default, options?)` marker is deleted, along with its
storage-key helpers and cache-aware loader persistence path (`STORED-RETIRE-0`,
closed — see `docs/architecture/v15-production-surface-audit.md`'s final
disposition ledger). This is not an open question waiting on a future
contract; it is a decided decomposition:

```text
BEFORE                          AFTER
stored() [deleted]               ordinary state location
  state                            + Link              (relationship authority)
  persistence                      + persistence policy (endpoint, codec, key,
  authority                                              lifecycle)
  lifecycle
```

`link()` is the general successor for external acquisition/synchronization —
the same primitive the removed `loader()` decomposed into for collections.
Persistence is just the case where the endpoint is storage instead of HTTP:

```typescript
import { link, type Link, type Location } from '@signal-tree/kernel';

function attachLocalStorageSync<T>(location: Location<T>, key: string): Link {
  const connection = link(location, {
    get: () => {
      const raw = localStorage.getItem(key);
      return raw === null ? location() : (JSON.parse(raw) as T);
    },
    set: (value) => localStorage.setItem(key, JSON.stringify(value)),
  });
  void connection.retrieve(); // the deleted marker hydrated synchronously at
  // construction; link() only reads on retrieve(), so pull once to match.
  return connection;
}

const tree = signalTree({ theme: 'light' as 'light' | 'dark' });
attachLocalStorageSync(tree.$.theme, 'app-theme');
```

`link()` only exists once the tree is built — it operates on a resolved
`tree.$.<path>` location, not a marker literal — so wiring moves out of the
state factory and into wherever you construct the tree (or a lazily-called
site right after, the same shape §2's Ops base uses for its own acquisition).

### What SignalTree owns vs. what you own

Same split the removed `loader()` resolved into:

```text
the relationship (does this location have a live sync to an external
  authority, and is a write to it authored or external)     -> link()
codec, storage key, migration, debounce, write scheduling    -> your endpoint
staleTime, SWR, eviction, retry, auth                         -> application
```

None of that policy needs a marker to express — `get`/`set` are ordinary
functions, so debounce, versioning, or a custom serializer are just more code
in them.

### Executable examples (already in this repo, not invented)

- [`packages/kernel/src/enhancers/serialization/persistence-as-link-swap-0.spec.ts`](../../packages/kernel/src/enhancers/serialization/persistence-as-link-swap-0.spec.ts) —
  the exact swap this guide describes, proven.
- [`packages/kernel/src/lib/link-persistence-conformance.spec.ts`](../../packages/kernel/src/lib/link-persistence-conformance.spec.ts) —
  persistence-shaped `link()` usage against the general `Link` contract.
- [`packages/kernel/src/lib/persistence-decompose-0.spec.ts`](../../packages/kernel/src/lib/persistence-decompose-0.spec.ts) —
  the decomposition itself, as a falsifiable spec rather than prose.

### A persistent remote relationship (not storage) is the same shape

`link()` doesn't care whether the endpoint is `localStorage`, an HTTP
resource, or a WebSocket — only `get`/`set`/`subscribe` differ. See
[composition-recipes.md](composition-recipes.md) for the sibling recipes this
guide shares its model with (staged editing, optimistic writes with server
reconciliation).
