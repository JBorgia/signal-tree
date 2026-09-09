# S1 — Studio page bridge contract

> Small enough to turn straight into code. Written after the kernel read seam
> landed, so the contract is narrow rather than speculative.
>
> Status: **specification. Registry and bridge not implemented.**
> The destroyed-tree lifecycle it depends on **is** implemented and proven
> (`confirmed-turn-reader.spec.ts`, acceptance 9).

## The governing decision

> **Studio does not auto-discover arbitrary SignalTree trees. It enumerates
> trees explicitly attached to Studio.**

That single choice removes a whole category of work and risk: no registry in
the kernel, no page scanning, no heuristic detection, and no way for an
installed extension to reach a tree the application did not offer.

```text
application
    │  explicit dev-only attach
    ▼
studio-adapter
    ├─ lazy registry of attached trees
    ├─ TreeId -> StudioTreeId
    ├─ ConfirmedTurnReader (from @signal-tree/kernel/internals)
    └─ read-only page bridge
             │
             ▼
       MV3 DevTools panel
```

**Not claimed:** "SignalTree detected but Studio not enabled." There is no
truthful independent detection mechanism today, and inventing one for nicer
copy would be exactly the kind of fabricated fact this project keeps refusing.
The honest empty state is below.

## 1. Opt-in API — framework-neutral

```ts
const detach = attachStudio(tree, { label: 'AppTree' });
```

Lives in `@signal-tree/studio-adapter`. Angular sugar (`provideStudio(...)`)
can wrap it later; the mechanism must not live in Angular DI.

**Zero-cost chain, and it is the reason for the lazy construction below:**

```text
no attachStudio()
  -> no registry
  -> no page bridge
  -> no listeners
  -> no Studio state
```

⚠️ **Importing `studio-adapter` must not create the registry.** Module-load side
effects would put Studio state in every bundle that so much as imports the
package. The registry is created on the FIRST attachment and torn down with the
last detachment.

`label` is presentation only. It is never identity, never a key, and two trees
may share one.

## 2. Registry — in the adapter, never the kernel

```ts
interface AttachedStudioTree {
  readonly studioTreeId: StudioTreeId;
  readonly label?: string;
  readonly reader: ConfirmedTurnReader;
}
```

Keyed internally by the kernel's runtime `TreeId`, which is exactly the one use
its contract permits (equality / `Map` key) and which **never leaves the
runtime**. Only `StudioTreeId` crosses the bridge.

## 3. Lifecycle — destruction is a first-class event

Proven behaviour the bridge builds on:

| State | Reader | Bridge |
|---|---|---|
| no `transactions()` enhancer | `confirmedTurnReader` returns `undefined` | `attachStudio` refuses: nothing to read |
| live, nothing committed | reader returns `{ turns: [], retention }` | tree listed, zero turns |
| **destroyed** | **throws `StudioTreeDestroyedError`** | tree unlisted; stale reads refuse |

```text
tree destroyed
  -> adapter unregisters it (via tree.registerCleanup)
  -> listTrees() no longer returns it
  -> a stale reader throws STUDIO_TREE_DESTROYED, never []
```

⚠️ `[]` means *a live tree with no retained turns*. A destroyed tree returning
`[]` would let the panel report "nothing happened" about a tree that is gone —
a confident wrong answer, which is worse than a refusal.

Destruction also evicts the `TreeId -> StudioTreeId` entry. A rebuilt tree is a
new tree and gets a new session id; ids are never recycled within a session.

## 4. Transport — a message protocol, not an object graph

**No global.** Not `window.__SIGNALTREE_STUDIO__`, not any object hung off the
page with trees or internals reachable from it.

```text
extension  --"SIGNALTREE_STUDIO_CONNECT" + nonce-->  page bridge
page bridge  --validates protocol, returns MessagePort-->  extension
everything after: the private MessagePort
```

The page bridge listens **only while at least one tree is attached**.

Security properties, which matter more than the specific primitive:

- explicit development opt-in — an installed extension cannot make a production
  build expose anything, because the production build never calls `attachStudio`
- read-only commands; no mutation capability of any kind
- versioned protocol, schema-validated on both sides
- no `eval`, no function transfer
- no tree objects, signals or readers cross the boundary — records only
- structured-clone-safe payloads exclusively
- no provider credentials ever cross it
- bridge removed when the last tree detaches

## 5. Command set — deliberately tiny

```text
hello()
listTrees()
readConfirmedTurns(treeId)
```

No AI. No source maps. No mutation. No streaming. No generic query RPC.
`studio-query` stays local to the panel and operates over returned records.

```ts
interface StudioBridgeHello {
  readonly protocol: 1;
  readonly studioSchema: 1;
  readonly capabilities: readonly StudioCapability[];
}

interface StudioBridgeTree {
  readonly id: StudioTreeId;
  readonly label?: string;
  readonly capabilities: readonly StudioCapability[];
}

interface ConfirmedTurnsResponse {
  readonly treeId: StudioTreeId;
  readonly retention: {
    readonly truncated: boolean;
    readonly firstAvailableTurnId?: number;
  };
  readonly turns: readonly StudioTurn[];
}
```

`retention` crosses the bridge because bounded retention is not causal
completeness, and the panel must be able to say so.

Errors are codes, not strings to parse:

```text
STUDIO_TREE_DESTROYED     the tree is gone; not an empty history
STUDIO_TREE_UNKNOWN       no such StudioTreeId in this session
STUDIO_PROTOCOL_MISMATCH  handshake rejected
```

## 6. Versioning — from day one

```ts
const STUDIO_PROTOCOL_VERSION = 1;  // transport/envelope shape
const STUDIO_SCHEMA_VERSION = 1;    // record shapes
```

Capabilities grow per slice, so the panel never infers support from a version
number:

```text
S1   committed-transactions
S2   + realizations
S3   + restoration
S4   + structural-composition
```

Which lets the panel be explicit instead of silently partial:

```text
AVAILABLE
  committed transaction effects

NOT SUPPORTED BY THIS RUNTIME
  realization
  restoration
```

## 7. Empty state — honest

```text
No Studio-enabled SignalTree found on this page.

Studio reads trees your application explicitly attaches in development.
[Setup]
```

Not "SignalTree detected but Studio not enabled" — see §0.

## 8. No streaming yet

Snapshot-first, matching the kernel seam. The panel polls modestly while open
(500ms–1s) or refreshes on user action.

> **The kernel must not acquire a notification mechanism merely because Chrome
> wants a reactive UI.**

When polling is visibly inadequate, investigate the cheapest truthful
notification point then. Until then, do not prepay for it.

## Implementation order

```text
1. adapter registry + attachStudio/detach + destroy eviction   <- next
2. page bridge (handshake, MessagePort, 3 commands, versioning)
3. MV3 shell around the existing studio-devtools projection
```

The projection in `apps/studio-devtools` is already the panel body and needs no
change to be rendered by a real extension — which is the point of having kept
it browser-independent.
