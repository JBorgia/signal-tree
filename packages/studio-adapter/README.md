# @signal-tree/studio-adapter

Opt-in bridge from the SignalTree kernel observation seam to Studio.

**Status: S1 scaffold.** Owns two things:

1. **Session tree identity.** The kernel's `TreeId` promises equality and
   `Map`-key use and nothing else — not persistence, not serialization
   identity. A `.ststudio` bundle keyed on one would name a tree that does not
   exist on reload. `createTreeIdentityRegistry()` maps runtime identity to a
   serializable `StudioTreeId`, and only the session-side value leaves this
   package.
2. **Normalization** of kernel turn records into `@signal-tree/studio-query`
   session records.

`ConfirmedTurnReader` is the shape this package **consumes**. The kernel does
not implement it yet: the S1 kernel work is a narrow read-only surface over the
committed turns the transactions enhancer already retains. It is declared
structurally rather than by importing kernel internals, so Studio never depends
on `causal-runtime`.

`disposition` is always `'committed'` here. `pending`/`discarded` arrive with
S1P, from a source that actually observes them — never by inference.


## Bridge (development only)

```ts
import { attachStudio } from '@signal-tree/studio-adapter';
import { installStudioBridge } from '@signal-tree/studio-adapter/bridge';

installStudioBridge();
attachStudio(appTree, { label: 'AppTree' });
```

`/bridge` is a **separate entry point on purpose**. A `typeof window` guard
inside `attachStudio` could not be tree-shaken and would ship the transport in
every bundle — the trap `debug-enhancers.prod.ts` and the repo's
`no-restricted-imports` rule already exist to prevent. A build that never
imports `/bridge` does not contain it, and that absence is the security
boundary: production has no Studio surface to reach, rather than a disabled one.

Three read-only commands — `hello`, `listTrees`, `readConfirmedTurns` — over a
versioned `MessagePort`. The handshake nonce matches a response to its request;
it is **not** authentication, and same-realm script is inside the application
trust boundary (`S1-BRIDGE-SPEC.md` §4).
