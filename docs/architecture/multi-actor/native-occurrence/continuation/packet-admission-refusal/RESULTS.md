# Precise private frozen-shell refusal — bounded successor

New candidate based only on frozen R1 (`/private/tmp/st-packet-index-admission-r1/candidate`, manifest SHA256 9863ad3f6955407e79e2663c4060f505b5f71c6f49cd96bc6e492335b09cd464). R1 and all its frozen artifacts remain unchanged. No public API/producer changes, map-reuse optimization, certificate redesign, budget change or general cleanup.

## Exact correction

Only `internals/entity-publication.ts:58–67` changes. For an already-frozen edit not in the existing source-owned edit WeakSet, admission now rejects a mutable non-null field-name array or mutable structural descriptor. It no longer freezes either borrowed object in place. The explicit private error is `Frozen entity publication edit contains mutable admission metadata`.

A frozen shell with already-stable nested admission metadata remains accepted. No ownership claim is inferred from that stability. Payloads (`before`, `after`, structural.value), nested caller arrays, restoredFields Maps, endpoints and requirement objects remain outside this shape restriction. Mutable source-issued shells follow the unchanged copying path and preserve literal edit identity. Refusal occurs during source admission before native/responsibility/recipient preparation and installation; the rejected metadata remains unchanged. No new global/local map or successful-public-point scan was added. Frozen-unowned input performs shallow isFrozen checks instead of nested freeze operations; these are not claimed free.

## New controls and preserved reds

New `admission-refusal.spec.ts`: **7/7 pass**, raw `new-controls.log`:

- Mutable fields, mutable structural descriptor, or both inside a frozen shell refuse before callbacks or prepared record installation. Exact borrowed property descriptors remain unchanged; payload/nested-array mutation still works.
- Stable frozen metadata accepts both whole-field and named-field forms, preserving exact edit/endpoint identity and mutable payload/proof references.
- Explicit supported precedence companion uses a stable frozen removal/add pair; proposed11, selected8, restored5 resolves to the exact restored endpoint object and leaves no negative presence.
- Mutable source shell still copies a shared structural descriptor; external field-list/descriptor aliases remain mutable.

Original `packet-index-adversarial.spec.ts` is byte-identical. Its line29 partially frozen input now refuses. Dedicated unchanged-case replay: **1 fail / 23 skip**, raw `original-precedence-refusal.log`; do not report it green or silently substitute the companion. The private accepted-input change is explicit and remains for independent adjudication. The original ownership red/probe and R1 combined failure log are copied into first-failures/.

Full selected replay: **67 pass / 11 fail**, `focused-first.log`. Compared with R1's61 pass/10 fail, seven new controls pass and the previously accepted partially frozen precedence input now fails. The other ten failures remain: three inherited structural-sequence failures and seven preserved private-mutation expectation/diagnostic differences already documented by R1. No failing assertions or test files were changed.

Strict source typecheck passes (`source-types.log`); ratcheted spec-types passes (`spec-types.log`, three inherited improvements, no baseline edits). Original uninstrumented point test remains **15,800 visits**, equal at2k/20k populations, failing unchanged<2,000 (`point.log`). This is not all-green or performance acceptance. No allocation suite rerun or fresh allocation improvement is claimed for this branch-only change.

## Identity and handoff

Node24.15.0/pnpm10.17.0/Vitest4.1.9. SOURCE-SHA256.json/FREEZE.json identify the candidate; runtime.patch is relative to R1. VERIFICATION.json checks every R1 source file and frozen artifact, all inherited candidate tests unchanged, one runtime edit and one new spec. No root or prior candidate edits. The independent reviewer should assess the narrower private input contract, unchanged producer behavior and preserved precedence semantics before integration. Main arranges that review; this report does not grant acceptance.
