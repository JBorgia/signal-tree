# Scalar native declaration experiment: rejected candidate

Owner approved proposed surface247cfec7 for this bounded native experiment, not
production activation or release acceptance. Native source baseline:
247cfec70c87c591e69e87dc3ee514840dad3f61; production runtime remains
87f6831fa60cafe87508f0ace84b7638698ca3b0. Source-loader changes only in-memory Link,
PathNotifier and transaction handle/lifecycle enrollment. All88 bundled original
source hashes verified against the checkout. No public exports or production edits.

## Capability demonstrated, acceptance rejected

Actual scalar native Link can publish a declared independent y7 while a real x7
transaction remains pending. A declared dependent copy waits, then sends on native
confirmation. Authentic no-op transaction identity, connection isolation, no-write
nonauthorization, ABA and several synchronous controls pass in this slice.

The final candidate violates TWO required safety properties. Neither failure is an
application-hidden-input omission. Do not integrate it or broaden qualification.

### 1. Returned inner frame escapes outer validation failure

```ts
const p = tree.transact(() => tree.$.x(7));
outer.declare({kind:'independent'}, () => {
  innerReceipt = inner.declare({kind:'independent'}, () => tree.$.y(9));
  return Promise.resolve(); // invalid synchronous callback
});
```

Outer throws async-callback. Expected both connections held through failed shared
validation. Actual outer sends nothing; inner sends9 while p is pending. Its receipt
reports started/declared on the final candidate. The independent first replay, made
before started-state completion, reports eligible; preserve both source identities.

Root cause: permissions retain a mutable Frame per connection, while invalidation
only visits frames still on stack. The completed inner frame has popped, so later
outer failure never invalidates its permission. Stack emptiness permits publication
without a durable shared validation outcome. Review and root independently reproduced
this on native writes. No repair followed this safety finding.

### 2. Inspection receipt contaminates the eligible projection

```ts
const p = tree.transact(() => tree.$.x(7));
connection.declare({kind:'dependent',owners:[p]}, () => tree.$.y(7));
// Drain; nothing sent.
withWriteContext({participation:'inspection'}, () => tree.$.y(99));
// Display99 is permitted; it must not become durable projection.
p.rollback();
```

Expected outbound7, the ordinary surviving noninspection truth. Actual outbound99.
This uses the existing internal inspection context, as existing inspection tests do;
it is not a claim that applications should author inspection metadata themselves.

Native Link's subscriber correctly skips inspection. However the experimental
responsibility completion path stamps every notification. researchRefresh adopts the
latest completed receipt's payload into eligible when it equals the physical read.
An inspection-only receipt therefore overwrites the noninspection projection. The
new conservative fallback then legitimately reads an already-corrupted eligible value.
This is a candidate integration defect, not a failure of unchanged native Link.

## Preserved sequence and counts

| Evidence | Result |
| --- | --- |
| First native slice |24/25 ordinary assertions; missing rejection fallback |
| Completed fallback, unchanged original assertions |25/25 ordinary |
| Unobserved-copy misuse demonstration |Speculation sends as declared; excluded from safety counts |
| Root identity/isolation/no-write/inspection controls |12/13 assertions; inspection99 failure |
| Independent/root nested-validation witness |Fails; inner sends9 |
| Private helper strict typecheck |Pass; not integrated API or spec types |

The initial fallback was simply unimplemented: rejected dependency left native
ordinary surviving7 held. First source/bundle/results were frozen, then the required
native conservative scheduling path was added. Endpoint attempts still use native
eligible, not physical read; the later inspection witness exposes how the experimental
refresh contaminated that projection upstream. Started receipt state was also added.
Neither passing25 count nor this source inspection qualified inspection safety.

First log used live array references in diagnostic actual fields. Snapshotting those
fields corrected the rendering, not an assertion: first remains24/25. Initial loader
text was not separately saved before fallback completion; first executable bundle,
private source, loaded Link/PathNotifier sources/hashes and original assertions are
preserved. Do not claim a missing file exists.

## Unexecuted or incomplete obligations

No full prior delivery32/34 replay, native in-flight/retry campaign, suspended-disposal
matrix, error-reporter reentry, input accessor/Proxy matrix, authentic failed-abort
recovery exercise, rollback-terminal-then-throw exercise or cross-tree owner campaign
was completed. Existing evidence remains historical, not inherited acceptance.
The source includes recovery enrollment but that is not a recovery test. No-op ID
and terminal identity are tested only in their recorded scenarios.

The current misuse case directly reads x under a false independent declaration; its
scenario name says saved-misuse but it is not a pre-scope retained-value control.
The true saved-value native case remains unexecuted. Exact API/type integration,
scalar-source guard, secondary declaration diagnostic reporter and full receipt
lifecycle remain incomplete. Aggregates, entity ordering/restoration, native framework
coverage, installed artifacts, retention and costs are unqualified. Research maps and
all-source scans remain; no efficiency claim. Production hold and B closure stand.

## Disposition

Reject this implementation. Preserve the demonstrated conditional capability and
both native counterexamples. The API direction itself is not disproved. The next
technical obligation, before any further native expansion, is a shared validation
outcome that remains binding after nested frames return, plus strict separation of
responsibility receipts from inspection-eligible projection. No new mechanism or
repair is selected by this rejection record. No architecture replacement, ceiling
change, activation, push, merge or publication.

## Evidence and replay

The archive includes worker first/final source and executable bundles, raw traces,
root controls, independent review and exact input hashes. Replay with Node24.15.0:

```sh
# after extraction into a fresh directory, adjust absolute import paths to it:
node --input-type=module -e 'const {run}=await import("/private/tmp/link-declared-native/final-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
node --input-type=module -e 'const {run}=await import("/private/tmp/link-native-root-replay/shared-horizon-bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
node --input-type=module -e 'const {run}=await import("/private/tmp/link-native-root-replay/bundle.mjs"); console.log(JSON.stringify(await run(),null,2))'
```

The last bundle runs root identity/isolation/no-write/inspection controls. Bundles are
standalone. Rebuilding loaders requires recorded source/dependency paths and overwrites
generic output names; frozen first/final artifacts should not be overwritten. Expected
counterexample scripts produce JSON failures; read pass fields rather than treating a
zero process exit as success. No package suites were run against this private candidate.

[Evidence archive](evidence.tar.gz), [checksum](SHA256SUMS), and
[independent review](REVIEW.md). Extract into a fresh location and adjust the
standalone-bundle paths above to avoid replacing previous temporary evidence.
