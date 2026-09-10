# studio-devtools

SignalTree Studio DevTools UI. **Private — never published.**

**Status: S2 — the live Why? vertical, end to end in a real Chrome panel.**

```text
┌──────────────────────────────────────────────────────────────┐
│ SignalTree Studio                                    LIVE    │
├─────────────────┬────────────────────────────────────────────┤
│ Trees           │ AppTree                                    │
│                 │                                            │
│ > AppTree       │ Realization capture                        │
│   BareTree      │ ● ACTIVE                  [ Stop Capture ] │
│                 │ 1 effect retained                          │
│                 │ Integrity: complete                        │
│                 │                                            │
│                 │ Path                                       │
│                 │ [ cart.total______________ ] [ Why? ]      │
│                 │                                            │
│                 │ Current value                              │
│                 │ 10200                                      │
│                 │                                            │
│                 │ WHY?                                       │
│                 │ FACT     T1 committed 9600.                │
│                 │ FACT     T2 committed 9800.                │
│                 │ FACT     External realization changed      │
│                 │          9800 → 10200.                     │
│                 │ DERIVED  10200 superseded the previously   │
│                 │          visible 9800.                     │
│                 │ UNKNOWN  No retained evidence identifies   │
│                 │          which authored operation caused   │
│                 │          the realization.                  │
└─────────────────┴────────────────────────────────────────────┘
```

Deliberately plain. The state picker, River, Pulse and causal graph are
downstream of *using* this, not of mockups. Clicking an evidence reference
opens the raw retained record — the first interaction model for the eventual
causal view, and it earns trust only by being literal.

## The panel computes no semantics

`whyValue()` (`src/why-value.ts`) classifies every line as FACT / DERIVED /
UNKNOWN and attaches the evidence supporting it; `panel/main.ts` maps that to
DOM. Two consequences are load-bearing:

- The **current value is a live `readCurrentValue` read**, never
  `latestRealization.after`. Reading it out of the evidence would make
  "explained by retained evidence" true by construction — and that warning is
  the one thing the panel has to be able to deny.
- Realization state has **three render states** (`unsupported` /
  `supported+inactive` / `supported+active`) and only the last may read as "no
  realizations happened".

Capture is explicit. **Nothing records because DevTools opened**, and detach or
`tree.destroy()` releases the observer below the UI — the panel is never asked
to remember to press Stop (`CAPTURE-LIFECYCLE-0`).

## Build and run

```bash
node apps/studio-devtools/build.mjs        # -> dist/studio-devtools
node apps/studio-devtools/smoke/build.mjs  # -> smoke/bundle.js, smoke/demo.js
node apps/studio-devtools/smoke/serve.mjs  # :8791
```

Then: `chrome://extensions` → Developer mode → **Load unpacked** →
`dist/studio-devtools` → open <http://localhost:8791/demo.html> → DevTools →
**SignalTree**.

The demo commits two transactions at load (`cart.total 12000 → 9600 → 9800`).
Select **AppTree**, press **Start Capture**, then press *Server corrects total
→ 10200* and ask **Why?** about `cart.total`. The realization is observable
only because capture was already running, and it carries no `transactionId` —
which is what makes the UNKNOWN line real rather than decorative.

`BareTree` is attached too, so the `realizations` refusal is visible in the
same run.

## Automated verification

```bash
node apps/studio-devtools/smoke/verify-extension.mjs
```

Runs the **shipped `dist/studio-devtools`** in a real Chromium and drives the
whole command set through `chrome.tabs.connect` → content script → page bridge,
adding only `web_accessible_resources` for a driver page that stands in for the
panel.

⚠️ **It cannot cover `chrome.devtools.panels.create` or
`chrome.devtools.inspectedWindow.tabId`.** Playwright cannot drive a DevTools
window, so those two calls are the only part of the chain that stays
manual-only. Everything below them fails here rather than in a manual run —
which is how the missing `host_permissions` entry and a `readCurrentValue`
defect (a missing path answering `{ kind: 'value', value: undefined }`, so
absence was indistinguishable from a real `undefined`) were both caught.

## Not observed by this slice

- attempted writes that did not survive (net effects only — MO-1B)
- pending or discarded transactions (S1P)
- restoration lineage (S3)
- nested and entity-structural composition (S4)
- which authored operation caused a realization (SUPERSESSION-0: **WEAK**)

Spec §22.1.11: unsupported compositions are refused, never silently omitted — a
newcomer who trusts a confident partial answer is worse off than one who got
none.
