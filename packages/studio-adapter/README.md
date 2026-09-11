# @signal-tree/studio-adapter

Opt-in bridge from the SignalTree kernel observation seam to Studio.

**Status: opt-in development tooling.** Provides:

1. **Session tree identity.** The kernel's `TreeId` promises equality and
   `Map`-key use and nothing else — not persistence, not serialization
   identity. A `.ststudio` bundle keyed on one would name a tree that does not
   exist on reload. `createTreeIdentityRegistry()` maps runtime identity to a
   serializable `StudioTreeId`, and only the session-side value leaves this
   package.
2. **Normalization** of kernel turn records into `@signal-tree/studio-query`
   session records.
3. **Bounded observation.** Current values, state shape, retained committed
   turns, and supported external realizations, with explicit limits and gaps.

The adapter consumes the kernel observation seam at
`@signal-tree/kernel/internals`; it does not import `causal-runtime` modules.
Committed history requires the transactions enhancer. Other inspection
capabilities are checked per tree. Install matching SignalTree versions and
ensure the application facade and adapter resolve one kernel instance.

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

The versioned `MessagePort` protocol supports tree discovery, current-value
and structure reads, bounded history and realization reads, and recording
controls. Pause, resume, and clear affect Studio observation, not application
state. `readInspection` collects its reads synchronously in one JavaScript task;
it is not a server-wide snapshot or a record of pending work.

The handshake nonce matches a response to its request; it is **not**
authentication. Same-realm scripts are inside the application trust boundary.

See the [llms.txt](llms.txt) for the shared SignalTree model and observation boundaries.
