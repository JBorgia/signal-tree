# Selected-unit freshness: bounded options and decision boundary

2026-10-29. Independent read-only source assessment. No runtime edits or tests. Frozen source inspected at clean commit `75416029be1e0c1d9735ed3bdc0f4e8e6c02f775`; later untracked selected-active-id-preparation tests were observed and left untouched. This note does not authorize the newly exposed framework mechanism. Core collection proof implementation is separately owned.

## What is established

Source inspection establishes two nested deferrals: `tree-realization-adapter.ts:1551–1578` groups install/invalidate/publish; `native-location-realization.ts:23–76` queues publisher notifications until its body ends; Vue additionally postpones its shared publication trigger until adapter-group exit (`vue-observation.ts:67–102,151+`). Merely calling invalidate before rich capture therefore does not prove that a native cached carrier is fresh.

Native selection uses `locations.createCell` (`entity-signal.ts:1839`), rekey changes it through `replaceLocation` (`:1811–1812`), and public activeId returns its readonly carrier (`:3502–3503`). Angular createWritableCell stores the published value in a native signal; Vue/Solid store a published value separately from the supplied backing read. Vue's readonly view adds computed caching. Angular createWritableProjection is linkedSignal, not an uncached read. These are exact source findings.

I inspected the four raw `{ANGULAR,VUE}-{PUBLIC,PRODUCTION}-FIRST.log` files in `/private/tmp/link-collection-proof-evidence/selection-capability`, plus their before/after JSON manifests. Angular rollback onRemove(D) reads activeId X while ids/all/directA already expose restored A. The assertion expects A and fails in both sources. Vue throws `TypeError: rows.ids.value is not iterable` inside the callback in both sources, before its selection snapshot or newer C write completes; this is not evidence that Vue executed the stale-selection oracle. The exact comparison is candidate75416029 versus production87f6831fa60cafe87508f0ace84b7638698ca3b0. Candidate manifests are identical; production changed only by adding the two test fixtures, whose hashes match the candidate. No listed runtime file changed. Each Nx focused public run records one failure and one skipped private capability case. These are **reviewed prior executable observations**, not execution by this reviewer or candidate-introduced regressions. Keep them separate from earlier pre-invalidate capability probes, which exercise a different internal boundary.

The approved distinction remains: fresh direct SignalTree reads; application-owned computed/effects retain native timing. A0 at `4ed3b6094404f59b940e601626408dbbadbec588` says “Native group timing does not promise fresh application-owned computed values inside groups.” This does not excuse stale SignalTree-owned activeId or collection readers. The successor mixed-undo contract rejects adding a flush.

## Concrete candidate using existing observation methods

A source-owned backing plus **adapter-owned stable read facade and revision dependency** can express the required distinction without a new mandatory SDK method:

1. Selection's source owns its current key and raw revision. Prepare target/equality/revision guards before the selected unit; install the key with all P/O/responsibility records. No native callback occurs there.
2. The adapter creates a stable callable/read-only facade at construction. Every direct read observes the existing native dependency witness, then returns the supplied current source read. Retaining the readonly handle must not freeze its value. Adapter code owns native branding and `.value`, `.asReadonly`, and `.effect` details; the kernel must not inspect or forge framework symbols.
3. Publish only at the current invalidation-group boundary. The dependency witness records actual installed changes, including an ABA change within the group; it must not silently disappear because final value equals the previously published value. An ordinary identical setter that installs no change remains a no-op.
4. Application computed caches that have already evaluated still follow their framework until publication. The facade does not force their evaluation or run effects early. At the normal boundary, all relevant dependencies are notified and direct reads reflect callback-authored later truth.

Existing ObservationAdapter.createToken and createWritableCell(read)/token methods can represent a revision dependency and source read. Angular can implement its facade around a native signal target while preserving native identification; Vue already returns callable custom Ref-shaped carriers, and Solid already uses accessors. This is a concrete implementation direction, **not a proof that an arbitrary wrapper preserves every native integration**. Stable identity, native identification, readonly behavior, watchers, effect disposal and declared native carrier types remain gates. The source adapter interfaces do not need an added method merely to express these ingredients.

### Essential ABA discriminator

Start at X. Selected rollback raw-installs A. A callback first evaluates a newly created app computed that reads fresh selection A, then changes selection back to X before group exit. If the facade tracks only a published-value signal/computed still holding X, final X can suppress invalidation and leave the new computed stuck at A even after publication. A revision witness must advance for the actual changes. Test this alongside an already-warmed app computed: the latter may remain stale inside the group, but both must be correct at the ordinary native observation boundary.

This is why “call the native signal to track, return raw backing” is incomplete if that signal suppresses equal-final publication. It is also why a raw-read bypass with no dependency is not sufficient.

## Collection projection scope is larger than selection

Source-owned all/ids/count/map use `createVersionedProjection` (`entity-signal.ts:425–438`), while activeEntity is a cached derived view (`:3516–3526`). The existing tap-only fresh helper (`:1405–1421`) substitutes a plain callable and therefore requires explicit native-shape review; it does not cover retained handles or rich capture. The reviewed Vue failure follows this path: normal/pre-pending `.value` reads pass, then the tap reader encounters a callable without `.value`. Do not change its public test to kernel-call syntax to pass this boundary.

A complete correction must preserve source projection memoization separately from framework publication. The source can cache a computed collection view against the relevant committed raw revision, and a stable native facade can read that source cache while tracking the native publication witness. The source revision must change with relevant installed facts before callbacks. Calling an unchanged native cached computed is insufficient; recomputing every projection/user-derived callback on every read is not acceptable equivalence either.

Do not broaden this into unconditional uncached evaluation of all `createReadonlyCell` callbacks. Some are application-authored derivations; replaying their predicates/comparers/computations changes work and possibly side effects. Inventory the finite SignalTree-owned views needing direct freshness, their exact revision domains and their stable carrier constructors. Preserve activeEntity's selected-lifetime dependency isolation and existing collection-level versus field-level fan-out contracts (`angular/reactivity-contract.spec.ts`, `vue/entity-selection-lifetime.spec.ts`).

## Finite alternatives

| Alternative | Concrete scope | Boundary/result |
| --- | --- | --- |
| Complete the approved direct-read contract with existing observation methods | Source prepared selection + source projection caches; adapter-owned stable fresh facades/revision witnesses in Angular/Vue/Solid; neutral/React control; existing group timing unchanged | Preferred next bounded design lane. Requires explicit scope disposition for this broader framework work, then one implementation attempt against the discriminators below. No public SDK addition is established. |
| Retain the current adapter mechanism and finish only independent core proof work | Continue already-authorized source proof lifecycle work; preserve selected/public framework failures as open | A valid intermediate checkpoint, not full v16 qualification or replacement release scope. Cannot label the selected gate passed. |
| Add an adapter preparation/readiness capability | Specify semantic job, neutral/fake realization, compatibility and ownership before implementation | Only warranted if the existing-method facade is concretely falsified or cannot preserve native carrier guarantees. New mandatory SDK capability is a public architecture/compatibility decision, not an implementation convenience. |

There is no equivalent “flush early” or “direct reads may stay stale” shortcut under the current contract. If either is proposed, it is an explicit semantic change requiring owner authority, not a fourth internal repair option.

## Success and stop boundary for the broader lane

One finite implementation should answer: public mixed rollback reads from **warmed and retained** activeId/activeEntity/all/ids carriers; first rich capture sees complete selected P/O; later callback selection/777 survives; stable native identity and readonly shape; preexisting app computed native timing; newly created computed ABA correctness after publication; exact unchanged callback/error/retry controls; no-op and unrelated-fan-out controls. Include all shipped realizations and the original Vue prepared-selection-publication assertions. Preserve production-versus-candidate attribution for every public failure.

Success requires these outcomes together, not an internal raw-cell probe alone. Stop with the concrete conflict if facade construction changes required native shape, if equivalent revision tracking violates an existing callback-count or fan-out contract, or if a new mandatory SDK capability/public outcome becomes necessary. Do not start an indefinite wrapper experiment, suppress a supported observation, or infer that company adoption is ready from core proof tests.

Private changes: source backing/preparation/cache logic and existing adapter implementation details that preserve the exported contract. Public boundary: new SDK fields/exports, changed native carrier types/identity guarantees, altered callback scheduling, or weakened direct-read semantics. Existing contributor contracts govern the latter. No such public change is authorized by this note.
