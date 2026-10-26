# Publication evidence scopes: design correction, no runtime successor

## Authority and preserved premises

This is the owner's bounded design correction after rejected
`2d71d73305fea23173b3b681c2a897ef1a7dffba`. It changes no public API, runtime,
publication default, rollback ownership, budget or release status. The recurrence
stop stays active during review. B is closed. Exact first failures remain in
readiness `6b9b9d0d4f59dcdb66e48ba9f4b1b3547bb60a08`.

Approved A0 at `4ed3b6094404f59b940e601626408dbbadbec588` says:

- "A valid independent declaration contributes no declared owners; it cannot
  clear known support." (A0 line56; emphasis omitted.)
- "Permission for a payload requires every still-contributing fact and relevant
  validation horizon to permit it." (line58)
- "Declared and known child obligations merge into the enclosing declaration's
  known set"; "Keep each frame's copied declared set separate from its accumulated
  known set." (line85)
- Missing historical evidence uses unknown and "must still drain under the
  supported ordinary gate"; that "does not count as a useful early-progress pass."
  (line157)

The approved aggregate proposal at readiness `2782af63` covers inputs to newly
authored facts, not every untouched contributor in the final payload. The native
updater argument is observable input; application-retained hidden values remain
the application's completeness responsibility. The three requested scopes are
conceptual ownership boundaries, not three additional global stores.

## Representation and ownership

Replace the overloaded `known/unknown/blockers` admission convention with a
prepared record whose fields retain provenance. Private names below are schematic,
not public exports or a prescribed allocation layout.

| Evidence | Identity and owner | Permitted combination | Forbidden promotion |
| --- | --- | --- | --- |
| Native fact requirement | Native source identity/lifetime, fact kind, authored revision and exact footprint; existing source/capture owns identity and settlement | Known authentic transaction owners and actual consumed source facts are lower bounds for every recipient containing them | Current value equality, neighbor observation, or another connection's grant cannot prove independence |
| Execution validation | Existing declaration frame/horizon; copied assertion, accumulated observed child requirements, enclosing horizon references, irreversible pending/valid/invalid result | Actual nested declarations, validation-getter/reporter reentry and native requirements of operations within the scope accumulate under existing A0 rules | Merely enrolling a subscriber cannot create a declaration frame or alter its accumulated evidence |
| Recipient evidence | Connection identity plus input/projection revision and coverage domain; existing Binding owns it | That recipient's available baseline and captured-input annotations; unsupported domain remains explicitly unknown | Neither union of other recipients' uncertainty nor selection of their cleanest proof is allowed |

A prepared native unit names common factual lower bounds once. Its recipient
annotations reference that unit and the relevant execution horizon. A recipient
annotation distinguishes **known requirements** from **coverage unavailable**.
Unknown must have a reason/domain and scope rather than one Boolean that lifecycle
code can accidentally broadcast. No recipient annotation is written into a shared
frame just because its source fanout includes that frame's connection.

Known native facts remain common even if discovered through a recipient's input
snapshot: attach the native fact/revision that proves the requirement. A declaration
claim or a relationship's permission is not such a native certificate. If only a
recipient annotation is available, keep its coverage and provenance; do not relabel
it common or clear it. This design does not introduce a canonical value mirror or
global dependency-discovery scan. For an unmigrated producer that cannot supply the
needed source identity/revision, the route remains unqualified for early permission.

Application-declared owners keep their execution and connection scope. Their
accumulation through actual nested declaration frames follows A0 line85; this
design does not introduce a narrower per-child propagation rule. Passive fanout
is not nested execution. A receiver without a declaration may inherit constraints
from the operation but gains no declaration permission from another receiver.

## Creation, replacement and retirement

| Transition | Native fact evidence | Execution validation | Recipient annotation |
| --- | --- | --- | --- |
| Connection enrollment | No authored fact, revision or native owner change | No frame/horizon mutation | Build only its own baseline/domain; unknown if unavailable; no initial send |
| Literal write | Source prepares actual changed facts and support-only meaning; structural prerequisites remain | Actual current execution requirements accumulate once per native operation, not once per fanout subscriber | Own assertion covers newly authored inputs; untouched support retained |
| Native updater | Capture source revision/domain and known input prerequisites before invoking callback | Observed contradictions accumulate in actual enclosing frames | Snapshot this recipient's coverage before callback; a wider unsupported argument is local coverage-unknown, not invented independence |
| Membership write | Exact parent/key/child identity, separate P/O presence, ordinary before/after; present undefined differs from absence | Same admission/validation as value units, even without a value event | Route equality, ancestor and descendant by explicit relation/identity; masks do not erase retained inputs |
| Nested declaration/getter/reporter | Any authored reentry is a distinct ordered unit | Parent/child requirements accumulate; immutable assertions are checked; no permission while relevant validation remains open | Recipients keep their own annotations; invalid enclosing validation prevents their early permission |
| Ordinary overwrite outside prior horizon | Replace exactly authored value facts; preserve required existence/key/order facts | Fresh horizon does not inherit unrelated completed frames | Retire replaced proof only when no contributing, dormant or recovery use remains |
| Support-only equal write | New support revision only if effective responsibility changes; no forced value event | Same validation/completion rules | New receipt/proof may supersede old revision; genuine equal-support no-op remains no-write |
| Selected rejection/undo/redo | Existing selector supplies exact ordinary realization facts and their available historical support | Not a fresh independence declaration | Invalidate old permission, consume realized support or unknown; no historical payload released by owner terminality alone |
| Owner confirms/rejects | Authentic outcome cell changes once; no ownership fabricated on unregister | Closed horizon result never changes | Wake referenced live support, even if introducing receipt was superseded; confirmation is not a blanket coverage repair |
| Mask/remove/reactivate | Lifetime/presence changes are distinct from retained value; new lifetime gets new identity | No implicit grant from terminal operation | Dormant support survives only while the native value can actually reappear; same-lifetime reuse consumes it |
| Dispose recipient | No native fact or other recipient change | Existing active validation result is not rewritten; already installed nested work keeps relevant horizon obligations | Cancel own queued work, detach indexes, resolve its own waiters and terminalize receipts under existing disposal contract |
| Terminal cleanup | Keep live native/recovery obligations; reclaim on actual release | Drop frames/callbacks after result frozen and installed references consumed | Detached receipts retain result cells only; support and in-flight packets have their own lifetimes |

Retention roots are the existing native/capture fact, active validation, or live
recipient contribution/queued/in-flight obligation. Not the old receipt. Owner
reverse indexes are updated from these actual roots; they must not disappear on
receipt supersession or retain a tree because a receipt is user-held. Genuine
source destruction remains distinct from explicit connection disposal.

## Admission is not completion or permission

1. **Prepare privately.** Native unit identity, exact fact revisions, common
   lower bounds, recipient annotations, relevant horizon references and index
   deltas are prepared before installation. All callback-capable preparation is
   followed by revision/identity validation. Fanout cannot replace a shared frame
   with snapshots independently prepared by two receivers.
2. **Install.** Install physical/ordinary facts, minimum incumbent responsibility,
   unit admission and all recipient deltas as the existing atomic unit. A point
   operation touches its affected facts/subscribers. No current connection count
   becomes a semantic input. Do not read mutable declaration context at delivery.
3. **Complete native unit.** Register reduction work even when equality suppressed
   every public value event. Completion says that the admitted unit is installed,
   not that its declaration is valid or that a payload is eligible. Uninstalled
   plans cannot complete or publish. Reentrant writes get later unit identities.
4. **Close validation.** Freeze the existing accumulated assertion result after
   nested execution, then-getter validation and diagnostic reentry finish. Apply
   it to the covered units. Recipient-only unavailable coverage cannot alter this
   shared result; an actual unknown enclosing declaration still prevents early
   permission for its nested units. Invalid declarations retain writes and the
   established primary/secondary error behavior.
5. **Reduce each recipient.** Process installed units in order into its single
   ordinary eligible projection. Combine its contributing native requirements,
   retained structural/value support, coverage annotations and relevant horizons.
   Untouched pending x can hold a valid independent y operation. Completion of
   y cannot certify x; scalar membership and aggregate masking obey the same rule.
6. **Admit delivery with an explicit basis.** Declared permission requires valid
   complete applicable assertions, available coverage, satisfied native/foreign
   support and completed horizons. Ordinary surviving fallback is separate: it
   uses a fresh coherent current ordinary projection and the existing tree-local
   gate, without dropping known foreign constraints. Unknown coverage is not a
   declared grant. Each decision covers one exact projection revision; validation,
   rejection or a newer revision invalidates an unstarted permission. Started
   packets remain immutable and newer eligible truth follows serially.

The implementation should represent the outcomes separately even if it reuses
existing arrays/maps: `nativeComplete`, frozen horizon result, recipient coverage,
and `permissionBasis` cannot be aliases for one flag. A valid declaration yielding
held/conservative output is normal. Conversely a started/surviving receipt does
not prove useful conditional independence. Terminal receipt states never revive.

## Routing and code replacement

The four scalar regressions are a source-to-recipient relation error, not an
eligibility policy. Classify a changed edge relative to a recipient as exact
member, ancestor prerequisite, internal descendant, or disjoint. Exact-member
routing requires matching child identity and admits a scalar; an empty relative
path is not evidence that the scalar has descendants. Ancestor reactivation must
verify the retained identity chain. Aggregate descendants reduce only actual
authored paths. Equal literal addresses in different registries are disjoint.
This uses the existing index; no scalar-specific permission exception is needed.

Replace `prepareRevision(...known,unknown,blockers)`'s unconditional fanout-to-frame
merge and its readback in `finish/effective`. Keep common requirements in the
native/actual execution part; retain recipient coverage on immutable per-unit
annotations through `ready/projectRevision`. Merely changing the merge to ignore
all nonmatching recipients is inadequate. Replace globally captured pending-owner
lists used as a surrogate for uncertainty with explicit known dependency refs and
the existing ordinary gate; measure actual D dependencies and local scope work.
Do not use a successful send's grant as future native input proof.

The admission/completion and transport queues remain single existing mechanisms.
This is not an alternative settlement engine, global proof authority, new policy
menu or public export. Fresh member registration, entity sources and complete
selected-unit installation still need their source mappings; the design does not
borrow those unimplemented capabilities to claim readiness.

Producer coverage must include public `updateAndReport(updater)`, not only root
and branch callable updaters. At rejected source `signal-tree.ts:2091–2102`, it
supplies a native root snapshot without the branch-input begin/end scope used by
the callable writers. Its recursive literal writes cannot reconstruct that input
afterward. This is a source-inspected gap, not an executed failure or a repair.
A successor must map this producer to the same input-admission contract and test
it under unchanged authored-input semantics before claiming updater coverage.
Its literal overload must retain its separate, narrower authored footprint.

## Mandatory discriminators and review gate

- All four scalar membership failures and original four recipient tests remain
  byte-identical. Require useful payload, no borrowed recipient grant, correct
  membership/lifetime and truthful receipt state.
- New enrollment matrix: branch/root × eight passive create/dispose timings,
  including updater and then-getter execution. Require identical c1 eligibility
  and started/**declared** basis with no relevant new source dependency; c2 never
  lends its permission. Preserve first run on rejected runtime separately.
- Actual nested dependent/unknown/invalid scopes still constrain all relevant
  recipients; outer independent plus inner dependent must contradict exactly as
  A0 specifies. Getters, callback throws and reporter reentry cannot release early.
- Multiple owners, untouched contributors, support-only ABA, later overwrite,
  confirmation/rejection, queued/in-flight sends, disposal and retained receipt
  cleanup retain prior controls. No statement that an output arrived is a substitute
  for its native/declared/surviving permission basis.
- Preserve the sixth original assertion/red. A separate adjudicated case checks
  **no declared grant** for wider unknown input; ordinary fallback is governed by
  actual local and known foreign obligations, not unrelated activity alone.
  Include actual known foreign support and same-tree pending controls so this is
  not an exception that erases a real dependency.

Review must challenge whether any consumer again collapses these scopes, whether
passive membership in a fanout changes shared validation, whether cleanup loses
live support, and whether source native requirements are really proven rather
than relabeled recipient claims. A positive review qualifies this design for a
bounded successor only; it does not qualify rejected runtime, clear any native
entity/collection gate, or authorize activation/integration. No runtime successor
is implemented in this design correction. If the available native producer cannot
provide a necessary factual distinction, report that exact missing capability
rather than adding a recipient-specific exception.
