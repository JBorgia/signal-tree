# Prepared active selection — narrow source extraction

Read-only source review. No runtime edits, tests or new policy. Scope is the selected structural unit's existing selection consequence; ordinary `setActiveId`, `clearActive`, public `Location` call/set/update behavior and callback ownership stay unchanged.

## Current backing and delivery

- `entity-signal.ts:1788` creates `activeIdSignal` through its `LocationRuntime.createCell`.
- Neutral `location-runtime.ts:533–549` owns raw `let value` inside `createCell`. Its writer compares with the supplied comparator and assigns the value. `createWritable.replace` (`450–480`) then calls the intrinsic observer and publishes the binding. The binding's `notify` (`444–448`) combines kernel dependency invalidation with observer/native-token delivery. Consequently neither `replaceLocation` nor `binding.notify` is a callback-free private install.
- Native `native-location-realization.ts:147–161` likewise owns raw `let value`, but explicitly requests an **unobservable mutation source** (`createWritable(..., false)`). Correction to the broad earlier concern: active selection's native cell cannot acquire intrinsic observers through the normal source registry. Native `createWritable` still invalidates the adapter token after a changed raw write (`106–125`), so calling it is not pure installation.
- A raw native write alone is insufficient for fresh reads. For example Vue `vue-observation.ts:107–120` stores a separate `published` value; the carrier reads that value and `token.invalidate` refreshes it from raw backing. The adapter may also execute reactive work. This must be a delivery phase after the entire selected unit is installed, not hidden inside the raw assignment.
- `prepare-entity-target.ts:190–200` states selection policy: follow the selected surviving lifetime through a rekey; retain the selected key if its lifetime is absent/removed. Its current install uses `replaceLocation` at236–238. `planPreparedRekey` similarly replaces selection at `entity-signal.ts:1760–1762`, after its combined frame commit has already delivered rich capture. Removal does not implicitly clear selection. Do not adopt `clear()`'s explicit reset as an inverse rule.

## Smallest source-owned preparation capability

Expose raw preparation only from the two existing `createCell` closures, not from a generic external `read/write` location or public cell method. A concrete private signature is:

```ts
interface PreparedCellReplacement {
  readonly changed: boolean;
  readonly record?: TerminalRecordPlan;
  validate(): void;
  installValue(): void;
  deliverIntrinsic(): void;
  invalidate(): void;
  completePublication(): void;
}
interface PreparedCellSource<T> {
  readonly location: Location<T>;
  prepareReplace(next: T): PreparedCellReplacement;
}
// Private LocationRuntime capability, both neutral/native implementations:
createPreparedCell<T>(initial: T, equal?: (left: T, right: T) => boolean): PreparedCellSource<T>;
```

`createCell` and `createPreparedCell` should factor the same writer implementation. Only the selected owned cell needs the preparation capability/revision state; do not add a global strong map or make all ordinary cells pay an unneeded registry/observer allocation. The exact factory name is not public API selection. This method is internal; before implementation verify no exported adapter authoring contract accidentally exposes a new mandatory requirement. Existing construction must retain compatibility rather than silently using the old callback-capable setter as a fallback.

Preparation reads raw backing without reactive tracking, saves the source-local revision, evaluates equality, prepares intrinsic minimum records and optional installed-publication records, and snapshots rich observer delivery. All comparator/preparer user execution happens here. Validate the source-local revision after those calls and once again at the containing selected unit's final validation. A comparator throw installs nothing; same-cell reentry must preserve its installed inner write and invalidate the stale outer plan. Value equality is not a write identity: a reentrant ABA must change the revision even when the final raw value compares equal. Ordinary successful actual assignments on that prepared cell advance this same revision before any observer runs. A real equal no-op does not force value invalidation or a new value revision.

`installValue` consumes the prepared raw value once, advances its raw-source revision when changed, and executes no comparator, observer, native adapter or intrinsic preparer. The enclosing selected unit installs **all** raw P/O/selection facts plus all prepared `record`s before any delivery. Do not call ordinary `replaceLocation` from this method. Source validation is not history authority; it protects only the prepared unit against intervening mutation. Multiple changes to one selection inside the same selected unit must compose against its private prepared state rather than prepare N baseline replacements that overwrite one another.

For neutral observable cells, minimum terminal/publication records are prepared before installation; the existing rich observer is later observational delivery and must not become the only responsibility. Existing generic `createCell` writer currently does not invoke the `prepare` callback supplied to `createWritable`; this is a source fact, not proof that the new selected capability can ignore prepared records. The native internal cell's source is unobservable, so these records/observer parts are normally absent. Do not register native activeId as newly transaction-owned state merely to populate them.

The selected source owner presently skips a selection setter entirely when the selected key does not change. Preserve that admission behavior. A generic prepared API must not turn that skip into an authored no-op event. Where an actually invoked ordinary setter historically reports an unchanged intrinsic mutation, its ordinary path remains unchanged.

## Coherent reads versus callback-free commit

Three intervals must remain explicit:

1. **Private install:** all collection/scalar/member/O/raw-selection backing and minimum records installed.
2. **Projection invalidation:** make the installed state readable through SignalTree-owned projections/carriers. This can execute framework/user code and therefore occurs only after interval1 is complete. Every planned later invalidation is still attempted despite an earlier delivery error; preserve first error semantics.
3. **Rich/native/public delivery:** intrinsic capture, committed entity listeners, native observation, path/tap publication and publication completion use frozen prepared evidence. A reentrant selection/write here is a newer distinct operation and must not be overwritten by any deferred raw selection assignment.

Neutral runtime can split its existing `notify` into callback-free kernel work (`node.version++`, private `notifyDependents`, which only dirties/schedules kernel consumers) and later `notifyObservers`/consumer settling. This is necessary if a rich capture reads a cached `activeEntity` before public delivery. No user computation belongs in the kernel invalidation half.

Native token invalidation cannot generally be declared callback-free. It may be required before a rich capture can read the updated public activeId carrier (Vue example above). Therefore **the relative ordering of native projection invalidation and rich capture must be made explicit by the enclosing selected-unit owner**. The implementation may deliver callback-capable invalidation only once all selected facts/records are installed; it cannot promise both raw-only install and fresh native carrier reads before any token refresh. This is an extraction/ordering constraint, not authorization to strengthen application-owned native-computed freshness inside groups. Preserve the existing adapter grouping and observer timing contract; if that contract forbids the required ordering, report that precise conflict instead of suppressing callbacks globally or returning stale selection to capture.

## Terminal/error/retention rules

Plans are source-owned transient objects, not a second authority or new history journal. Validation/preparation failure has no install or completion. Installed publication records have an exactly-once completion token. A later observer failure must not undo raw installation or lose its remaining delivery obligations; preserve the existing contained intrinsic-observer behavior and the enclosing selected operation's first-error/recovery rules. Once the selected operation drains, release plan references to values, observers and completion records; retain only existing live cell subscriptions/source lifetime. A user-held readonly selection handle continues to have its established lifetime. Weak storage alone is not collectibility evidence.

## Focused acceptance needed before use

Changed rekey selection is visible alongside all selected rows to the earliest capture; callback selects C/ABA/nested selection and survives outer completion; comparator/preparer throw installs no selected unit; same-source reentry rejects stale preparation; equal no-op emits no new value notification; unrelated source changes do not falsify cell-local validation; neutral and all four native facades read coherent SignalTree selection; invalidation/observer throw still completes later installed obligations; terminal cleanup has no new retained selected-unit roots. Existing remove-with-absent-selection behavior remains unchanged.
