# Independent obligation-combination review

Reviewed SPEC SHA-256 `4fcf55af11709c23a23ce2642311396131b416892a15f744446be47eafe7ebf5`, frozen runtime HEAD `b9eef50de5cdded79792ac043ab99ce03d0144ee`, and twelve tests SHA-256 `758335b2450855bc3050ad16b15f3a56ef1cab395fe383858b17aac7880e0d26`. The executable test and PREREG.spec.ts are byte-identical. Complete identities are in INDEPENDENT-REVIEW-SOURCE.json. At inspection the only working-tree addition was the new test; the entity draft is excluded.

Disposition: the proposed D/I/W/V/R separation and the twelve oracles are consistent with the governing contract and the quoted latest owner instruction. No contradictory test oracle is demonstrated. Before using the rule as an implementation specification, make the same-identity normalization limit explicit as described below. This is an internal evidence distinction, not a request for a new owner-selected public behavior. No runtime acceptance or implementation authorization is supplied by this review.

## Bounded correction: normalize newly acquired duplicate reasons, not inherited uncertainty

The sentence “duplicate possible-p must not manufacture an unknown input category when p is already an actual required owner” is broader than its intended safe use. The next sentence explicitly protects inherited uncertainty against a new destination with the same identity, but does not expressly protect inherited W(p) when actual **I(p)** is also present.

Approved392fcf46 says certified native input uncertainty propagates, remains conservative/unknown, and drains by fresh surviving-basis evaluation rather than retroactive declared certification. Adding another actual input with the same owner does not establish completeness of the first input. The owner instruction likewise requires each obligation's own justified discharge. Therefore implementation must not subtract all identities in D/I from every W or erase the inherited uncertainty bit after flattening requirements.

State the narrow rule explicitly: normalization of the current installation's newly acquired duplicate window against its actual required owners must preserve every inherited uncertain-input reason and its receipt classification, regardless of whether that identity also appears in D, I or V. Owner-identity wake deduplication is a separate operation. This reinforces the draft's general “cannot remove inherited I/W” sentence; it does not change policy.

The twelve new cases do not execute that same-identity inherited-W discriminator. Existing possible-owner-window-contract.spec.ts:251 onward checks inherited W under a qualified declaration, but does not add known I with the identical owner. The cheapest additional discriminator combines one certified native input carrying W(p) with another carrying known p, under a truthful dependent-p declaration: no false contradiction, conservative/unknown while pending, then started/surviving after drain. A companion new-destination-D(p) case must retain the same inherited uncertainty. These are missing verification cases, not observed failures from FIRST.log. I did not add or run them.

## Rule interpretation

D is destination installation/settlement responsibility. It remains a delivery gate even for a truthful independent literal; treating it as proof that the callback consumed p's speculative input wrongly rejects the owner's requested independent-in-p case. Conversely, merely removing D from contradiction checking cannot remove it from delivery, native provenance, or later consumers.

The draft correctly requires role-sensitive consumption: if another native operation consumes a pending source revision with D(q), q becomes that consumer's actual input lower bound. Independent input completeness then contradicts q. The requirement is attached to the supplied source revision and view; it is not reconstructed from the destination's current owner or a recipient's enrollment.

The same identity can have both roles. A native updater that consumes its destination's earlier p-authored value has I(p) as well as its new D(p); an independent declaration cannot erase I(p) by calling it destination ownership. Similarly, explicit enclosing declared dependencies remain V, even when they happen to name p. The draft's retained nested-scope semantics must preserve these cases, including existing outer-independent/inner-dependent contradiction behavior. No broad same-tree or same-owner exception follows.

The fixed window covers unobserved direct and saved copies equally. Literal-versus-copy syntax and lack of instrumented reads cannot certify completeness. A genuinely complete qualified declaration can avoid a new unrelated W, while inherited support and validation continue to apply. Rejection discharges the pending window without certifying the rejected evidence: only fresh ordinary evaluation under a new ticket may deliver. A saved scalar authored after q has already rejected acquires its own current window; there is no runtime provenance tracking of arbitrary saved numbers or permanent value taint.

## Exact first-run interpretation

FIRST.log records the Nx kernel test of src/lib/publication-obligation-combination.spec.ts with cache skipped: **six pass, six fail**. It contains configuration-resolution warnings, but all twelve tests executed and failures are assertion/contract failures rather than a discovery failure. I inspected the log; I did not execute tests myself.

| Cases | Required outcome | First frozen-runtime result |
| --- | --- | --- |
| Direct/saved copies; p confirms before q | Hold after p; deliver fresh 7 after q; later r still pending | Both fail at first post-p assertion: actual [7], expected [] |
| Direct/saved copies; q confirms before p | Hold after q; deliver 7 after p | Both pass, including useful delivery and late-r check |
| Direct/saved copies; q rejects after p confirms | Hold after p; after rejection evaluate ordinary 7, never inspection 99 | Both fail before q rejection at premature [7] |
| Direct/saved copies; q rejects before p confirms | Hold while p pending; after p send ordinary 7 despite displayed 99 | Both pass |
| Qualified independent literal/saved literal inside p | No contradiction; hold for p only; started/declared after p | Both throw after-callback contradiction during the transaction, before post-transaction assertions |
| Saved value newly authored after q rejection | Hold for current p, then deliver surviving 7; no permanent origin taint | Pass |
| Native supplied q input claimed independent inside p | Contradiction, retained ordinary write, hold through p, useful fallback after q | Pass, with qualification below |

The six failing tests do not execute their subsequent liveness or receipt assertions. Passing q-first cases do not prove W acquisition: the existing D(p) gate alone can produce their observed order. Likewise the last test's contradiction on the rejected runtime is not isolated proof of correct D-to-I promotion: the runtime also erroneously rejects destination D(p), as the two positive controls show. The complete matrix must remain unchanged for a successor so the positive and negative controls discriminate together.

## Source scope and limits

The rejected source's `lifecycle.ts:58` suppresses W for any known destination owner. Its generic owner union is also fed into `installedOwners` and contradiction checks by prepareNativeRequirement/prepareRevision. These are distinct producer and validation/consumer problems, accurately identified in the draft; deleting one predicate is insufficient. Retaining logical reasons in existing immutable source requirements and recipient projection records need not create a second state or rollback authority, but the table is not an implementation proof.

This review read docs/review-contract.md, the relevant392fcf46 contract and preserved declaration-example rejection/nested-scope semantics. It did not use another new review verdict. Root provided run availability/results, which I checked against raw output. No runtime, central spec, or test edits were made. Installation atomicity, physical/ordinary certificate correspondence, cleanup, entity coverage and broader qualification remain outside this twelve-case execution and cannot be credited from it.
