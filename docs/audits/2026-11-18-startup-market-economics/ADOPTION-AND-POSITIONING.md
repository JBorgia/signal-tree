# Adoption, ecosystem fit and product positioning

November 18, 2026 follow-up to the owner's questions. This is a source-backed
advisory record, with independent premise and interpretation review. No runtime,
package, branding, consumer application or AI guidance change is selected or
implemented by this record. Existing candidate qualification is unchanged.

Reviewed identities: study `0af73afa7f5b75bfd357d61ea76e591a7d0bad28`, v15
documentation `5e5675122e75ac6736da40d107eee6bcd6863b26` and v16 documentation
`06a896fd137c7be0e4e31a16410c5d03ad8c9907`; their runtime identities remain in the
[study overview](README.md). No new runtime or adoption experiment was run.

## AI guidance: existing, but the latest findings are not integrated

The November 18 findings commit changes audits, controller, TODO and logs. It does
not change `llms.txt`, package guidance or demo implementation. Earlier guidance
already covers framework facades, state ownership, external updates, transactions,
independent sessions and teardown. It would be incorrect to say no guidance exists.

There is a concrete stale label: the selected v15 source and built kernel
`llms.txt` begin by calling the reference 15.4.3, while the selected manifests are
15.4.9. The v15 root guidance last changed October 7; v16's last changed November 3.
Neither date establishes that every instruction is wrong, but the current version
label and new adoption conclusions need reconciliation before the next publication.

Recommended correction: maintain one version-appropriate consumer reference per
release line, bind examples to installed declarations, and route application
instructions by actual package/import/version. Include the smallest useful setup,
owner teardown, external ingress, entity lifetime, overlapping edits, refusal and
recovery. A quick compile is insufficient; behavior tests should exercise the
failure cases. Optimal library prose cannot compensate for contradictory consumer
repository instructions. AI adoption time/success remains unmeasured.

## TanStack DB: a better supplied capability, not a measured universal winner

Current primary [live-query documentation](https://tanstack.com/db/latest/docs/guides/live-queries)
describes a typed query builder compiled into incremental pipelines, with live
joins, grouping, aggregation, filtering and ordering. SignalTree supplies keyed
entities and reactive projections, but its current public surface is not an
equivalent relational query engine. An application can express related results
with derived state; that does not establish equivalent maintenance cost or speed.

TanStack also supplies [query-backed collections](https://tanstack.com/db/latest/docs/collections/query-collection)
and [optimistic mutation management](https://tanstack.com/db/latest/docs/guides/mutations).
Its handler determines the settlement boundary: completion proves server
confirmation only if the handler awaited confirmation/read-back. This is useful
ready-made behavior, with overlap in application goals, rather than proof of the
same v16 native ownership/publication/refusal contract. V16 likewise does not
become a client database by supplying those guarantees.

The existing benchmark pins DB 0.15.2/Angular DB 0.2.12 and tests a common
application workflow, not a dedicated multi-collection join workload or the newer
RC. Do not infer relational speed rankings from it or from vendor performance
claims. See [comparison scope](APPLICATION-COMPARISON.md).

Recommendation: compete on completed application workflows. Investigate a bounded
composition recipe before another query engine: a relational read model plus a
SignalTree-owned editing/review session, explicit commands and accepted external
results. This is an integration hypothesis, not supported interoperability already
proved. Define one authority for each fact and avoid two mutually mirrored stores
claiming the same authoritative state. Measure duplicate heap, conversion work,
stale reads, server updates during editing, rejection, retry, replacement and
teardown against competent alternatives. A new public integration package would
be a separate ownership/product decision.

## V15 to v16 migration

Ordinary state and shipped framework facades remain familiar. The
[migration guide](../../guides/migration-v15-v16.md) identifies real changes:

- `transaction()` becomes `transact()` without an alias.
- V16 adds pending-handle inspection and recoverable pending-authority handling;
  applications must design the corresponding review/recovery path.
- Arbitrary open `Record<string, V>` child access becomes `unknown`.
- Custom native adapters need current-read support and correct first-acquisition
  initialization; consumers of shipped facades do not implement that SDK work.
- Links, pending consequences and dependency declarations need behavioral review.
  Entity replacement and owner teardown still need correct lifetime handling.

A basic feature may have a small mechanical migration. Adopting the full
coordination contract is more than a method rename. No measured migration-hour
estimate or drop-in claim is available. The useful next proof is one existing
feature installed against each exact package set, preserving business behavior,
then exercising the new v16 guarantees explicitly.

## Coexisting majors

Independent feature domains could technically load separate v15/v16 runtimes.
This is not currently a qualified supported integration. Facades import their
canonical kernel and packed dependencies pin the matching version; an alias does
not rewrite internal imports. Locations, membership and source addresses include
module-local WeakMaps/symbols. Some branding is global, so matching types or
partial recognizability does not establish compatible runtime ownership.

Do not exchange live trees, entity handles, enhancers, pending handles or Link
sources across copies, or promise joint rollback/containment. A v16 operation
does not automatically govern a separate v15 domain. Plain values and application
commands are a conceivable domain boundary, not a new library bridge commitment.

Before recommending this arrangement, prove exact dual-package resolution,
Angular AOT/types, eager/lazy delivered cost, concurrent isolation, diagnostics,
DevTools, SSR and teardown. Tree IDs and some diagnostic connections have
module/global interactions worth testing; these are review targets, not observed
coexistence defects. Prefer a single version in a domain unless the measured
benefit justifies the duplicated runtime and maintenance surface.

Current v16 is an integrated runtime, not a v15 enhancer that can reconstruct all
earlier obligations from present values. That does not prove every possible
future separation impossible. It rules out advertising an unimplemented toggle
as the present product.

## Lite, Standard and Pro

The positive first step is a minimal-configuration recipe using current features.
Transactions, restoration, diagnostic retention and Link use already have opt-in
boundaries; shared supporting costs remain. A new Lite runtime needs a useful
contract and measured savings beyond existing tree shaking and automatic demand
allocation. The prior method split increased gzip; that rejects that implementation,
not all future decomposition. Include added support, compatibility, test and
migration costs. Native signals remain an alternative for minimal requirements.

Keep SemVer as the compatibility identity. Lite/Standard/Pro would be editions
requiring an ongoing feature/support policy; v15 and v16 are not already proven
commercial tiers. Use plain descriptions of the workflows each supports. Private
Studio/services can have distinct product positioning without relabeling the
Apache-2.0 runtime as an assumed paid Pro edition.

## A story-led demo and a bounded next proof

The selected v15 home already leads with an order edit: Make it Rush, receive a
shipping update, undo only the user's edit. Its start page teaches one feature,
ownership and teardown, and acknowledges native/NgRx alternatives. The study
branch has older abstract copy; do not mistake it for the selected v15 work.

Extend the working story into a flagship application with three perspectives:

| Perspective | Experience to demonstrate | Evidence required |
| --- | --- | --- |
| Application user | Edit confidently while external updates arrive; see exactly what survives undo. | Executed overlap/replacement cases and clear visible outcomes. |
| Developer | Build the feature with explicit ownership, ingress, teardown and failure handling. | Compiling source and tests; fair alternative implementations, not a deliberately broken comparator. |
| Business owner | Add review/recovery workflows and understand possible operational benefits. | Actual task outcomes; avoided incidents, hours and financial returns remain hypotheses until measured. |

Add a v16 chapter with proposal, overlap, approval, refusal and recovery. Keep
costs, traces and architecture available after the user understands the situation.
Clearly identify what the runtime, application, backend and optional tooling each
provide. Human comprehension is a separate test from a passing browser assertion.

Recommended order: accurate versioned guidance; one real bounded workflow proof;
an executable v15/v16 migration example; the richer public story with synthetic
data; full demo clarity/accessibility checks and successful deployment; then a
targeted ecosystem/query experiment if that workflow needs it. Existing strict
demo-size failures require explicit resolution before deployment sign-off.

This is a proposed priority order, not an automatically activated package fork,
consumer migration, naming change or publication phase. Application-specific
consumer findings remain in a separate private local audit. The existing
[hypothesis register](FINDINGS-AND-HYPOTHESES.md) remains the status authority for
unmeasured adoption, human-comprehension and commercial claims.

## Review basis

Independent premise review inspected manifests, facade imports, pending-handle
types, module identity and installed-artifact assertions on the selected source
lines. Independent interpretation review inspected costs, comparison scope,
selected demo source and primary competitor documentation. Neither reviewer ran
new runtime tests. They supplied distinct questions without a prescribed verdict.

The shared frozen premises at study `0af73afa7` were:

> Framework packages may realize SignalTree truth for their runtime. They must
> not create another state authority.

> Only kernel, angular, react, vue and solid belong in this public release
> workspace.

> Do not create temporary compatibility APIs, intermediate architectures, legacy
> bridges, or migration-only conveniences.

Source: [contributor contracts](../../contributor-contracts.md), with stable-line
compatibility governed by [support policy](../../support-policy.md). These
constraints do not substitute for owner decisions about future products.
