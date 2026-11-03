# Independent premise review: shared prepared entity transition

Read-only at7a84ae39. No runtime patch or new test run. Inputs: native entity-signal.ts, entity-mutation-frame/value-store, mutation-capture-runtime.ts, PathNotifier and transaction enqueue inspection chronology; frozen ba21c351 adoption patch and independently reproduced setAll failure. Question is feasibility, not implementation acceptance.

## Assessment

A bounded shared prepared result is plausible at the existing entity installation seam. It could remove the demonstrated duplicate semantic reconstruction without replacing ownership. But **one semantic before/after pair substituted into every notification is not equivalent to the agreed behavior**. The shared record must preserve both physical and ordinary-authority transitions, and consumers must deliberately select the correct projection. Calling all consumers 'publication' obscures that requirement.

The current gap is concrete: frame preparation computes ordinary7→99, whereas setAll publishes its staged physical99→99 (with m changes). Transaction inspection's enqueue observer reconstructs chronology by captureEffects(entry.newValue,entry.oldValue), so it never learns the n adoption that installed responsibility recorded. This is not evidence that responsibility failed or that independent chronology authority is needed. Rollback restores7 and repeat rollback no-ops in the existing witness.

## Minimum common facts

- Identity: owning tree and collection position, immutable subject lifetime, storage-key mapping before/after where structural, and row-relative fields. Business key cannot replace lifetime; payload id need not equal storage key.
- Classification: operation intent, participation (authored/inspection/realized), native origin, authentic transaction attribution, restoration designation and caller-known field footprint. Partial update fields, derive inference and explicit whole-row replacement are distinct. Do not promote inspected sibling fields into ordinary authorship.
- State: physical before/after and semantic ordinary before/after, including own-property presence separate from present undefined. Inspection-only transitions move physical state while retaining ordinary baseline. Adoption may change ordinary responsibility with no physical value difference.
- Revision: prepared-against mutation clock and operation order; immutable provenance for every source operation. Allocation, cloning, getters/interceptors/equality and validation must finish before paired installation. A later reentrant write invalidates older preparation; equality alone is not evidence of unchanged responsibility.
- Structure: existing prepared membership/rekey records, topology/order endpoint evidence and native lifetime claims. Preserve existing structural representation and successor policy. A value-only result must not infer membership ownership from a row snapshot.
- Publication: exact prepared ordinary field footprints/payloads for responsibility/inspection/Link; physical invalidation facts for native projections; already-established tap/callback arguments and timing. One input record may supply several views and event cardinalities. A no-op physical change can still carry an ordinary adoption or responsibility revision without forcing a value notification.

The record need not survive once its consumers have copied their own bounded obligations. A permanent row mirror or global transition log is not entailed. Divergence baselines remain justified by actual inspection difference/live recovery and must retire separately from optional diagnostics.

## Consumer-specific obligations

**Capture:** prepare responsibility from semantic facts before installation; install record and state together. Keep first error/recovery and actual authored ordering. Do not replace the incumbent settlement engine or authorize previously refused overlap.

**Inspection chronology:** derive the footprint from the same prepared semantic transition, not independently from physical display snapshots. Preserve the existing rule that inspection stores no row/value snapshots and does not determine settlement. The prepared semantic footprint must reach the existing authoritative notification protocol in place; a second public/internal notify-equivalent entry point is not justified. Extending the producer-derived evidence carried through that protocol need not make every ordinary subscriber see synthetic value changes. The exact internal representation is not selected here.

**Native values/effects and taps:** retain physical-change suppression and current framework-owned scheduling. A tap must observe the completed membership/order unit under the authorized v16 order-before-callback contract. Do not silently replace its physical row/previous-value arguments with ordinary snapshots merely to fix chronology. Supported callbacks remain user code and may reenter/throw.

**Link:** native source projection must use participation and authored field footprint to build eligible truth; never reread inspection-visible state. Its responsibility revision remains separate from value emission. Shared transition is evidence for existing projection, not publication permission; declaration ownership cannot alter rollback ownership.

## Finite route coverage

- updateOne and held scalar entity fields: fast installation, partial intent, inspected sibling fields, equal adoption, ordinary equal no-op.
- replaceOne/upsert existing/setAll existing rows: frame staging must return/retain the prepared result for publication instead of each caller retaining its own before. Include multiple rows and repeated writes to one lifetime; don't collapse chronological dependencies via an unconditional last-write Map.
- Point rollback/restoration: use prepared result under realized/restoration participation; do not record a new authored contribution. Revalidate topology/lifetime before install. Publish coherent final truth before retirement/consequence delivery as currently required.
- Structural/order operations: carry existing records through unchanged unless their own required value transition crosses the seam. Complete order/membership before callbacks, keep author-preserving reentry, and preserve independent frontier continuity. Pure reorder should not fabricate row-value facts or require collecting all row payloads.
- Preparation/reentry: getters/interceptors can run during staging and validation. Test throw before install, nested writes during preparation, callback writes after complete installation, observer error after terminal rollback, and retry. A 'prepared result' alone does not prove no user code remains in installation.

## Where the proposal becomes a different architecture

It is broader than this bounded correction if it requires a new canonical store, changes pending dependency/settlement semantics, redefines inspection-created lifetime disposition, changes public callback ordering/arguments, introduces a global chronological replay engine, or forces framework native computed freshness inside groups. Likewise, unconditionally routing all native scalar/aggregate notifications through a new event bus would need justification beyond this counterexample.

The smallest credible experiment can retain native installation/capture engines and carry one transient entity-transition result through their existing seams. It still needs a route inventory: fast/frame/point are storage routes, not proof that every caller consumes the prepared semantic result. Failure in another caller after claiming shared coverage would falsify that coverage, not justify another before-value substitution.

## Decision-useful conclusion

No source-level incompatibility proves the shared record impossible. Existing seams already separate preparation, installation and consumer-owned evidence. However, the gain is prevention of divergent reconstruction, not simplification to one universal notification. Proceeding would require an explicit internal contract preserving two state views and consumer timing, then an unchanged setAll falsifier plus sibling routes. This review does not authorize that implementation or claim the cost worthwhile.

## Deliberate ME-B constraint checked

PathNotifier207–224 and v15-framework-neutrality-spike.md5442/5547 explicitly reject a second parameter-object publication entry beside notify; positional syntax itself is not frozen. This is current source guidance backed by the historical decision, not permission from a greenfield reset.

A local prepared result at entity installation is distinguishable from deleted emitMutation only if it makes real decisions: ordinary-vs-physical transition, paired responsibility and projection/chronology facts prepared before installation. It must be consumed for those jobs, not merely package/unpackage notify arguments. Publishing it through a new notifyPrepared alongside existing notify would recreate the prohibited dual protocol.

The bounded compatible approach is a producer-owned transient result whose publication feeds the single existing notification operation, with any additional semantic fields/footprints represented there and consumed there. If that requires replacing the signature, derive the in-place change from all current producers/consumers; do not migrate only the failing entity writer while retaining two competing protocols. An entity preparation result need not become a universal scalar/structural envelope.

Accordingly, a separate chronology bus is not my recommendation. Capture's existing preinstallation responsibility job and notification's existing chronology/publication job may share prepared data while remaining distinct jobs; duplicating the notification job is the forbidden boundary. This constrains feasibility cost: all affected notification consumers must be inventoried, even if only entity producers gain ordinary-before adoption evidence.
