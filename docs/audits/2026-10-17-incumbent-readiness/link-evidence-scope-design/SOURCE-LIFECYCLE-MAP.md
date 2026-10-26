# Three evidence scopes: frozen source lifecycle map

Design inventory only. Checkout `/private/tmp/link-a1-successor-experiment` was clean at HEAD `2d71d73305fea23173b3b681c2a897ef1a7dffba`; its commit and parent diff were inspected. All line references below identify that immutable commit, not a later worker checkout. No runtime/model/test edit, build or execution was performed for this task. Root owns the design and final disposition.

## Governing premises and evidence limits

`/private/tmp/link-a0-contract/A0.md` distinguishes installed authored facts (29), validation horizons (31), connection coverage/proof (46–58), immutable copied declarations and accumulating known obligations (83–87), and separate receipt/support lifetimes (143–159). Its exact warning is: “Unknown is not an empty owner set.” It also says unavailable historical evidence “must still drain under the supported ordinary gate” (157). `/private/tmp/link-a1-successor-spec/AUTHORITY.md` records the owner-approved aggregate/authored-input clarification: “Actually consumed inputs, transaction authorship and enclosing validation obligations remain lower bounds.” A declaration does not change rollback ownership.

Existing raw executions are preserved under `/private/tmp/link-a1r-aggregate-evidence/FOURTH/`. Five failed assertions are the decisive current failures: scalar membership4 and passive root-recipient noninterference1. The sixth, newly authored wider-input expectation used an unrelated other-tree owner. Independent adjudication found it did **not** demonstrate foreign-support leakage: unknown may drain through the supported tree-local ordinary gate. The original source, expectation and author inventory remain unchanged. This inventory does not count that sixth assertion as a proven safety defect or presume a global unknown hold. The separate same-tree native-input and default controls passed in existing evidence. No new falsifier ran here.

## The three meanings versus the actual types

| Required meaning | Source producer | Actual retained representation | Important limitation |
|---|---|---|---|
| Native authored fact/input dependencies | Actual transaction metadata with owner token; native input supplied to updater; selected native O changes | A local attributed `known` OwnerCell, then `nativeKnown`, Unit.inputs and private Fact/Proof maps | `nativeKnown` is **not** a native-only provenance record: it unions the attributed cell with owners extracted from relationship-associated input proofs. |
| Shared enclosing validation obligations | Declaration input properties, copied declared owners, active parent frames, nested work, callback/then-getter/reporting errors | Frame/parents/Horizon, declaredOwners versus owners/installedOwners, unknownFrames/invalidFrames, Operation.frames | Its bounded scope is the synchronous validation horizon; it is not a new native owner or a permanent source store. |
| Recipient-specific available/unknown evidence and coverage | Connection creation baseline, recipient field/presence maps, per-recipient updater snapshot, uninstrumented notification/history | Binding, Fact.unknown/blockers, Proof.unknown/invalid/owners, BranchInput.recipients | There is no tag distinguishing baseline uncertainty, uncovered native argument, unsupported origin, explicit unknown declaration or invalid input after their booleans/owners merge. |

private.ts14–27 defines Fact `{revision,clean,blockers,unknown}` and both proof maps; lifecycle.ts44–46 defines Proof `{owners,unknown,invalid}`. There is no three-way provenance label. `ownProofs` versus `proofs` preserves **authored component versus outgoing composite**; it does not by itself preserve these three origins. Fact identity is per-recipient serial allocation, not a stored shared native-unit ID. Intrinsic completion temporarily groups exact source fanout parts.

## Producer and installation map

### Scalar literal, native updater and equal-support write

`intrinsic-mutation.ts262–295` registers per-source preparers. Source input capture snapshots one opaque token per preparer (275–277); source preparation calls every registered preparer before combining primitive plans (278–290). The shared record does not rediscover the declaration stack at completion. `TerminalRecordPlan` installs deletes, writes and adds only; `installedPublications` is marked by that installed plan and completion ignores a discarded/uninstalled plan (1–48).

Native scalar runtime194–340 and neutral location-runtime440–515 retain prepare/complete callbacks before the write. A literal snapshots ordinary recorded before, prepares terminal authority only for meaningful native change, and separately prepares publication for an equal setter. Native updater input capture runs before user update callback (native280; location482), while displayed input and ordinary recorded before stay distinct. The retained equality outcome is supplied to the unchanged preparation callback rather than assuming the attempted value installed. `commitRecorded`/the bound native writer installs combined minimum native and publication records before rich capture, notifier or observer callbacks. Captured completion runs in finally; the wrapper ignores uninstalled plans and preserves primary errors.

`private.ts148–168` then:

1. Resolves current write context. Inspection returns without authoring publication evidence.
2. Validates attributed transaction ID against this owner's actual owner token (151–153). This local attributed cell is the native-authorship lower bound available at this point.
3. Captures this recipient's supplied scalar input and active branch-input tokens (155–157). Their facts are relationship-associated support, not automatically native-only ownership.
4. Unions their proof owners with the attributed cell into `nativeKnown` (158–159). **This is the first loss of owner-role provenance.** The union stores identities but not which were actual transaction author, declared input, accumulated validation or prior recipient support.
5. Combines origin/attribution/input/coverage unknown into one boolean (160), allocates Fact and pending Unit, and obtains lifecycle's primitive frame/operation plan (161–168). Once only that boolean is retained, downstream code cannot recover which uncertainty was recipient-local.

Equal support is reduced only after the horizon using effective support comparison, not freshly allocated identity (private127–140). No native value event is fabricated. `signal-tree.ts1163` routes an equal explicit whole-value child setter through the existing source ingress only when the source is enrolled or existing native authority/adoption needs admission. A no-setter declaration creates no unit.

### Root/branch native updater scopes

`signal-tree.ts473–518` begins capture before direct branch/root current-value materialization/user updater, retains it through installed children and ends in finally via the captured end function (so disposing the last connection does not strand the old scope). `1107–1152` does the same for nested branch-updater values.

`private.ts69–78` indexes overlapping source relationships by exact registry/address and captures separate recipient entries. Aggregate coverage is established only when that binding covers the supplied argument subtree; a descendant observing a wider ancestor argument remains unknown. `prepareScalar` reads only its channel entry. This removed the earlier flat all-recipient Fact list; it does **not** remove the downstream shared-frame contamination described below. Missing coverage cannot be filled by choosing the cleanest other relationship.

Read-only coverage absence: `signal-tree.ts2091–2102` implements public `updateAndReport(updater)` and supplies `unwrap(signalState)` to its callback without a begin/end branch-input hook. Its subsequent recursive literal child writes therefore do not automatically retain that native argument through this branch-input port. This is an unmigrated producer in the source inventory, **not a newly executed failure** or permission to add a patch. Arbitrary application-hidden reads remain declaration responsibility; a native supplied updater argument is a distinct observable source input.

### Membership and cold/hidden component values

`member-membership.ts918–1008` prepares exact retained parent/key/child P/O presence, minimum native responsibility and optional private unit, validates source revision/identity, installs source/descriptors/records before callbacks and completes in finally. The optional ordinary before/after payload (959–970) is prepared from native ordinary snapshot on actual O transition or ordinary physical reactivation. It is not inspection delivery. It carries values/presence, **not historical publication proof**.

`private.ts82–97` reaches ancestor/descendant recipients, resolves a local slot, derives attributed cell/unknown and prepares lifecycle with those values. Current exact-address guard at86 wrongly skips scalar recipients; the unchanged scalar4 are executed evidence for that local loss. At87 an unknown fresh address has no pre-enrolled slot and is skipped; fresh construction is a separately mapped unqualified producer, not a proved executed output here.

`materialize-markers.ts776–824` handles fresh children at the existing descriptor-pair interval. It calls the optional hook with child/present but no ordinary carrier, installs combined records before later callbacks and completes in finally. Enrollment in ordinary observation (`observation-substrate.ts73–79`) does not dynamically enroll private field/support tables. Binding fields at private183–185 are the initial graph only. See preserved `FRESH-SOURCE-COVERAGE.md`; no fresh-key correction or test was run for this task.

### Selected restoration and entity routes

Plain retained-member restoration crosses setMemberPresence and can carry its selected ordinary after-image; unknown origin/missing historical publication evidence stays unknown. Private ready initializes only missing retained components from that O after-image; it does not relabel selected realization independent. Existing history/native selection stays responsible for compensation.

Entity source has completed topology/ordinary authored records (`entity-signal.ts1275–1336`, `1802–1820`, `2000–2018`) but no preparePublication/capturePublicationInput/completePublication calls in its writer body. The current branch-source check excludes discovered collections (link547–550). These source-owned records are not publication grants. No complete entity/collection producer-to-recipient mapping has been implemented by this core; entity structural/support pairs must not be reinterpreted as authored dependencies merely because they are available.

## Shared validation creation, combination and the demonstrated loss

`lifecycle.runDeclaration`160–190 pushes a frame **before** reading user declaration properties. It joins the current horizon, copies declared authentic owner cells, keeps that immutable assertion distinct from accumulated frame owners, and executes work. Native writes during property/getter validation remain represented; a later independent label cannot erase them. It checks thenability while still in the frame. Nested frames retain parent identities; catch marks relevant active frames invalid. Primary callback error wins; report reentry occurs before finally pops the frame. The outermost horizon closes only after all these synchronous obligations finish.

`prepareRevision`78–104 snapshots active frames before native installation. `required` at86 unions all active `frameOwners` with caller `known`. It validates every copied declaration against that union, then primitive-adds the union into every active frame's installedOwners. Owner role is already mixed; the Set retains identity, not provenance. Last-revision writes are matching-channel only, so passive fanout no longer overwrites the matching recipient's last revision. The earlier overwrite and subsequent receipt correction are preserved in prior snapshots, not asserted current here.

**Demonstrated uncertainty crossing:** line100 adds the caller's single `unknown` to **every active frame**, including when the preparer is for a passive, nonmatching recipient. The input snapshot is now recipient-keyed, but its uncertainty is immediately promoted into shared validation scope here. `effective(frame)`67 combines parents and frame into one Proof; `finish`144–158 freezes that for all participating operations and clears the active bookkeeping. At that point the source of unknown cannot be reconstructed.

Existing unchanged public witness: c1 root relationship created before an unrelated other-tree p; c2 same-source relationship created during p; c1 independent root updater installs x1 but remains conservative/unknown and sends nothing. The same source/native argument/declaration works with other enrollment arrangements. FOURTH independent-input raw log preserves this noninterference failure after the recipient-keyed correction. It demonstrates a concrete boundary at shared-frame combination; it does not prove a new global proof authority is necessary or select the next representation.

Active nested declarations are not passive enrollment. Their declared/known obligations, actual native transaction ownership and enclosing invalid/unknown horizon remain required by the contract. Simply ignoring all nonmatching evidence, stripping unknown, or preserving only a foreign owner list is not a conclusion of this inventory.

## Reduction, replacement and retirement

| Consumer/owner | Create/combine/replace | Retire/release |
|---|---|---|
| Source current support | Terminal plan writes Binding.current and addressed field/value or presence slot, and adds pending Unit before callbacks. Unit holds captured Fact references and immutable payload/input evidence. | Replaced fact leaves current field/slot map when that footprint is actually replaced; an omitted field's retained component/proof remains for re-add. Pending Unit payload is cleared and its promise resolved after ordered reduction. |
| Own authored proof | private103–106 obtains finalized lifecycle proof, combines captured inputs and stores ownProofs. The result includes horizon/declaration obligations as well as inputs; “own” does not mean native-only. | Weak keyed by Fact; live field/presence maps and pending units determine lifetime, not receipt lifetime. No historical proof reconstruction was added. |
| Outgoing projection proof | private107–126 reduces membership masks, retained components and incremental owner counts. projectionSupport81 combines all still-contributing fields/structure. Composite proof overwrites proofs[unit.fact], and projectRevision adds its owners to current operation reverse dependencies. | New meaningful projection supersedes previous operation only after current proof/reverse links exist. Hidden components can remain retained but cease contributing while masked. No proof scan of all registered trees. Whole output masking may enumerate sparse masks. |
| Validation frame/horizon | Declared input copied once; installedOwners/unknown/invalid flags accumulate only on installed primitive edits. Parent/horizon identities gate early permission. | Outermost finish freezes operation proof then clears frames, installedOwners, installedLast, unknownFrames, invalidFrames and horizon frame set. These are validation lifetime records, not native transaction owners. |
| Receipt view | Matching prepared unit associates detached View with last relevant revision. Same-frame final tentative no-op can fall back per view to earlier live meaningful revision. Different scope equal/equal remains no-write. | keepRevision drops tentative fallback links on meaningful reduction. state() refuses changes after started/superseded/disposed/no-write. Receipt closure captures View only. Operation retirement does not erase live ownProofs/component facts. |
| Delivery permission | private198–214 consults complete current composite proof, pending units, clean ingress and relevant horizons; otherwise enters existing ordinary conservative scheduling. Per-Fact blockers and ordinary scheduler are separate from proof owners. | Started marks receipt terminal and lifecycle retires op dependencies/frames/views. Immutable packet may remain in-flight; Link tracks endpoint chain independently. A newer source revision cannot mutate the started receipt. |
| Connection | Bind creation baseline adopts current relationship read without an initial send; baseline uncertainty depends on unavailable creation evidence. Registers source hooks/address indexes. | private215 releases source hooks and indexes, resolves pending unit promises and deletes Binding/lifecycle/projection/callback records. Link1056 onward additionally releases ordinary observation/subscriptions/held consequences/waiters. No source-destroy-alone auto-progress/GC claim. |

`combineProofs` (private49) unions owner identities and ORs unknown/invalid. `sameProof`40 compares only effective identities/booleans. Neither retains the requested origin labels. After lifecycle proof plus captured inputs become ownProofs106 and then outgoing proofs126, a consumer can distinguish own versus composite map but cannot recover which identical OwnerCell arose from native authorship, declared input, horizon accumulation or recipient observation.

## Owner cells, actual transaction authority and terminality

Transaction enhancer1614–1638 registers source owner token and publishes real lifecycle transitions; it does not receive rollback selection from publication. Opened/staged at4583/4711 create or retain pending cells. Confirm/rollback at4789/4940 update actual terminal outcome; refusal publishes refused but lifecycle.ownerTransition ignores it as terminal, so authority/dependency remains pending. Automatic-abort refusal preserves and enrolls an authentic recovery handle (5045); normal returned handle enrolls at5064. A declaration cannot invent a cell from an arbitrary object.

Lifecycle17–35 keeps cells `{owner,id,outcome,dependents}`. Terminal outcome is irreversible; terminal transition removes pending and wakes indexed operations. A microtask removes the cell from source's active ID map, while authentic handle/Fact support can retain the compact outcome cell. Owner wake reaches operations, not every registered connection. projectRevision adds reverse links for currently contributing support; retire removes operation links on no-write/start/supersede/dispose. A supporting field's cell may outlive the receipt operation that first introduced it because private ownProofs/field maps remain.

Source unregister (lifecycle28–34; transaction cleanup5121) deletes registry ownership and pending-set entries but **does not forge a terminal outcome**. A previously confirmed authentic cell remains confirmed and usable after unregister. An unresolved cell can remain pending in retained proof; unregister is not successful compensation or permission. Explicit connection disposal is a separate release path. Transaction cleanup also explicitly clears transactionOrderAdmissions at5182; there is no absent-destroy-clear defect inferred here.

## Conservative unknown is not newly authored independence

Binding creation (private178–181) and notification-only fallback (223–229) create explicit unknown proof when evidence is unavailable. Fallback does not read the active declaration to mint a grant. Notifications can update a relationship through unknown support; they do not add native rollback responsibility. A late notification is not a substitute for missing installed-unit admission, particularly when project() declines while pending units exist.

Fact.blockers uses a pending snapshot except clean/complete context; lifecycle Operation.dependencies also includes required proof owners and blockers, for wakeup. These fields do not retain why a blocker was relevant. private.admit206–212 may drain unknown via the **supported ordinary gate** when its actual conditions permit. Therefore the wider-input test's unrelated-tree pending owner does not itself establish a mandatory global hold or a safety breach. Preserve native known input owners and actual relevant ordinary gates; do not infer them merely from a global pending count or a variable name.

## Exact boundaries requiring design attention, without a selected design

1. Scalar preparation's `nativeKnown` union loses owner-role origin before lifecycle receives it.
2. A caller's unlabelled unknown is installed into all active frames at lifecycle100; the passive-root noninterference failure demonstrates that recipient uncertainty can become a shared validation obligation.
3. Effective/horizon proof, input proof and later composite proof all use the same `{owners,unknown,invalid}` shape. Later cleanup/receipt code cannot reconstruct the three origins from that merged result.
4. Membership exact-address guard loses an otherwise prepared existing scalar source route; initial-only enrollment separately leaves fresh-member support/index admission absent.
5. Public updateAndReport native updater lacks this capture scope; entity completed source facts do not yet feed this publication protocol. These are source coverage observations, not tests run here.

This inventory establishes where the distinctions exist locally, where they are combined, and what retains them. It selects no new permission policy, canonical proof store, callback scheduler, public API or settlement engine.

## Immutable source hashes

- `packages/kernel/src/lib/experimental-publication/private.ts`: `73f58da9919a92649f1741790b933cd3f0bb20e72a4c1dd7cb5de0d5fcfaf8ac`
- `packages/kernel/src/lib/experimental-publication/lifecycle.ts`: `a17ce73e377489ee90345d55aa710c3cb013aef8fea36bc492a84fe885fbd42e`
- `packages/kernel/src/lib/experimental-publication/projection.ts`: `5191a41593cbefef098c7c7da6f43a380232889e57b0d8efb971611407aeddf4`
- `packages/kernel/src/lib/internals/intrinsic-mutation.ts`: `a16b715e9e37c58fe069bd1791f7ad9ac8aaa17a2a0cb0460d4dd860ed8544f3`
- `packages/kernel/src/lib/internals/native-tree-scalar-leaf-runtime.ts`: `eaa9850c22851a0d8887e9f69060e8724f2b7c6f12d577d847439ee3cfc4ada4`
- `packages/kernel/src/lib/internals/location-runtime.ts`: `d86fc473ec3c214d4d9db5122a9386b24666b8f89a1722e3cbdf4373081cb29f`
- `packages/kernel/src/lib/internals/member-membership.ts`: `bfad0d5f63050e5c774d0a903783f5472b44a9e74259e94ce5c09ff80262183b`
- `packages/kernel/src/lib/internals/materialize-markers.ts`: `6aa9b12c829d737a8ed00880aff880153deb4ab157eda884d16d6868efd9d8f4`
- `packages/kernel/src/lib/signal-tree.ts`: `cc61a3d7db0340992fac8639bd0fb145029f86ee489c8f4dc36481bfaa5b2115`
- `packages/kernel/src/lib/link.ts`: `a55392a625c492c4c48baefcca34a94b0ef1a83f4d61a10711d4a617534848eb`
- `packages/kernel/src/enhancers/transactions/transactions.ts`: `84e7e708de73a295ad6749a238762281a1add2fe27980c8ad8651c405fadd1c9`
