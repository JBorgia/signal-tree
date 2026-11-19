# Authorized implementation specification

This incorporates the owner authorization in AUTHORITY.md and the two clarifications in INDEPENDENT-REVIEW.md. The original proposal remains unchanged in PROPOSAL.md. Implementation and qualification are authorized; activation and release are not.

# Review proposal: declaration on the existing owned Link source boundary

**Recommend this scope for Main's proposal review: one typed declare method on Link for the already admitted owned source kinds, with a readonly receipt and declaration error; preserve current source rejection.** This is a proposed API boundary, not owner approval, production activation, an export patch or proof that all included kinds are shipping-qualified. API-SKETCH.ts is compile-only. No kernel/facade source changed.

## Governing authority and alternatives

The governing multi-actor PLAN says: “Unknown attribution remains unknown; write ownership is not proof of input independence.” It requires supported public consumer workflows and says implementation authority “does not publish packages, approve unspecified exports, expand bundle ceilings, waive failures, select alternative frozen semantics or reopen B.” New seams require exact semantics and owner disposition. C22 RELEASE-CURRENT:716–717 limits247cf approval to the bounded scalar experiment. Neither that approval nor successful aggregate runtime tests grants shipping approval here.

| Candidate scope | Consequence | Assessment for Main |
| --- | --- | --- |
| Scalar-only release surface | Add declare only to a newly precisely defined owned scalar class; branch/collection/row Links retain three members. Must align runtime presence and conditional return types and resolve atomic object leaves versus structural nodes/entity fields. | Closest to historical experiment scope, but not already approved for release. Adds a source-dependent API distinction and recognition work; does not cover existing aggregate consumer use. A viable explicit staged choice, not an inferred fallback. |
| Existing admitted owned sources | Same existing link<S>(TruthfulLinkSource<S>, LinkEndpoint<NaturalValue<S>>) signature; returned Link gains declare. No source predicate/value-shape expansion. | Smallest coherent general Link proposal. One method contract and unchanged inference; requires qualification across each included source kind, particularly direct row declarations. Recommended review target, not permission to ship. |
| Broader source admission | Also accept marker-bearing aggregate roots/branches or foreign/derived/custom sources. | Separate extension. Needs representation, whole-projection, writer and ownership evidence; corrected snapshot/hydration types do not earn this. Not needed to resolve the current hidden-method inconsistency and excluded here. |

P2/P4 need usable public APIs; internal casts do not satisfy them. P3/P6 still require native semantics, consumer/framework qualification and complete gates. The recommendation removes a type/runtime inconsistency without claiming every existing runtime path is a supported release guarantee. Whole-row declaration is a concrete missing qualification case, not something proven by collection-Link whole writers.

## Proposed source boundary

Included only where both existing typed admission and existing owned-source runtime admission hold: writable owned leaves (including explicitly atomic object-valued leaves), EntityMap scalar fields, ordinary branches/roots admitted by unchanged TruthfulLinkSource, direct collections, and owned whole entity row callables whose existing source type is admitted. Same NaturalValue inference: direct collection payload is row array, not an aggregate collection wrapper. No new read/write or facade setter abstraction.

Retain TruthfulLinkSource exactly, including construction-provenance rejection of marker-bearing aggregate branches/roots and rejection even for subscribe-only endpoints. This predicate is not a nominal ownership proof: existing bare functions/computeds can structurally typecheck and fail runtime registry checks. Do not advertise foreign signals, arbitrary readonly/derived/custom/opaque sources or cross-runtime identity as newly supported. Any ambiguous readonly/custom shape requires a concrete existing positive admission witness; this proposal supplies no widening for it.

No new source overload family, generic parameter on Link, feature flag, capability token or second entry point. proposedLink/ProposedLink in the sketch are comparison names only: the intended eventual spellings remain link and Link. NaturalValue/TruthfulLinkSource remain declaration-emission machinery, not new barrel exports.

## Exact proposed public symbols

- Existing Link gains `declare<R>(declaration, work): PublicationReceipt`; retrieve/settled/dispose keep their roles.
- Three new type exports: **PublicationDeclaration**, **PublicationReceipt**, **PublicationState**.
- One new value export: **SignalTreePublicationError**, with existing proposed code `SIGNALTREE_PUBLICATION_DECLARATION_INVALID`.
- No separate public owner-token, reason, stage, proof, native requirement, revision, registry or lifecycle exports. Consumers can use indexed access for reason/stage. The internal owner alias uses existing PendingTransaction and the existing exported rollback error's recovery.transaction type.

All four facade roots already re-export kernel. These symbols would therefore be available from the application's existing facade import root, with one kernel identity; no facade-local error class or duplicate receipt authority. The current extra enumerable runtime method and three-member public oracle cannot both remain the shipping contract. If this proposal is selected, explicitly update the public member contract to include declare and require exact runtime/type agreement. Do not use hidden typing or private mode(false) as an activation boundary. Neither packaging/activation nor a production-equivalent off lane is chosen by this document.

## Semantics to attach to the signature

Independent asserts complete empty input responsibility; dependent supplies every possible contributor, including saved/control inputs; unknown supplies no early declaration permission. An empty dependent list has empty declared contributors. Existing handles are dependency references only: runtime authenticates identity and copies the list without invoking settlement methods or transferring ownership. Structural compatibility cannot prove authenticity. Confirmed/recovery/no-op/rejected/abandoned/cross-runtime cases require explicit qualification; unknown/unavailable identities never become confirmed by disappearance.

The callback wraps existing synchronous mutations. It cannot bless a prior snapshot, change other writes' ownership, erase native destination/input/validation obligations, transfer declaration permission to another connection, or create an atomic backend transaction. Same-source recipients may make surviving progress without that permission; later undeclared writes remain independently governed. Nested declarations share the validation horizon, including user-capable getters/iteration/reentry; inner emptiness cannot erase outer known or unknown facts. No relevant authorship yields no-write. Final relevant revision/receipt fallback semantics remain; equal support-only authorship need not emit a native value notification. User return values are discarded.

## Readonly receipt, states and error contract

The receipt is a frozen handle exposing only readonly read(): PublicationState. Each read returns the current detached immutable status snapshot; it is not a reactive signal, thenable, cancellation handle, payload or transport future. Terminal no-write/started/superseded/disposed states are sticky. Retaining a prior snapshot does not make it live. Started means endpoint invocation began, never acknowledgment; settled() and onTreeError retain transport completion/error roles.

The proposed discriminated union contains exactly current C22 combinations: validating; no-write; held/pending-dependency; eligible/declared; conservative/{invalid-declaration,unknown,rejected-dependency}; started/{declared,surviving}; superseded; disposed. These distinguish actionable admission outcomes without exporting internal proof graphs. Not every successful call must expose every transient state; validating can be observed on an inner receipt while its outer horizon remains open.

Explicit difference from247cf: **do not promise eligible/surviving or conservative/unavailable-owner**, which have no current emitting path. Surviving is observed at started; unavailable owners reject the call before callback. These omissions require owner review as a proposal reconciliation, not an undocumented implementation-derived policy reversal. Broad state/reason strings are an implementation shortcut, not a desirable public contract.

Use the previously proposed error name/code, stage before-callback|after-callback, seven narrow reasons (malformed, unavailable-owner, contradiction, async-callback, validation-threw, disposed, unsupported-source), and optional unknown cause. Stage distinguishes whether supplied work ran, not whether validation getters caused side effects. Installed writes may remain after rejection; this is not rollback. Readonly properties are a TypeScript contract; do not additionally promise frozen error objects or a particular Error.name descriptor. The declared constructor(stage, reason, options) is public; do not expose additional lifecycle internals or reporting flags.

Callback throws can be arbitrary values; no receipt is returned on throw. Preserve their established identity behavior and secondary diagnostic handling, but do not promise every possible infrastructure/wake failure is converted to this class or that private fault-injection precedence is an absolute public guarantee. Errors do not confer recovery or settlement authority.

## Synchronous callback typing and its limits

The return-constrained generic in API-SKETCH rejects inferred PromiseLike returns, including ordinary async functions and unions containing Promise. `() => void` alone would not do this. Compile examples prove those negative cases, readonly receipt/state, marker-bearing aggregate rejection, existing source value inference and all five native facade write forms.

This cannot police any/unknown casts, explicit generic erasure, async callbacks first assigned to () => void, or objects whose callable then does not satisfy PromiseLike structurally. Those limitations are illustrated, not hidden. Runtime must still inspect returned callable then under the validation horizon, including thrown getters; writes may remain. Already-launched async work is not cancelled, and no declaration context crosses await. A later phase requires a new explicit declaration. No TypeScript signature proves hidden-input completeness.

## Qualification needed before a shipping disposition

1. Public positive/negative types and packed installed consumers for the selected source set on kernel, Angular, React, Vue and Solid; exact exports/members and unchanged endpoint inference. React currently lacks matched declaration execution evidence; direct row-Link declarations need dedicated real tests. This sketch is source-type evidence only.
2. Real Link calls covering authentic/recovery/no-op/terminal owners, malformed/getter/iterator/thenable rejection, native evidence lower bounds, no-write/equal support, nested failure/reentry, exact error values and disposal before/during/after work. Preserve owner and receipt assertions, genuine possible holds and useful surviving progress; do not reuse private lifecycle-only proofs as public execution.
3. Receipt transition/immutability/retained terminal lifetime checks. Holding a compact receipt should not retain whole completed trees/owners; current held-write-callback GC evidence is not receipt GC evidence. Dropping a receipt does not cancel connection work. No universal reclamation claim without the relevant tests.
4. Explicit compatibility/member-surface and activation/version disposition, plus remaining P3/P6 gates. Existing three-member oracle, original failures and historical proposal stay archived with the selected replacement. No full-suite or cost obligation is waived.

Main can review this concrete scope, symbol set and state reconciliation before formulating an owner question. This worker has neither answered that question nor authorized implementation, exports or release.
