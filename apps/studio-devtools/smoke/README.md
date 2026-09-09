# Browser transport smoke test

The first browser-only assumption in the stack. Everything below the transport
is covered by Node tests; this is the part that cannot be.

```bash
npx esbuild apps/studio-devtools/smoke/page-entry.ts --bundle --format=esm \
  --outfile=apps/studio-devtools/smoke/bundle.js \
  --alias:@signal-tree/kernel/internals=./packages/kernel/src/internals.ts \
  --alias:@signal-tree/kernel=./packages/kernel/src/index.ts \
  --alias:@signal-tree/studio-adapter/bridge=./packages/studio-adapter/src/bridge/index.ts \
  --alias:@signal-tree/studio-adapter=./packages/studio-adapter/src/index.ts \
  --alias:@signal-tree/studio-query=./packages/studio-query/src/index.ts

node apps/studio-devtools/smoke/serve.mjs   # :8791
```

Then in the page console, create a `MessageChannel`, `window.postMessage` the
connect frame transferring `port2`, and issue the three commands.

## Result — Chromium, 2026-09-09

| # | Step | Result |
|---|---|---|
| 1 | page with `installStudioBridge()` + one attached tree | loads clean |
| 2 | initiator creates channel, transfers `port2` via `window.postMessage` | **port adopted** |
| 3 | `hello()` | `{ protocol: 1, schema: 1 }` |
| 4 | `listTrees()` | `[{ id: 'tree-0001', label: 'AppTree', capabilities: ['committed-transactions'] }]` |
| 5 | `readConfirmedTurns('tree-0001')` | the real committed turn — `promoCode null→"SAVE20"`, `discount 0→2400`, `total 12000→9600`, `retention.truncated: false` |
| 6 | unknown tree id | `STUDIO_TREE_NOT_FOUND` |
| 7 | `protocol: 99` | `STUDIO_PROTOCOL_MISMATCH { expected: 1, received: 99 }` |
| 8 | `tree.destroy()` then `listTrees()` | `[]` — attachment evicted through the tree's own cleanup |
| 9 | page with no `installStudioBridge()` | **no response**; panel renders "No Studio-enabled SignalTree found" |

Transferable `MessagePort` crosses `window.postMessage` and the bridge adopts
it, so the §4.0 initiator-owns-the-channel design holds in a real browser.

## ⚠️ What this does NOT prove

**The isolated-world → main-world hop is still untested.** The run above was
main-world → main-world: it exercises the same `window.postMessage` + transfer
mechanism the content script will use, but not across Chrome's content-script
world boundary.

That specific question — does a transferred `MessagePort` survive
isolated→main — is only answerable by loading the unpacked extension in
Chromium. If it does not, per the plan **only the transport changes**: a
main-world shim injected through Chromium's supported MAIN-world mechanism,
with serialized messaging instead of a transferred port. The semantic stack
above is untouched either way, which is the point of the layering.

Do not build that fallback until the browser proves it is needed.
