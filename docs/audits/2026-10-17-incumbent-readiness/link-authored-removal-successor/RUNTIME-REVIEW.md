# Independent authored-removal runtime review

2026-10-27. Reviewed the successor diff against f7a0ffd9 in `/private/tmp/link-authored-removal-successor`, independently of implementer verdicts. Owned only the new `packages/kernel/src/lib/authored-removal-independent.spec.ts`; no runtime edits. Reviewed final DESIGN.md/CASES.md and source/raw logs. This is a bounded correctness disposition, not entity integration or release acceptance.

## Exact evidence

Pinned Node v24.15.0 / pnpm 10.17.0. Command for each independent run:

`PATH=/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin:$PATH NX_DAEMON=false NX_NO_CLOUD=true pnpm nx test kernel --skip-nx-cache --testFile=src/lib/authored-removal-independent.spec.ts`

- First six prewritten controls on frozen predecessor: 5 failed / 1 passed, exit 1. `001-baseline.*` and original test copy preserve first identities.
- Expanded exact eight controls on predecessor: 7 failed / 1 passed, exit 1. `002-baseline.*` before/after hashes equal.
- Initial candidate execution: 8 passed, but private.ts changed during the surrounding source snapshot interval. `003-candidate.*` explicitly records this and is not stable-source qualification.
- Frozen final candidate execution: **8 passed**, exit 0. `004-candidate-before.json` and `004-candidate-after.json` report no changed kernel/test hashes; `004-candidate.diff` preserves the runtime changes. Test SHA-256: `4b936b1bdd9894118d87b53a16b9d82d94edf7677aaaca0b18d5a475fc0e174c`.

The eight controls exercise throwing recipient preparation with useful retry; a surviving reentrant sibling write; enrollment/disposal followed by refusal and retry; enrollment/disposal without callback error, permitting coherent completion or atomic refusal plus useful retry; same-key reentry preserving a detached old lifetime; and an equal-undefined field removal producing a held receipt followed by useful absence delivery after confirmation. None substitutes for unchanged original tests.

## Bounded positive result

The forward packet captures authored tombstones separately from O responsibility (`entity-signal.ts:1320–1329`), while `prepareEntityResponsibility` still consumes only ordinary changes (1339–1344). `entityPublicationOrdinary` merges each step's extra removal only if that same step does not already remove the lifetime (`internals/entity-publication.ts:19–25`). This fixes the observed representability loss without a fabricated ordinary inverse contribution. The helper does not normalize by business key or across steps.

Both native support and recipients consume the same semantic stream. Recipient revision validation rejects enrollment/disposal changes during preparation before install. The exact controls establish useful recovery on these tested paths, rather than only silence or exception detection. Proof-only preparation for a held field whose value was already undefined now obtains a receipt and completes usefully; source O remains absent.

## Concrete blockers to the broader authored-removal claim

1. **Collection delivery still bypasses the evidence gate.** `link.ts:552–555` marks collection sources, nested aggregate sources and held rows unsupported. `experimental-publication/private.ts:309–314` then lets unsupported channels bypass `allowed`/`admit` proof checks and uses the original durable gate. This is sufficient to explain an owned collection removal sending when p confirms while foreign q remains pending. The source's proof can be correctly captured yet unenforced. Raw root `005-focused-first.log` observes exactly the destination-first failure at authored-removal-obligations.spec.ts:25. Do not reinterpret this as evidence that the foreign window disappeared from native capture or that p was necessarily an empty terminal transaction.

   `collection.declare` separately rejects before callback at lifecycle.ts:239, also observed in raw 005. That is a source-coverage boundary. Neither repairing observation-gate enforcement nor qualifying the existing conservative path automatically authorizes a new public declaration surface.

2. **Collection native evidence is also omitted during aggregate proof composition.** Source inspection independently substantiates this second boundary. `link.ts:567` treats a non-writable collection as aggregate; only nested collections register a projection field at 573. For a collection's own recipient, `prepareSourceProjection` receives no field at 596. `private.ts:201` stores this revision in `completedValueFact`. But the aggregate branch of `projectionSupport` at 151 combines summary, baseline structure and parent presence only, whereas `completedValueFact` appears only in the nonaggregate branch. `ready` then replaces the revision proof with that result at 202–203. Thus enabling the gate alone would not restore the collection's missing native obligations. This is a source-derived finding; the current unsupported-channel bypass independently explains the observed send, so the raw failure does not isolate both faults experimentally.

No collection-as-field workaround or API enablement was implemented during review. Both boundaries need explicit bounded correction/qualification before collection D/I/W/V enforcement can be accepted.

## Selected physical-only marker

`tree-realization-adapter.ts:1449,1455,1458` now passes `publication:'physical'` to its structural realization commits. `entity-signal.ts:1326` uses that marker to suppress the **new supplemental authored removal**. Explicit selected ordinary realization still supplies its effects separately. This is a valid containment of the new rule: a logistics tombstone cannot become extra removal authority merely because the new forward mapper sees it.

It is not a complete selected-installation fix. The marker does not suppress or replace the inherited `ordinaryPlan.byStep` stream at 1328. Those physical plans still call frame preparation/publication from inside the selected install loop, and `commitAndProjectEntityMutationFrame` finalizes, installs and completes each such unit (1358–1372). The existing full selected-domain preparation/rich-capture gate therefore remains necessary. I found no new counterexample caused solely by adding the marker, but the marker and passing forward controls cannot establish selected atomicity or exact selected support transport. Keep the inherited gate open; do not count it passed.

## Remaining limits

Both retirement routes are unchanged: explicit forget calls unconditional support retirement; automatic bare forgetting bypasses it. The reviewed native negative-evidence survival/lifecycle boundary remains blocked. Source-input window, retirement, selected-unit and original semantic failures remain separate obligations. The exact eight-control pass establishes the named forward preparation/completion behaviors only. Original root 005 ordinary-order results and other suites must retain their own artifact identities; no summed coverage claim follows.

Disposition: **bounded forward-removal capability demonstrated; broader authored-removal integration remains blocked** by collection proof composition/enforcement and the explicitly retained native-lifetime/selected-preparation gates.
