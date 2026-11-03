# Immutable same-tree owner window: first revision rejected

Source baseline 3a20d56c7b4dce75bf9b4a50f43f0386cfd75b06. Private loader instrumentation only, production untouched. No API or budget changes. One implementation, no runtime repair after first executed mechanism counterexample.

## First failures

First command did not execute: window.ts incorrectly imported withWriteContext from index. Original source frozen in pre-first/ and original build error first-window.log. Corrected test import only to internal write-context. No assertions or private algorithm changed.

First executed window results preserved first-executed-window.log, first-window-traces.json, first-window-receipts.json, first-window-bundle.mjs. ABA final-progress assertion fails: initial y42 captures P; Q opens; y99 then y42 captures P,Q; both confirm; no delivery. 45 assertions pass and 1 fails across 11 asserted scenarios. All 10 other asserted scenarios pass; cross-tree is separately unqualified negative witness and sends7 from another tree's pending source.

Trace tree6: ticket21 y42 blockers[1]; tickets23/24 y99/y42 blockers[1,2]. Existing path notifier intentionally elides net-equal batch (path-notifier.ts502–510). Link retains ticket21 while latest map ticket24. Terminal wake checks fail identity even after both confirmation outcomes exist. This is lost revision transport across value-level coalescing, not missing outcome recording. Do not remove coalescing or reuse oldticket21 to make it green. STOP condition met.

## Passing bounded capability

Earlier captured owner confirms while later owner remains pending: direct42 and synchronous reactive copy8 both progress. Already-pending P,Q both block until confirmed. Rejected ticket held; later actual authored43 captures remaining Q and releases after confirmation. Later overwrite and sending-observer replacement survive; opened-listener writes capture P; failed rollback remains held until successful confirmation. Realization/restoration metadata and foreign transaction token remain held. Existing public lifecycle observer receives opened and confirmed normally; no observer attach replaced.

## Delivery preservation

Unchanged targeted.ts: 32 checks pass;2 old unknown-confirm assertions fail intentionally because required new behavior sends42 and resolves settlement. Those original assertions remain verbatim. Unchanged witness.ts retains its known tree-destruction failure and destroyed-settlement harness error; other bridge before-confirm controls pass. Controls are not a production suite or native-framework proof.

## Limits

Only scalar same-tree window evidence. Cross-tree sourcePending status not exposed by public handle: source op remains unsettled until explicit rollback after captured output. Receipt explicitly shows source lifetime open; do not infer independence. Lifecycle/read/latest metadata retained in module Maps, not qualified for reclamation. Dispose removes eligibility listeners only. Incoming authority uses previously reviewed research bracket, not general callback provenance. No universal allocation recovery claim: delete-latest-before-capture invalidates stale eligibility on ordinary capture exceptions but no staged fault injection added here. No full kernel types/runtime qualification.

## Commands

Using Node24.15.0 from .nvm, worktree package dependencies:

    ENTRY=window.ts node /private/tmp/link-owner-window-impl/loader.mjs
    TARGETED=1 node /private/tmp/link-owner-window-impl/loader.mjs
    node /private/tmp/link-owner-window-impl/loader.mjs
    node node_modules/typescript/bin/tsc --strict --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck /private/tmp/link-owner-window-impl/private.ts

First command replay overwrites generic traces.json/bundle.mjs/receipts.json; first-window-* preserves first executable run. Generic traces now original unchanged witness run; targeted-* preserves targeted run. Source transform receipt matches exact replacement counts and original/loaded SHA256 for every bundled kernel source.
