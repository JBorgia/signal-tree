# Native input provenance before recipient enrollment

Read-only source audit of `/private/tmp/link-evidence-scope-successor` at immutable base `8212736242e1f85f7e3288dbb0ebda99a575e3b2`. Initial HEAD/status were recorded as that commit and clean. Subsequent source reads use `git show 8212736242e1f85f7e3288dbb0ebda99a575e3b2:path` so runtime worker edits cannot change these premises. No tests, runtime/model edits, or worker implementation verdicts were used. This is a source-data inventory, not successor acceptance.

## Bounded answer

The native transaction engine already retains **actual pending ownership and authored footprints independently of Link enrollment**. A transaction that writes x before any Link exists does not lose all ownership evidence. Its active bucket, reserved pending turn, source-prepared scalar/member/entity records and later pending effects remain available inside transactions.ts. That is enough information to identify the straightforward still-current speculative x contribution without guessing from a relationship baseline.

However there is **no existing narrow native source-to-current-input-owner query** on the scalar source. Nor do the native records universally describe an updater's exact supplied argument revision, its entire input domain, or transitive publication input requirements. Current publication queries only current write metadata and recipient-associated facts. Therefore “source data exists” is not the same as “the present source hook can prove this input.” A new source-local record is one possible enrichment; its necessity is **not established** merely by absence of a current port. Reuse or an indexed view of the existing authority can serve some cases. The missing distinctions and handoff must be specified before choosing.

## Existing data that does not depend on Link

| Native data | Exact source | What it establishes | What it does not establish |
|---|---|---|---|
| Transaction source identity | transactions.ts1455–1457 creates `transactionOwnerToken`; 1614–1621 registers it; write-context resolution checks the token | Tree/owner identity and authentic transaction attribution rather than a numeric ID from another tree | Which current source fields a supplied updater argument depends on |
| Open transaction bucket/reservation | 1469–1475 pendingTransactions; 4558 onward creates capture bucket before callback; authority.reservePending920–938 installs live `__effects` getter | Native writes can be retained before a public handle/recipient exists and before post-callback materialization | A complete staged footprint before any write occurs; provenance of an arbitrary application read |
| Prepared scalar effect | terminalRecord around4168–4255, installed through original prepareTerminal path | Exact native scalar position, ordinary before/after, current transaction attribution, mutationIntent, and installedOperation journal entry, without needing Link | A native-only input dependency certificate: mutationIntent `derive` is not a list of source inputs or an input revision token |
| Prepared member effect | prepareMemberResponsibility2312–2371; native source setMemberPresence | Exact parent/key/child presence footprint and minimum rollback responsibility while a transaction owns the write | Publication declaration inputs or all payload dependencies of a branch after-image |
| Prepared entity/source segments | prepareEntityResponsibility2373 onward; sourceSegments/sourceAdmissions1476–1480 | Lifetime/field/order/segment source facts and chronology retained for native settlement | A scalar/root input-proof port, or permission to treat incidental topology support as authored publication dependency |
| Per-transaction operation journal | OperationRecord2291–2302, scalar4228+, member2346+; fold2680–2701 | Source-installed per-transaction effect sequence survives diagnostic failure and can reconstruct authorized disposition | A last-writer table indexed by current scalar value; journal is keyed by transaction, and owner-position sets are not pending owner-cell sets |
| Staged pending effects | materializePendingTransaction3030+; authority.pendingTurns796, getPendingTurn1288, getPendingTurnIds1300 | Retained net/segment effects before settlement, plus protected live claims independent of optional history | Whether every still-retained effect is the author/dependency of the exact current displayed updater argument after later writes |
| Structural identities | PositionRegistry.addressFor/parentOf; native scalar position/slot mapping | Exact structured source domains, ancestor/descendant coverage, tree-local positions; no diagnostic path splitting needed | Transaction owner attribution by themselves |

The native value owner is not a provenance owner table. `tree-scalar-slot-runtime.ts245–290` stores scalar values, equality/revision state and sparse inspectionBaseline. readRecordSlot253 distinguishes ordinary from inspection display; commitRecorded254+ validates reentry and installs native records. None of those per-slot structures stores a last transaction owner or a dependency set. The ordinary presence source likewise stores validated child identity and O/P presence/revision, not publication input owners.

## Example: transaction written before any recipient

For `p = t.transact(() => t.$.x(7))`, transactions.ts ensures capture before callback and reserves contribution order. Its original terminal preparer records scalar x's effect even if no experimental publication preparer is registered. After callback, authority pending effects still include the x contribution, and the authentic transaction handle remains tied to its native authority. Initial `p.inspect()` is public evidence of those contributions, but invoking inspection is not a proposed publication hot path.

If a later native updater receives a source whose x contribution is still the current speculative one, the native engine can in principle supply p's actual ownership without importing another Link's evidence. Opening an unrelated transaction on another tree does not create ownership of t.x; enumerating all publication pending cells cannot substitute for matching the native source footprint.

A transaction opened but with **no authored contribution** supplies no owned x just because it is pending. An open callback with writes not yet staged is covered by the reserved pending turn's live capture view; a port that reads staged IDs only would miss that interval. The lifecycle reader has phase/transaction IDs, but not the source footprint.

The lookup is not currently wired: lifecycle source read1599–1612 reports pending `{transactionId,phase,consequencesReleased}` only. `research.register` receives a read-shaped `_source` argument but private.ts37 ignores it and registers only owner/token. Private.prepareScalar150–164 reads the **current writer's** metadata, then recipient input facts. After p's callback has returned, a new independent native updater normally has no `meta.transactionId=p`; that metadata cannot recover the previous speculative input author.

## Why raw pending overlap is insufficient as a universal current-input proof

Native pending records represent outstanding rollback authority, not a canonical current-value provenance map. They may remain after an independent later write, a repeated address/ABA or an ordinary/inspection divergence. Merely finding p's position in a pending turn would classify every later value at that position as p-owned, even when the relevant source contribution has changed. Equality with an old after-value cannot resolve same-value reauthoring or ABA.

The native engine already retains relevant later evidence for settlement: `observeLaterEffects`975–985, queued evidence, confirmed sequence stamps and sourceDependencies are combined by rollback planning1164–1197. The source comments1210 onward explicitly describe rollback planning as the correctness consumer and lifetime of that ledger. Reusing the data requires preserving that existing consumer/retention semantics, not treating rollback refusal or rollback permission as a new publication dependency selector.

`pendingPositionCounts`798–802 is a count index maintained for O(1) descriptor/claim protection; it is not an index of authentic author IDs. Native `installedOperations` is per transaction. A simple implementation that scans every pending turn/source/history for each point read would not satisfy the stated affected-source work bound. This is an **access/index boundary**, not proof that all ownership facts must be duplicated on every bare scalar source.

Inspection adds a second distinction: a native updater may receive displayed P while native effects/readRecordSlot describe O. A position overlap and an O after-value alone do not prove the argument's displayed input revision. `native-tree-scalar-leaf-runtime.ts280–283` separately captures publication token, displayed current and ordinary before. With no recipient preparer that capture is absent; the native effect record does not retrospectively carry the same token. Any proof must preserve the actual input contract rather than silently reading O in place of the supplied P argument.

## Root/branch and updateAndReport boundary

The direct root/branch call hook (`signal-tree.ts473–518`) and nested branch updater hook1107–1152 capture recipient evidence before user callback. `private.ts69–78` uses each Binding's known graph/address and current recipient facts. When p wrote before binding, baseline unknown cannot itself establish p's specific native ownership; it says evidence is unavailable to that relationship. Another recipient's available proof cannot become a source-native author record merely by removing its unknown flag.

The native graph and PositionRegistry can enumerate the actual branch/root argument domain. Existing pending effects can identify matching native contributions inside that domain. No field in the current callback handoff carries the resulting source-native owner/footprint evidence to every affected recipient before its installed unit. The local source information exists in the native transaction subsystem; the current publication callback receives no such query result.

`updateAndReport(updater)` at2091–2102 directly computes `unwrap(signalState)` and invokes the updater, then recursively applies returned updates. It lacks begin/end branch input capture. A later scalar child write is a literal replacement at that site; its effect does not identify the original root argument it consumed. Thus wiring only scalar derive or the two existing branch hook sites would omit this public native-input producer. This is source inspection only, no new executed falsifier.

An already-completed root/branch updater before any recipient is a stronger case. Native effects show authored outputs, not which source argument entries contributed to which output. For example, native output y7 can come from a literal7 or from an updater argument containing speculative x7; matching values/output effects cannot recover that distinction. A full native argument is observable at callback entry, but current retained native records do not universally retain that input-domain/provenance fact. Exact transitive native input obligations would therefore require an additional captured annotation/handoff (or an equivalent existing record enrichment) at that producer interval; a late recipient cannot manufacture it from its baseline. Application-hidden reads remain separately the application's declared-input responsibility.

## Data that must not be mistaken for native provenance

- Private `nativeKnown` already unions actual current transaction metadata with owners from recipient `ownProofs`; its name is not a provenance guarantee.
- A dependent declaration copying x into ordinary y does **not** transfer p's rollback ownership to y. Native pending footprint can establish actual native speculative authorship, not all per-relationship publication dependencies from declarations.
- An enrolled relationship's prior proof may legitimately retain declared/input obligations for that relationship. A late second relationship cannot borrow its grant or relabel that proof source-native.
- Terminal owner cells preserve compact outcomes/authentic handles. They identify a transaction, not its current source footprint. Active lifecycle IDs alone also cannot prove that footprint.
- Native topology support pairs and neighbor observations are not authored dependencies merely because they are available in a completed source record.

## Exact missing boundary and bounded design constraints

1. **Straight pending-before-Link case:** relevant native owner identity plus native authored footprint already exists inside transaction capture/authority. Missing is an enrollment-independent, exact-source/revision-qualified handoff to native input capture, with correct open-callback and staged mapping and affected-source lookup. New source-local ownership storage is not logically necessary to establish that the raw information exists.
2. **Current contribution after intervening writes:** a retained pending overlap alone is not a current-input certificate. Existing later chronology may support a derived view, but no such owner query/classification is currently exposed. Source identity, current input revision, ordinary/display distinction and authored footprint must survive the handoff.
3. **Historical/transitive native updater input without instrumentation:** current native output effect records do not universally retain the consumed argument provenance. This is a true missing recorded fact for that stronger capability, not a missing Link baseline only. Any new record must capture it before callback/reentry and attach it to the installed native unit, retaining/releasing only real current/recovery obligations.

This audit selects neither a global proof store nor a particular source-local index. A compact source annotation, an indexed authority projection or a prepared input port must be judged against the same facts, point-work bound and lifecycle. No new public API, rollback authority, source value owner or permission policy follows from this inventory. No tests were run and no successor correctness verdict is given.

## Immutable base hashes

- `packages/kernel/src/enhancers/transactions/transactions.ts`: `84e7e708de73a295ad6749a238762281a1add2fe27980c8ad8651c405fadd1c9`
- `packages/kernel/src/lib/internals/tree-scalar-slot-runtime.ts`: `766a3f606b3f2ff59492c45a0748f69b07739262e213cbd9baa91eb10b3b9165`
- `packages/kernel/src/lib/internals/intrinsic-mutation.ts`: `a16b715e9e37c58fe069bd1791f7ad9ac8aaa17a2a0cb0460d4dd860ed8544f3`
- `packages/kernel/src/lib/internals/member-membership.ts`: `bfad0d5f63050e5c774d0a903783f5472b44a9e74259e94ce5c09ff80262183b`
- `packages/kernel/src/lib/internals/position-registry.ts`: `e86ed017e11d69ee5cdf625082309bef976b2528227367f652a762998f0f89b6`
- `packages/kernel/src/lib/signal-tree.ts`: `cc61a3d7db0340992fac8639bd0fb145029f86ee489c8f4dc36481bfaa5b2115`
- `packages/kernel/src/lib/experimental-publication/private.ts`: `73f58da9919a92649f1741790b933cd3f0bb20e72a4c1dd7cb5de0d5fcfaf8ac`
- `packages/kernel/src/lib/experimental-publication/lifecycle.ts`: `a17ce73e377489ee90345d55aa710c3cb013aef8fea36bc492a84fe885fbd42e`
