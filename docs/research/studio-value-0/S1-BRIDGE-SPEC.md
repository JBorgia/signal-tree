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

### DECISION — attach does NOT throw when a capability is missing

**Frozen 2026-09-09. Do not "simplify" this into a throw.**

`attachStudio` succeeds for **any** explicitly attached tree, including one
built without `transactions()`. It advertises what that tree can do:

```ts
{ id: 'tree-0001', label: 'AppTree',      capabilities: [] }
{ id: 'tree-0002', label: 'CheckoutTree', capabilities: ['committed-transactions'] }
```

Throwing looks clean for S1 and ages badly immediately. It would make the
generic attachment API mean *"attach this tree provided it supports the one
feature Studio happens to implement today"* — so every slice that widens the
capability set (S2 realizations, S3 restoration, S4 structural) would change
what `attachStudio` accepts. Capability is a property of a tree's enhancer
composition, not a precondition for being inspectable.

A read against a tree lacking the capability is a **structured refusal**, not
an exception and not `[]`:

```ts
{ ok: false, error: { code: 'STUDIO_CAPABILITY_UNAVAILABLE',
                      capability: 'committed-transactions' } }
```

which the panel can state truthfully:

```text
AppTree
Committed transaction history
  Not available — this tree does not use transactions()
```

Same rule as everywhere else: **refuse, don't approximate.**

Strict wiring is available for an application that *expects* inspection, and it
is opt-in:

```ts
attachStudio(tree, { label: 'AppTree', require: ['committed-transactions'] });
```

That form may throw during development, because there the caller has stated the
expectation. The default form may not.

### Zero-cost chain

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

`label` is presentation only. Never identity, never a key; two trees may share
one.

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

## 4. Transport, and an honest threat boundary

**No global.** Not `window.__SIGNALTREE_STUDIO__`, not any object hung off the
page with trees or internals reachable from it. The bridge exposes a message
protocol, never an object graph.

```text
extension  --connect request-->  page bridge
page bridge  --validates protocol, returns MessagePort-->  extension
everything after: the private MessagePort
```

The page bridge listens **only while at least one tree is attached**.

### DECISION — the handshake is not authentication

**Frozen 2026-09-09. Do not describe the nonce as security.**

A page-realm bridge is reachable by any script in the inspected page's main
JavaScript realm. A nonce delivered through a page-visible channel is visible to
that same script, so it **cannot authenticate the extension**. What it is
actually for:

```text
protocol handshake       yes
version negotiation      yes
matching a response to its request      yes
avoiding accidental collisions          yes
extension authentication                NO
authorization secret                    NO
```

Calling it security would be exactly the kind of claim this project keeps
refusing to make.

### The boundary, stated

> **Scripts executing in the inspected application's main JavaScript realm are
> inside the application trust boundary. Studio does not attempt to protect
> diagnostic data from a fully compromised same-origin application.**

Defensible, because hostile same-origin script can already read the DOM, hook
`fetch`/XHR, observe input, read permitted storage, monkey-patch runtime
functions and exfiltrate current application state.

⚠️ **This is not zero additional exposure, and must not be written up as
though it were.** Studio makes *historical* state reachable that would
otherwise have to be captured live. The increment is real; it is accepted for a
development-only surface, and that acceptance is what §A below has to earn.

### A. The real security boundary: absent in production

Not "disabled" — **absent**.

```text
production      no attachStudio call
                no registry, no bridge, no history endpoint

development     explicit attachStudio(...)
                bridge exists while >= 1 attachment exists
```

This is the boundary that actually holds, and it is why the zero-cost-unused
chain in §1 is a security property and not only a bundle-size one.

### B. Redaction happens before the transport

Not required for S1 (local development, real values). But the records must be
shaped so this can be added **before data reaches the page transport**, never
as a filter in the extension:

```ts
attachStudio(tree, { redact: ['auth.*', 'payment.cardNumber'] });
```

Redacting after arrival would mean the data already crossed the boundary.

### C. Remaining properties

- read-only commands; no mutation capability of any kind
- versioned protocol, schema-validated on both sides
- no `eval`, no function transfer
- no tree objects, signals or readers cross the boundary — records only
- structured-clone-safe payloads exclusively
- no provider credentials ever cross it
- bridge removed by `uninstallStudioBridge()` (see §4.2)

## 5. Wire contract — frozen

Three commands. No AI, no source maps, no mutation, no streaming, no generic
query RPC. `studio-query` stays local to the panel and operates over returned
records.

```ts
type StudioBridgeRequest =
  | { protocol: 1; id: string; command: 'hello' }
  | { protocol: 1; id: string; command: 'listTrees' }
  | { protocol: 1; id: string; command: 'readConfirmedTurns'; treeId: StudioTreeId };

type StudioBridgeResponse<T> =
  | { protocol: 1; id: string; ok: true; value: T }
  | { protocol: 1; id: string; ok: false; error: StudioBridgeError };

type StudioBridgeError =
  | { code: 'STUDIO_TREE_NOT_FOUND' }
  | { code: 'STUDIO_TREE_DESTROYED' }
  | { code: 'STUDIO_CAPABILITY_UNAVAILABLE'; capability: StudioCapability }
  | { code: 'STUDIO_PROTOCOL_MISMATCH'; expected: number; received: number };
```

### Capability belongs to the TREE, not to Studio

```ts
interface StudioBridgeTree {
  readonly id: StudioTreeId;
  readonly label?: string;
  readonly capabilities: readonly StudioCapability[];
}

// S1
type StudioCapability = 'committed-transactions';
```

⚠️ A global "Studio supports transactions = true" would be subtly wrong: two
trees in one application can have **different enhancer compositions**. The
handshake carries only protocol and schema versions; what a given tree can
answer travels with that tree.

```ts
// hello
{ protocol: 1, schema: 1 }

// listTrees
[ { id: 'tree-0001', capabilities: [] },
  { id: 'tree-0002', capabilities: ['committed-transactions'] } ]
```

Later slices widen the union with no protocol redesign:
`transaction-settlement`, `realizations`, `restoration`, `structural-effects`.

### readConfirmedTurns payload

```ts
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

## 4.0 DECISION — the initiator owns the MessageChannel

**Frozen 2026-09-09. Corrects the first implementation.**

The page bridge **never replies through `event.source`**. The first cut did, and
it rested on a false assumption: that the party opening the connection is a
page `Window` whose `WindowProxy` arrives as `event.source`. A DevTools panel is
not a page window — it reaches the page through a content script — so
`event.source` is the wrong reply channel and the shape of it hid that.

**The initiator creates the channel and transfers a port in.** The bridge only
accepts one:

```ts
// content script (extension isolated world)
const channel = new MessageChannel();
window.postMessage(
  { type: 'SIGNALTREE_STUDIO_CONNECT', protocol: 1, nonce },
  '*',
  [channel.port2],
);
// content script retains channel.port1
```

```ts
// page bridge (application main world)
function onWindowMessage(event: MessageEvent) {
  if (event.source !== window) return;
  if (event.data?.type !== STUDIO_CONNECT) return;
  if (event.data.protocol !== STUDIO_PROTOCOL_VERSION) return;
  const port = event.ports[0];
  if (!port) return;
  connectStudioPort(port);
}
```

No reply frame, no `event.source`, no assumption about who the sender is.

## 4.1 The content script is the transport adapter

Two different channels meet there, and translating between them is exactly its
job:

```text
DevTools panel
  |  chrome.tabs.connect(inspectedWindow.tabId)
  v
content script                     (extension isolated world)
  |  window.postMessage(..., [port2])
  v
Studio page bridge                 (application main world)
  |  MessagePort
  v
studio-adapter registry
```

⚠️ **The content script knows nothing about transactions, trees, effects,
retention, or what a `StudioTreeId` means.** It forwards envelopes:

```ts
interface TransportEnvelope { id: string; payload: unknown }
```

Schema and protocol validation stay where they already are, in
`@signal-tree/studio-adapter/bridge`.

```text
studio-query        semantics / query
studio-adapter      attachment + capabilities + registry
adapter /bridge     protocol
content script      transport only
studio-devtools     UI shell
```

### Two boundaries, only one of which is a trust boundary

```text
panel <-> content script      Chrome extension messaging
content script <-> page       NOT authentication against hostile same-realm code
```

The `MessagePort` buys private subsequent traffic, request/response isolation,
version negotiation and clean lifecycle. It does **not** prove the party on the
application side is trustworthy, and §4's threat model is unchanged.

The real security property is still absence:

```text
production never imports @signal-tree/studio-adapter/bridge
  -> no installer, no connect listener, no historical-state endpoint
```

## 4.2 DECISION — who installs the bridge

**Frozen 2026-09-09.**

The registry is module-private to `studio-adapter` in the page realm, so the
bridge must be installed there. It is **not** installed by `attachStudio`
behind an environment guard.

```ts
// dev-only setup, browser builds
import { attachStudio } from '@signal-tree/studio-adapter';
import { installStudioBridge } from '@signal-tree/studio-adapter/bridge';

installStudioBridge();
attachStudio(appTree, { label: 'AppTree' });
```

⚠️ **A runtime `typeof window` guard would put the bridge in every bundle.**
This repository has already paid for that lesson once: `restoration()` reaches
an app tree only through a `debug-enhancers.ts` module that `fileReplacements`
swaps for an empty one, and the eslint `no-restricted-imports` rule exists
because *"a runtime isProduction gate cannot be tree-shaken, which no bundler
can fold, so it ships in — and runs in — production."* An `isBrowser` check is
the same shape.

A separate entry point is **structural** gating: a build that does not import
`/bridge` does not contain it. Same mechanism as the kernel's `/adapter` and
`/internals` subpaths.

Explicit call rather than a self-installing import, so `"sideEffects": false`
stays truthful and the install point is greppable.

## 4.3 DECISION — bridge lifetime is installation, not attachment

**Frozen 2026-09-09. This supersedes "bridge removed when the last tree
detaches."**

The earlier rule made two states indistinguishable: a page with Studio
installed but no trees currently attached looked exactly like a page with no
Studio at all — both are silence. That is unhelpful *and* untruthful, since
those are different facts.

```text
installStudioBridge() never called   no bridge, no response
                                     -> "No Studio-enabled SignalTree found"

installed, zero trees attached       hello answers; listTrees() -> []
                                     -> "Studio enabled, no trees attached"

installed, trees attached            hello answers; listTrees() -> [...]
```

This does not weaken the security boundary at all. The bridge still exists only
because a developer explicitly installed it in a development build; production
never calls `installStudioBridge`, so §4A is unchanged — **absence, not
disablement**.

It also stops the panel connection flapping on a page that attaches and
detaches trees dynamically.

**Registry teardown is unaffected and stays as it is:** the registry is still
dropped on the last detach, because that is about not retaining tree
references. Bridge lifetime and registry lifetime are separate concerns, and
`listTrees()` reads `peekRegistry() ?? []` — a dropped registry means zero
attached trees, which is a meaningful answer rather than an error.

`uninstallStudioBridge()` removes the listener and the port.

## 5.1 Registry lifecycle

```text
first attachStudio()      create registry lazily
                          assign StudioTreeId
                          register tree cleanup
                          ensure bridge available

second attachStudio()     same registry

tree.destroy()            remove attachment automatically
                          invalidate its StudioTreeId

detach()                  remove attachment

last attachment removed   destroy bridge
                          drop registry
                          release all Studio references
```

### Id allocation outlives the registry

⚠️ **Two rules here quietly conflict, and a test caught it.** "Drop the registry
with the last detachment" and "ids are never recycled" cannot both hold if the
counter lives inside the registry — dropping it restarts numbering, so a later
tree is handed `tree-0001` again and a panel still holding that id silently
reads a *different* tree's history. That is the cross-tree confusion C11 and
`effectKey` exist to prevent, arriving through the front door.

Recycling is the dangerous half, so **the ordinal counter survives registry
drops**. It is a monotonic integer, not a reference: it pins no tree, no reader
and no DOM, so "release all Studio references" still holds exactly. The
runtime→session mapping *is* dropped with the attachment, so a rebuilt tree is
a new tree rather than inheriting a retired id.

### Two absences that are not the same

```text
id never existed, or its attachment was removed   STUDIO_TREE_NOT_FOUND
reader observed destruction while still attached  STUDIO_TREE_DESTROYED
```

Because destroy cleanup evicts automatically, the second will rarely cross the
wire — most races resolve as NOT_FOUND. That is fine. **Keep the distinction in
the lower reader contract, where it is already proven, and do not manufacture a
bridge scenario just to exercise it.**

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

## Layering — settled

```text
application code
  |  attachStudio(tree, options)          <- the whole public experience
  v
studio-adapter
  |  probeSignalTree(tree)                <- internal glue, the one place
  v                                          that knows both sides
StudioTreeProbe
  +-- confirmedTurnReader   (kernel /internals)
  +-- treeRuntimeId         (kernel /internals)
  +-- onDestroy             (tree.registerCleanup)
```

`StudioTreeProbe` stays, as an **adapter implementation detail** — it keeps most
adapter tests free of real trees and isolates the adapter if kernel internals
move. It is not a product API: application code never constructs one.
`attachStudioProbe` remains exported for that seam; `attachStudio` is what
callers use.

**Capabilities are derived, never configured.** A caller cannot assert a
capability a tree lacks; `require` can only tighten an expectation against
reality, never fabricate it.

**Identity is separate from capability.** `treeRuntimeId` was added to kernel
`/internals` precisely because a tree without `transactions()` has no reader —
folding identity into the reader would leave capability-less trees with no
identity, making two of them indistinguishable.

**A failed `require` consumes nothing** — no registry, and no session id, since
allocation happens only after the checks pass. Repeated bad wiring cannot
advance the observable id sequence for trees that never entered Studio.

## Implementation order

```text
1. adapter registry + attachStudio/detach + destroy eviction   DONE
2. real-tree glue (probeSignalTree) + integration tests        DONE
3. page bridge (handshake, MessagePort, 3 commands, versioning) <- next
4. MV3 shell around the existing studio-devtools projection
```

By the time the bridge is written the registry is fully coherent — every
attached tree has a session id, a label, derived capabilities, real read
functions and destroy lifecycle — so **the transport is dumb serialization**.
It never touches a kernel tree, never sees `TreeId`, never wires destruction
and never infers a capability.

The projection in `apps/studio-devtools` is already the panel body and needs no
change to be rendered by a real extension — which is the point of having kept
it browser-independent.
