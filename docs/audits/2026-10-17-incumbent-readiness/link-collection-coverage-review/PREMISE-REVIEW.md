# Independent coverage adjudication

Read-only review, 2026-10-27. Runtime examined: clean `75416029be1e0c1d9735ed3bdc0f4e8e6c02f775` at `/private/tmp/link-authored-removal-successor`; parent `f7a0ffd9e2e34a23ceae85bff3cd8fa45ecaa82d`; scalar checkpoint `0135ef18567573fec627667fc58bc3e7819cc29e`. Readiness design/authority read at `3c8bbaff`, with earlier revisions identified below. No new execution, edits to repository files, or other reviewer's verdict on this new question.

## Classification

**Collections were within the reviewed contractual mechanism. The final destination-first failure violates that covered obligation-composition mechanism and triggers the recurrence stop under the supplied rule.** The evidence does not support reclassifying the collection family as contractually excluded merely because declarations remain runtime-gated.

The two final failures need distinct labels:

1. **Destination confirmation releases before captured possible-input owner settles:** covered implementation violation, observed in the newly installed authored-removal publication path. This is sufficient for the recurrence stop.
2. **Collection declaration throws unsupported-source before callback:** inherited implementation gap in an explicitly authorized source family, not a new experimental API requirement. The throw itself never executes the authored removal, so it does not independently prove a defect in post-install D/I/W composition. It also cannot justify excluding collections from the reviewed mechanism or accepting R12 as passed. Whether the inherited gate alone would meet a narrower definition of “recurrence” is unnecessary to resolve: failure 1 already does.

## Scope evidence and chronology

**A0**, `docs/audits/2026-10-17-incumbent-readiness/link-a0-operation-contract/A0.md`, originally cited by removal design at `4ed3b6094404f59b940e601626408dbbadbec588`, retained at `3c8bbaff`:

> The relationship creation baseline stays relationship-relative; it is not a new native ordinary store.

Its support table covers removal/omission, entity lifetime/occupancy/order, and selected restoration. It says a transaction's actual authorship remains a lower bound and no independent declaration may clear known support. A0 alone had a known declaration-source gap; that gap received explicit owner selection next rather than being silently inferred away.

**Aggregate source-scope approval**, `link-a1-successor-design/AUTHORITY.md` at `3c8bbaff:14–20`:

> The isolated experimental connection.declare surface may cover branch/root and entity collection sources. Completeness covers all inputs to newly authored facts.

> Actually consumed inputs, transaction authorship and enclosing validation obligations remain lower bounds.

This records the owner's exact response, “Authorize the aggregate experiment and authored-input rule,” selecting `link-a1-installed-operations/AGGREGATE-PROPOSAL.md` at `2782af63d9ad38a905e594190b596b4537ae0143`. That proposal expressly extends the isolated surface to entity-collection connections, preserves per-fact dependencies for omission/re-add/lifetime/rekey/order, and disallows treating mechanism work as a substitute for the source-scope decision. The authority explicitly says it “resolves source coverage/completeness.” It excludes production/API acceptance and leaves dependent runtime paths stopped pending mechanism review; it does **not** exclude collections from the chosen contract.

**Scalar implementation checkpoint**, `link-obligation-scalar-successor/evidence/AUTHORITY.md` at `3c8bbaff`:

> Entity draft61689286 excluded.

> Independent review precedes entity continuation. Recurrence in the covered combination mechanism stops dependent work.

This limits that scalar implementation/qualification. It is not a rescission of aggregate source scope and cannot become a permanent collection exemption after separately authorized entity integration.

**Entity integration**, `link-entity-obligation-integration/SCOPE.md` at `3c8bbaff:3–7`:

> Authorized by the owner to integrate entity paths under the reviewed obligation rules

> Acceptance uses source-owned D/I/W/V facts and recipient-only R

> The implementation must cover point/frame/selected installation, root and native callback input producers, membership/order, disposal and sparse point work.

The same paragraph says unmigrated-path failures are investigation evidence, not automatic recurrences. That is a real distinction, but does not exclude a concrete collection path already installing native publication support and recipient revisions.

**Bounded authored-removal design**, `link-authored-removal-design/DESIGN.md` at `3c8bbaff`, reviewed mechanism steps 4–5:

> collection/root/nested projections reduce that same stream, not separate per-connection removal rules.

> The outgoing removal revision must carry D/I/W/V when applicable, even if O had no value/membership delta.

Step 9 separately gates publication on destination ownership without fabricating O contribution. `CASES.md` explicitly requires R11 hold through destination confirmation while input remains pending and R12 useful declared independent removal after destination confirmation with unrelated owner pending. These are prewritten coverage requirements, not qualification claims. The future experiment scope permits forward removal and proof preparation; retirement, selected installation and other named dependencies remain separately unqualified. It contains no carve-out for collection obligation composition in that forward path.

**Fixed-window successor contract**, `link-membership-successor-contract/SPEC.md` at `392fcf46bb0cfa2e2a77dd6c4cae36c477331d6f`, retained at `3c8bbaff`, requires fixed owner acquisition at authorship and independent discharge of remaining captured owners. Its final paragraph says:

> Stop for recurrence in an already-covered mechanism

> Missing coverage in an explicitly unmigrated producer is work to do, not a passing result.

The failure here does not involve arbitrary JS getter tracking or an explicitly unsupported native producer. It is an accepted ordinary tombstone passed into the newly implemented shared collection publication mechanism.

## Runtime gating is implementation evidence

At `75416029`, `packages/kernel/src/lib/link.ts:552–555` sets `supported` false for direct collections and branches containing discovered collections. The same condition exists at `0135ef18` and rejected aggregate `2d71d733`. `experimental-publication/lifecycle.ts:239` checks it before executing a declaration callback and throws unsupported-source.

That proves a deliberate runtime guard exists, not its contractual authority or complete migration. Earlier `link-a1-aggregate-successor/ENTITY-ADMISSION-MAP.md` explicitly said entity declaration enablement still needed enrollment/per-fact/native-input work and warned against enabling it from a literal-setter pass alone. This was an implementation prerequisite in a read-only map, not an exclusion from the approved source family. No reviewed source-scope reversal was found in the actual authority/design documents examined.

Meanwhile default collections are actively migrated: `link.ts:570–601` subscribes the entity recipient, prepares its projection and receipt through `prepareSourceProjection`; `private.ts:254–255` sends that into the common scalar preparation mechanism. The declaration guard does not disable this installed publication path. Thus it cannot quarantine the first failure as an unimplemented declaration route.

## Raw observations, preserving first failures

Final raw run: `/private/tmp/link-authored-removal-evidence/final-focused.log`, command shown at lines 2–4, `pnpm nx test kernel --skip-nx-cache` focused vector of authored-removal contract, independent, obligations, and original ordinary-order boundary tests. Recorded result: 24 pass / 2 fail, not rerun by this review.

- Lines 27–49: `authored-removal-obligations.spec.ts:25` receives `[[{id:'a',n:1}]]` after destination p confirms, although q is still pending; expected no send. The test opened q before removal authorship and late r afterward. No declaration or unsupported-source path participates in this case.
- Lines 53–69: qualified collection removal throws unsupported-source at lifecycle line 239 before callback; later receipt/progress assertions are unexecuted.

Predecessor raw run: `002-baseline-obligations.log` at f7. Both owner-order variants instead failed their later useful-delivery assertion at line 27, with no send; the qualified case already failed unsupported-source. This separates a newly exposed early-release safety failure from the inherited missing-declaration path. A repaired forward projection now publishes a removal, but its obligation composition fails the covered destination-first invariant.

The final-after manifest hashes match current HEAD files for the obligations test, link.ts, lifecycle.ts, private.ts and entity.ts. The obligations test SHA-256 is `8782bc80b6df36321e7d85d65017b1a943deed4291188b6b573ff97fd595bf79`. Thus this interpretation is tied to the preserved final source/test and raw result, not a later edit or assumed rerun.

## Disposition and limits

Do not proceed by simply enabling `supported` or editing an oracle. Keep both failures and the candidate frozen; dependent runtime continuation requires the recurrence procedure. No new product decision excluding collections is established, and claiming such an exclusion would conflict with explicit scope and R11/R12.

This adjudication does not identify the complete root cause inside proof discharge, prescribe a repair, qualify retirement/selected inverses, or turn prior specification coverage into a passing implementation claim. The precise established result is that the installed forward-removal collection path violated an already-reviewed D/W hold requirement. That conclusion does not rely on interpreting every prewritten case as already implemented.
