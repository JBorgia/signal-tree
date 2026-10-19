# Remaining readiness reconciliation

> Historical reconciliation at the source identified below. Later owner decisions
> supersede its K2 direction: the [applied string-Record migration](../unknown-dynamic-access/README.md)
> makes arbitrary dynamic access `unknown`, preserving known/hybrid children and
> whole-value writes. Deferred handles and a lookup API are not implemented or
> required by that bounded migration. See the [current controller](../../../../RELEASE-CURRENT.md)
> for current acceptance status; the findings below retain their original provenance.

October 18, 2026. Inspected source `4dfc3576e12ce2e0077888d504f14cc022c9bb32`;
runtime remains `9917c92fbbdc9dfdd14601f1f5fb7ce21799be71`. No runtime edits.
The incumbent baseline remains `8d220643`. B remains closed.

## Owner decisions and current disposition

The owner explicitly authorized both directions after clarification:

1. Preserve the recursive open-key promise and specify deferred handles. This is
   direction for specification, not acceptance of an implementation or a new API.
2. Use the documented newest-open-first workflow as v16 settlement scope, retaining
   atomic refusal, authority, useful retry, independent progress, truthful
   inspection/errors and application-owned reconciliation. Do not claim arbitrary
   order surgical rollback or automatic authoritative server reconciliation.

Product rationale for the second decision: applications explicitly control local
optimistic-operation order and server conflict policy. A predictable retryable
lifecycle is useful without promising the library can determine every server
merge or reorder arbitrary overlapping contributions. This decision does not
excuse corruption, orphaned authority, incoherent publication or unrelated stalls.
The stronger matrix remains unmet capability evidence, unchanged.

| Item | Current disposition | Required before final freeze |
| --- | --- | --- |
| K1 new-key whole writes | Tested correctness and measured artifact cost accepted | Preserve controls; future runtime edits need fresh affected verification |
| K2 unseen descendants | Direction approved; precise contract has an erased-shape conflict | Resolve shape/carrier/protocol semantics, implement and pass unchanged type/runtime plus lifecycle controls |
| R1/R2 ordinary composed undo | Proven defects, not accepted limitations | Complete-turn order/frontier capture and coherent undo/redo, preserving drift refusal |
| L1 independent Link progress | Ten failures freshly reproduced | Dependency-scoped consequence eligibility without leaking pending values |
| S1 stronger overlap success | Outside selected v16 success guarantee; 57 recorded refusal-vs-success failures remain | Validate supported newest-first success, atomic refusal, pending authority, retry and truthful errors/inspection |
| S2 automatic authority projection | Outside selected application-owned reconciliation guarantee; original failure retained | Do not claim canonical/pending projection or automatic server arbitration |
| Q1 exact-source qualification | Not executed for a final repaired candidate | Freeze only after remaining supported requirements pass; then complete required exact-SHA validation |

## K2: what the specification still cannot decide implicitly

Existing positive types promise recursive access to arbitrary Record descendants.
Existing runtime returns undefined for an unmaterialized first handle. Previously
materialized omitted ordinary paths have stable path identity and path-only
reactivation; that does not provide runtime shape for a never-present path.
Entity references remain lifetime-specific and must never retarget a replacement.

The approved direction must preserve no membership/publication on acquisition,
undefined absent reads, stable handles, explicit path-only writes, and coherent
transactions/restoration/Link. Two choices cannot be hidden in implementation:

- Absent `then`/`toJSON`: unconditional callable synthesis changes Promise/JSON
  protocol behavior. Explicitly materialized keys already have data-key precedence;
  indiscriminately banning ordinary `constructor`, `prototype`, `value`, etc. would
  reverse existing supported behavior. `__proto__` security rejection is separate.
- Unknown framework shape: identical empty runtime input can require incompatible
  meanings for the same property access. The preserved strict typechecked probe is:

```ts
const scalar = signalTree({ rows: {} as Record<string, number> });
const branch = signalTree({ rows: {} as Record<string, { value: number }> });
// Vue typings accept both, without casts on the accesses:
function scalarValue(): number { return scalar.$.rows['x'].value; }
function branchChild(): Ref<number> { return branch.$.rows['x'].value; }
```

Both current missing handles are undefined. Populated controls prove `value` is a
supported branch key: one access returns numeric 7, the other a Vue ref containing
7. Thus it is not an existing native-name exclusion. Given absent scalar-read
semantics, a universal deferred getter cannot return both undefined and a child
ref from identical unknown input. This is a specification conflict inferred from
verified type/runtime facts, not a failed new implementation experiment.

The owner authorized investigation of a narrow runtime shape declaration. This
is investigation only: no new API implementation or type narrowing is authorized
without a reviewed specification. General approval to specify deferred handles
does not resolve unknown shape automatically. The declaration must supply the
missing information without inventing semantic members or fake initial values.

## R1/R2: shared missing capture facts

Independent source trace and targeted Nx replay confirm:

- R1: `[z,a,c] -> setAll[c,z,a] -> remove(a)` leaves `[c,z]`. Capture retains the
  reorder's three-member after endpoint, not the complete turn's endpoint.
- R2: `[z,a,c] -> add(w) -> prependOverwrite(c)` captures
  `[z,a,c,w] -> [c,z,a,w]`. Undo removes w but the order delta tries to restore it.

`captureCollectionOrderIntoBucket` retains explicit order-call endpoints;
`drainCaptureBucket` copies them and `recordHistory` derives a delta. Structural
create/remove replaces the native frontier identity but its capture does not
carry before/after frontier tokens. R1 lacks the actual final token; R2 lacks the
actual initial token. Reading current state at drain cannot recover the missing
past identity and may include another authored or realized operation.

Therefore a restoration-only value-array patch is not justified. Replacing tokens,
weakening validation or snapshotting delayed current state risks accepting drift.
The proposed bounded correction would add constant-size structural before/after frontier and
ordered evidence in the existing capture boundary, then complete-turn composition
for collections with explicit ordering. Its sufficiency remains to be proved;
no new authority, full point-write scan or runtime patch was introduced here.

The bounded feasibility pass also found compound intervals: prepend/setAll commit
membership frames and then publish an encompassing order capture. Treating those
as sequential independent records double-counts membership. Prepared changes omit
restore-subject evidence, while later notifications may be coalesced. A proposed
record must cover all these routes, identify enclosing intervals, and batch
prefix/suffix composition; rebuilding growing arrays per admission would be
quadratic. No partial two-example runtime patch was made. This remains a concrete
internal capture/composition obligation, not permission for another architecture
competition or a reason to weaken the undo contract.

Acceptance: six unchanged desired assertions across three enhancer configurations;
undo/redo twice across an earlier order turn plus R1/R2; structural changes before,
between and after reorders; realized/pending interleaving; later independent drift;
values, entity lifetimes, order and publication; existing missing-anchor/frontier
refusals unchanged. Safe preparation refusal remains containment, not successful undo.

Fresh focused Nx result: **71 ordinary passes, 6 expected failures**, three files.
The restricted attempt failed before execution with Operation not permitted; the
authorized elevated retry ran tests. Both logs are preserved separately.

## L1: current independent progress failure

Replayed only frozen composition non-interference cases for four Link-enabled
combinations. Frozen oracle hashes were checked before running. Result:
**10 violated, 2 unsupported, zero execution errors**. The two unsupported rows
lack occupied-entity setup; they are neither runtime failures nor passes.

Positive x/y delivery controls pass before pending work. After pending x begins,
ordinary constant y=11 is readable locally but its endpoint receives nothing
within the unchanged 250ms watchdog. Independently confirming y also succeeds
while its endpoint remains held by pending x. This reproduces all ten inherited
failures on current source; the frozen assertions are not reclassified away.

Causal source trace: Link calls scheduleDurableConsequence with its claimant;
resolveScopeKey reduces that claimant to the whole tree registry, and any open
scope holds the send until all scopes settle. This gate intentionally prevents
compensation from leaking another transaction's speculative state. Removing it
or bypassing it inside Link would reverse that safety boundary. A correct repair
must establish actual dependency eligibility within the shared authority and
retain pending/refusal/compensation protections, reentry and disposal controls.

A separate read-only admission investigation found that current pending-position
counts alone are insufficient: open callbacks have reserved live effects before
final pending-position indexing; entity collection positions also cover multiple
lifetimes/fields. Existing transaction-owned records can supply a read-only
interference query, but order, ancestor membership, active capture and publication
sequencing must be covered. The proposed repair keeps commit-consequence as the
single admission authority and permits sends only for a whole payload proven
disjoint from every unsettled responsibility. It must recheck held work after
settlement and immediately before endpoint entry, including observer reentry.

This does not authorize partial transmission of mixed root snapshots. A root Link
that includes a pending descendant actually depends on it; its current eligible
projection contains speculative data. Sending just committed parts would require
another projection/protocol contract. The ten frozen failures use independent
leaf/field payloads and do not require that extra capability. No Link runtime
change or successful repair claim is recorded here.

## Semantic evidence accounting

Original 424-row inventory stays byte-for-byte unchanged: 188 held, 68 violated,
168 unsupported. All 57 overlap rows' recorded nonheld assertions are refusal
versus required successful settlement; none is silently changed to a pass by the
new scope decision. This accounting alone does not prove refusal safety on every
route. The ten Link failures remain supported-behavior defects. A1 remains an
unmet stronger visible authority target, not an accepted automatic reconciliation
feature. Truthful public inspection and error behavior remain required.

The 168 unsupported rows remain separately classified: 112 omitted enhancer
capabilities, 6 refusal-setup gaps, 17 terminal-observation gaps, 24 canonical-split
observations and 9 authority inputs. Missing observations do not authorize new
inspection APIs or count as success. Canonical/authority obligations not promised
by selected scope remain advanced targets; supported public guarantees require
ordinary acceptance tests even where this stronger harness cannot observe them.
Do not report the aggregate stronger matrix as passed or fulfilled.

A runnable public newest-first example verifies: older rollback refuses without
changing 2; newer rollback reveals 1; older retry restores 0; repeated rollback is
a no-op. This is useful recovery, not refusal-only testing. It uses identified
candidate artifacts and preserves cause.kind `later-confirmed-dependency`.

## Review, replay and next boundary

Independent descendant and restoration reviews were followed by primary source
checks, a separate typecheck/runtime replay of the Vue example and the unchanged
Link replay. Full evidence, source-input hashes, logs and scripts are in
`evidence.tar.xz`, indexed by `manifest.json`. No broad suite, benchmark or size
campaign was rerun. No final candidate has been declared or release gate waived.

Targeted restoration command (Node24.15.0/pnpm10.17.0, NX_DAEMON=false):

```sh
pnpm nx test kernel --testFile=src/enhancers/restoration/reversal-known-limitations.spec.ts --testFile=src/enhancers/restoration/two-setall-turn.spec.ts --testFile=src/enhancers/restoration/restoration-missing-anchors.spec.ts --skip-nx-cache
```

`link-replay.mjs` selects unchanged N-cases and records every bundled runtime input
hash. `newest-first.mjs` executes the public workflow on the identified artifact.
K2 replay files and exact NodeNext configuration are preserved in the archive;
package symlinks target the candidate Vue/kernel build and shared dependencies.
[Artifact receipt](artifact-receipt.json) verifies all 248 candidate artifact hashes
against the prior sealed manifest and identifies the imported entry files.
[Deferred-handle construction draft](DEFERRED-HANDLES-DRAFT.md) records the authorized
investigation and its remaining public decisions; no API implementation is approved.
The current supporting evidence is bounded diagnosis, not a substitute for final
exact-SHA release verification after K2/R1/R2/L1 are closed.
