# Deferred ordinary handles: construction specification draft

Investigation authorized October 18, 2026. **No new public API, syntax, compatibility
restriction or implementation is approved by this draft. K2 remains open.**

## Required information and existing mechanisms

The typechecked Vue counterexample in the reconciliation record establishes that
unmaterialized runtime paths need terminal-versus-branch information. A descriptor
must be recursive: merely declaring that an open record contains objects does not
say whether its child `value` is a terminal ref or another branch.

Existing mechanisms cannot supply this without changing their meaning:

| Mechanism | Existing job | Why it cannot silently become the solution |
| --- | --- | --- |
| leaf(value) | Terminal classification and initial value | Dummy values create state; topology-only mode changes its contract |
| entityMap<E>() | Entity collection behavior/configuration | E is erased, missing byId may be undefined, references have different lifetimes |
| NodeConstruction<T> | Type-only provenance | Explicitly has no runtime property |
| TreeConfig | Enhancers, capabilities, derived state, comparison/debug policy | No existing recursive shape metadata |
| ordinaryBranch(seed, keyedLookup) | Actual seeded state plus created-child index | An index of installed children cannot describe unknown descendants |
| Marker processors | Internal declaration construction | Potential implementation seam, not existing public declaration syntax |

## Proposed smallest declaration model

Evaluate a construction wrapper carrying **initial values and separate immutable
ordinary-path topology** through the existing declaration pipeline. This is a
proposal, not permission to add an export. A separate config metadata argument is
an alternative, but needs equivalent typed association and path matching. Extending
leaf into a general schema is not preferred because it obscures its terminal job.

Only two topology forms are necessary for the demonstrated ambiguity:

- Terminal: one native framework leaf, regardless of whether the stored value is
  primitive, array or an explicitly terminal object.
- Branch: named child topology plus optional topology for arbitrary member keys,
  recursively. Initial data is separate; declarations supply no defaults or members.

For the discriminating empty Vue cases, one record declares terminal members; the
other declares branch members containing a terminal child named `value`. The native
carrier can then be selected without inventing data. Primitive type validation,
coercion, defaults and general schema-validation features are out of scope.

## Proposed behavioral rules requiring review/approval

1. Acquiring a declared absent handle does not install semantic membership, record
   history, create pending writes or publish to subscriptions/Link. Absent reads
   use the declared carrier and return undefined. Acquired handles may occupy
   identity storage; the contract must distinguish that from failed-attempt leaks.
2. Explicit supplied writes install only the authored path, paired atomically with
   responsibility. Declaration-only siblings remain absent. Existing K1 controls
   remain unchanged. A declared absent key differs from present undefined.
3. Ordinary path identity survives omission/reinstallation. The same held native
   carrier cannot silently change kind. Entity references retain entity lifetimes
   and never retarget replacement entities.
4. For explicitly declared paths, reject incompatible topology before installation,
   responsibility mutation or publication. This is a proposed observable restriction;
   it must not silently restrict existing undeclared whole-value write behavior.
5. Within a declared branch, valid data keys including `value`, `set`, `constructor`,
   `prototype`, `name` and `length` retain their established meaning. A terminal uses
   its native carrier members. Prototype traversal never acquires data; `__proto__`
   security rejection remains intact.
6. Metadata never appears in state snapshots, ordinary enumeration, serialization,
   Link payloads, user-visible semantic history or persistence. Internal metadata
   retention required for correct restoration is not prohibited. Existing native framework
   computed/effect timing is unchanged; only SignalTree-owned reads are promised fresh.

## Decisions this model does not erase

**Construction compatibility.** An optional declaration does not repair the current
unrestricted type promise for calls that omit it. Full pre-materialization support
would need declarations required where runtime shape is otherwise unavailable, or
an explicitly narrower acquisition promise for undeclared records. Requiring new
metadata for existing Record construction is a public source-compatibility change,
not a type-only implementation fix. Inferring from one example row cannot prove
homogeneity or support a legitimately empty record.

**Protocol exceptions.** JavaScript Promise/JSON machinery reads the same `then`
and `toJSON` properties as application code. Runtime topology does not reveal who
is reading. Proposed policy for review: do not synthesize absent protocol hooks;
retain explicitly materialized own-key behavior. That necessarily makes deferred
acquisition nonuniform for those names and needs explicit owner acceptance. A new
explicit path-access API is another option, but it would be an additional API,
not an implementation of existing dot/bracket behavior. Universal synthesis with
new promise/serialization behavior is not recommended.

**Topology-varying unions.** Same-topology unions can share a declaration; a union
that permits both scalar and branch at one absent position cannot supply one stable
native carrier without a discriminator or a restricted pre-materialization contract.
No blanket union rejection is authorized. This remains a concrete scope decision.

## Acceptance falsifiers

Keep existing open-key positive types and failure evidence; new expectations must
follow explicit compatibility decisions rather than silently narrowing types.

- Empty scalar record versus empty `{value:number}` record: correct Vue surfaces
  before installation, then working writes and reads; equivalent four-facade checks.
- Nested records and function/native data-name controls; absent/present protocol
  names, Promise.resolve and JSON.stringify under the approved policy.
- Stable held handles before installation, through omission and restoration;
  destruction and ordinary versus entity lifetime separation.
- Acquisition has no semantic membership/publication/history/pending effect;
  attempt-owned resources after failure are reclaimed without deleting held handles.
- Topology mismatch, preparation/equality failure, reentrant writes, failed abort
  recovery and rollback/refusal leave coherent state and useful authority.
- Ancestor subscription and Link participation after installation; no metadata in
  emitted values; composed restoration and all established capture controls.
- Descriptor/data type agreement and hybrid known-key inference remain strict.

## Disposition

The investigation identifies a construction-layer option, not an accepted repair.
Before runtime work, a reviewed owner decision must cover required versus optional
metadata, incompatible later shapes, protocol exceptions and topology-varying unions.
No evidence supports solving this by a kernel-only missing-property proxy. Do not
start final candidate verification while K2 is still an unresolved public contract.

## Concrete illustrative surface and pending migration decision

```ts
// Names are illustrative; no exported API is approved.
declare function openRecord<V>(
  initial: Readonly<Record<string, V>>,
  memberShape: ShapeOf<V>
): OpenRecordDefinition<V>;

// Empty scalar record:
openRecord<number>({}, { kind: 'terminal' });
// Empty record whose rows contain a member named value:
openRecord<{ value: number }>({}, {
  kind: 'branch', members: { value: { kind: 'terminal' } }
});
```

A nested open record would use a recursive record/member descriptor. The returned
declaration must map to ordinary Record topology in public types, not entity
collection methods. Exact generic/hybrid inference needs a bounded type inventory;
no blanket `string extends keyof T` topology erasure is acceptable.

The owner decision submitted after investigation is whether to require topology
metadata for construction that promises never-present handles, with documented
construction/type migration and absent then/toJSON exceptions. Approval of this
direction would still not accept exact API syntax or implementation. Optional
convenience alone cannot close the original K2 assertion.
