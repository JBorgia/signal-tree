# Realization footprint boundary trace — read-only

October20,2026. Source `90c1bd1118cba0748dd0d233fc787b3d055a39a2`;
production remains `87f6831f`. Rejected candidate source manifest:
`63e23f78349de3c8137947be09ee65b4e4e8989f47de1322570cd3442fe2b56b`.
No runtime/test edits, successor prototype, later slices or new test campaign.
All19 archived candidate overlay files were compared byte-for-byte and remain
unchanged. The exact mixed failure, entity-only control and second-transaction
assertion remain in the [rejected evidence](../semantic-transition-execution/README.md).

## Last correct information and loss

Source paths below relative to `packages/kernel/src/` at the stated source.

| Boundary | Facts present | Disposition |
| --- | --- | --- |
| `lib/internals/causal-runtime/causal-types.ts:72` ReversalEffect | Subject identity, exact `subjectFieldSegments` ([] means whole row), before/after, explicit `fieldPresence`, structure/context and turn | Already capable of expressing m-only reversal without adopting n |
| `enhancers/transactions/transactions.ts:2598` and `causal-runtime/reversal-planner.ts:43` | Reversal preserves row address and swaps value/presence endpoints | No evidence that the known failure originates in capture or rollback planning |
| `transactions.ts:3067` | Normalized effects enter `preparePointRealization` for mixed scalar/entity or frontier work | Point route admission retains footprint |
| `tree-realization-adapter.ts:725–734` | Loop still has original effect and resolved exact path; it overlays m on cloned displayed row n99/m4 | **Last correct local footprint**: resolved path plus effect presence/after before projection into row-only accumulator |
| Same file:705,727,738–740 | Per-subject record and private call contain only `{subjectId,key,value}` | **Lossy handoff**: physical row target survives, authorized edit facts do not cross to the consumer |
| Rejected `entity-signal.ts:507–528` / `physical/entity-value-store.ts:18–57` | Full physical target is interpreted as complete ordinary replacement | Known trace: ordinary n7/m4 becomes n99/m0 and divergence is cleared |

The effect array is still in the adapter's scope; the facts are not inherently
unavailable. They are absent from the handoff representation. Computing a physical
target is legitimate for physical installation. Treating that target as the ordinary
edit scope is the defect. Equality/diffing against current display cannot recover
intent, particularly same-display adoption, deletion or actual whole-row replacement.

## Which adapter contract must change?

The existing private signature **cannot carry this distinction unchanged**.
`CollectionNode.__preparePointValues` at `tree-realization-adapter.ts:42` accepts
only subject/key/value; `entity-signal.ts:4069` installs the private nonenumerable
property. Its caller is kernel-local. The public root, `/internals` and `/adapter`
barrels do not expose this method or `CollectionNode`/`ReversalEffect`; framework
implementations do not supply it. Package exports are explicitly bounded.

This adapter is a kernel-internal realization translator, not the public framework
SDK. `adapter.ts:12–24` explicitly excludes entity contracts/restoration machinery
from that SDK. Therefore an internal prepared-input contract change is required,
but no public SDK/export change has been identified as necessary. A runtime-visible
`__` property alone is not a supported public compatibility contract.

History places the private point seam in `12a04f57`, the paired-capture/coherent-
publication work. Preserve its admission, revision validation and install-before-
delivery ordering. The trace is not permission to remove those properties.

## Concrete mechanism supported by this trace

A successor hypothesis can preserve **ordered, authorized realization edits** beside
the physical target through this existing private handoff:

1. Retain exact segment paths, after-presence, after-values, subject/key and turn/
   operation ordering from admitted reversal effects. Distinguish explicit whole-row
   replacement ([] path) from missing/unknown information. Do not widen unknown to full.
2. Prepare physicalAfter from physicalBefore, and ordinaryAfter from ordinaryBefore,
   by applying those same authorized edits in order. Do not copy untouched physical
   siblings into ordinaryAfter. Parent/child replacement and deletion need sequencing;
   an unordered set of top-level field names is insufficient.
3. Validate all reflection, identity and revision requirements before installation.
   Install the prepared result and responsibility together, preserving legitimate
   reentry and existing refusal/recovery rules.
4. Carry that result through the existing notification protocol to capture, inspection
   and publication with their existing participation filters; retain physical tuples
   for native observers/taps. Do not mint another event stream or authority store.
5. Retain untouched divergence; release only obligations actually discharged by the
   approved realization. Retention and terminal cleanup remain explicit test obligations.

This is an end-to-end representation proposal for the known point case, not executed
proof or permission to implement. It uses already-admitted authority facts, so no new
public semantic choice is identified for the ordinarily-existing n/m counterexample.
Structural and whole-target reconstruction must be dispositioned separately, under
the already-approved ordinary-topology policy; it cannot be solved by inferring a
field list from row snapshots.

## Sibling paths and independent review

[Sibling trace](SIBLINGS.md) distinguishes executed evidence from source risks:

| Path | Boundary finding | Evidence status |
| --- | --- | --- |
| Mixed scalar + partial entity field | Point accumulator drops field footprint | Proven unchanged counterexample |
| Explicit whole-row point effect | Full target can be legitimate when [] was actually authorized | Must remain distinguishable; not itself a defect |
| Plain-member + entity field | Member presence stays explicit; entity sibling still uses lossy point handoff | Source-predicted exposure, not newly reproduced |
| Structural heterogeneous frame | Original field effects survive for publication, but install plans receive full prospective rows | Source-only authority risk; later structural scope |
| Complete collection target | Result retains subjects/values/order but not producing edits; candidate baseline map is not reconciled | Source-only S4 risk; unmigrated |
| Direct field fallback | Most field effects keep exact address; field deletion can reconstruct a whole row before setter | Positive row-only control is narrow; deletion not proved safe |

[Independent mechanism review](REVIEW.md) confirms the private/public distinction
and expressibility of the known point case. It also identifies a concrete limit:
`assignPreparedSubjectValue` silently returns when a nested parent is absent or
nontraversable. Physical inspection may supply a parent that ordinary state lacks.
A successor must not count that no-op as realization, infer a new parent-creation
policy, or introduce blanket refusal to pass tests. Use an already-established
construction/refusal rule; if none governs, stop that dependent case for the owner.

Other required precision: preserve supplied edit order (do not sort by turn),
prepare isolated values without mutating retained baselines through aliases, and
validate whole-unit revision/lifetime before mixed installation. Cross-row user
callback timing cannot be inferred from per-row grouping. Returning unavailable
must not route silently into another footprint-losing fallback.

These are feasibility findings and test obligations, not new executed pass counts.
No new runtime or test code was written. Root verified the decisive handoff,
public barrels, package exports and nested traversal helper against source; the
review conclusions do not grant implementation authority.

## Required unchanged discriminator

Keep the exact two-arm Nx regression and second transaction unchanged. Supplement
it only with nested segments, absence/present-undefined, explicit row replacement,
repeated/parent-child edits, reentry/fault/refusal and equivalent inspection/Link
publication checks. A successful physical rollback without the second adoption
check is insufficient. Existing native notification timing and value suppression
remain acceptance constraints.

## Scope conclusion

A concrete internal mechanism is identifiable; a new public adapter API has not
been shown necessary. It is **not** merely changing the last setter argument:
prepared edit facts must survive grouping, consumer preparation, installation and
publication, and sibling reconstruction paths must not silently widen authority.

Do not amend the rejected candidate or resume slices2–5. A separately authorized
successor would need a bounded private realization-input contract and sibling-path
acceptance inventory first. Any requirement for new public exports, semantics or
another authority returns for an explicit decision. Production hold, B closure,
entity collectibility and release/artifact blockers remain unchanged.
