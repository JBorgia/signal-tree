# Remaining expected failures and restoration characterization

Source audit, 2026-09-23. Base HEAD `7ade0e3ecb25ff0d06da4355b5f7d67844e147b7` plus uncommitted main repairs. The initial audit was read-only; subsequent explicitly authorized source repairs and their red-first evidence are recorded chronologically below. No law, package output, or dist was changed by this worker.

**Final disposition: two public open-key runtime/type-contract defects and four internal experimental-observer limitations remain explicit. The characterized restoration admission bypasses are repaired and the old TODO placeholder is covered by 26 executable controls.** See [Restoration TODO disposition](#restoration-todo-disposition) for bounded closure, final counts, and exclusions. This is source proof, not release qualification. The historical sections below preserve the original failures and intermediate candidate limitations; they are not the final source status.

## Evidence and limits

A scratch Vitest transform changed only the execution of the three audited spec files from `it.fails` to `it`. Production files remained unchanged. Result: **6 ordinary failures, 15 passes, 21 tests across 3 files**. The failures occurred at their target assertions, not setup or teardown. The dynamic `it.fails` selector in `nested-structural-rollback-1.spec.ts` currently has an empty `STILL_RED` list and contributes no additional expected failures.

Independent public-entry source probes reproduced both Record defects without casting the write operation. The probe also passed a strict, no-emit TypeScript check against current source (ES2022/DOM libraries), confirming the public call is admitted. Two public restoration probes characterized simple removal of both neighbours. Every probe-owned tree was destroyed. Dependency-only, no-output bundle analysis found no `provenance-spike` module reachable from any of `src/index.ts`, `src/adapter.ts`, or `src/internals.ts`; the package exports map also offers no spike subpath. This checks current source reachability, not arbitrary unsupported filesystem imports or frozen dist contents.

Reproduction files are preserved at `/private/tmp/remaining-expected-failures/`:

- `red.config.mjs`, `exposed-reds.log`: six failures exposed without editing their source.
- `probe.ts`, `probe.mjs`, `public.log`: public Record and restoration observations.
- `entry-graph.log`: all three entry graphs report `provenanceSpikeReachable:false`.
- `tsconfig.json`, `types.log`: strict public-probe typecheck, exit 0.

Run the assertion inventory with `pnpm exec vitest run --config /private/tmp/remaining-expected-failures/red.config.mjs`; its nonzero exit is intentional. `node /private/tmp/remaining-expected-failures/probe.mjs` replays the captured source bundle. Rebundle from `probe.ts` to assess a later source revision. No package build or pack was run.

## Each expected failure

| Carrier | Assertion and observed failure | Public production reachability | Disposition |
|---|---|---|---|
| [Provenance case 4](../../packages/kernel/src/lib/internals/provenance-spike.spec.ts#L110) | After rollback, captured effects should be `rolled-back`; the predicate is false. | The transaction is public. The failing records and classification exist only after explicitly installing the unexported spike observer. | Experimental rollback disposition remains unearned; this does **not** show state rollback failed. |
| [Provenance case 6](../../packages/kernel/src/lib/internals/provenance-spike.spec.ts#L155) | A durable write followed by a rolled-back transaction should classify as partial; `rolledBack` is zero. | Same private observer requirement. | Experimental mixed committed/reverted classification remains unearned. |
| [Provenance case 10](../../packages/kernel/src/lib/internals/provenance-spike.spec.ts#L248) | Two synchronous provenance scopes inside one transaction should each retain their location's effect; first scope has `[]`, expected `['a']`. | `provenanceScope` and `getProvenanceRecords` are not public exports. | The current synchronous observer loses association across deferred delivery. It does **not** prove public transactions cannot contain multiple application operations. |
| [Provenance case 12](../../packages/kernel/src/lib/internals/provenance-spike.spec.ts#L266) | Reversal should identify the affected scope and transaction cause, not another actor; the non-vacuity assertion fails with zero effects. | Same private observer requirement. | No reversal attribution is demonstrated. The later `revertedBy` assertions are not reached; do not report a measured wrong-actor attribution. |
| [Open-key descendant](../../packages/kernel/src/lib/open-key-reachability.spec.ts#L17) | An arbitrary descendant promised by the Record projection should be callable; it is `undefined`. | Direct public `signalTree` construction and property access. No enhancer or internal observer required. | Public type/runtime capability mismatch. Calling the absent accessor throws; subsequent descendant access also fails. |
| [Open-key whole assignment](../../packages/kernel/src/lib/e-granularity.spec.ts#L117) | Assigning `{b}` to a `Record<string, Row>` location should install exactly `{b}`; result is `{}`. | Direct public branch replacement. The audit reproduces without the existing test's cast around the write. | Accepted input is discarded: ST2010 warns about `b`, while omitted `a` becomes absent. This is not a harmless partial merge or merely a typing concern. |

The two open-key witnesses are related but independently load-bearing: fixing insertion after a write does not necessarily make a never-materialized descendant usable, and supplying a descendant facade does not necessarily make whole-value replacement truthful.

### Public open-key reproducer

```ts
type Row = { id: string; n: number };
const tree = signalTree({
  rows: { a: { id: 'a', n: 1 } } as Record<string, Row>,
});
try {
  typeof tree.$.rows['neverMaterialised']; // actual: 'undefined'
  tree.$.rows({ b: { id: 'b', n: 2 } });
  tree.$.rows(); // actual: {}, with ST2010 for discarded b
} finally {
  tree.destroy();
}
```

This concerns ordinary branch topology declared with an open index signature. It does not establish a failure in EntityMap's membership API, in closed known-key branches, or in an explicitly terminal `leaf(record)`. Those alternatives do not automatically repair the admitted Record contract or authorize changing its public type.

## Existing decision authority and frozen constraints

### Provenance: preserve the research result; do not revive a rejected product

The [spike](../../packages/kernel/src/lib/internals/provenance-spike.ts) is marked internal, unexported, deletable, and explicitly says not to repair kernel semantics to satisfy it. Its active synchronous frame cannot attribute a later delivery after that frame closes; its compensation accounting relies on an observation channel it cannot treat as a complete settlement record. The current failures demonstrate this implementation's limitations, not an absence of every possible kernel fact.

[TODO.md, ATTRIBUTION-OWNER-0 and MUTATION-OBSERVABILITY-0](../../TODO.md#attribution-owner-0) supplies the existing decision vocabulary: A (current seams suffice) was refuted for the original spike; B (expose/project existing semantic facts) versus C (a new retained semantic fact would be required) was the research discriminator. Later recorded dispositions are narrower and must take precedence over the spike header's old “B vs C not closed” summary:

- Distinct-location association, MO-1A, already earned B through owner/transaction/position identity. Do not treat case 10 as permission to rederive that result or add actor fields.
- Same-location multi-scope attempt history, MO-1B, is deliberately collapsed and closed/out of scope. Correct net-transition composition must not be weakened to satisfy an attribution test.
- MO-2 disposition isolation remains an explicitly recorded open observation obligation; attribution isolation was separately earned.
- MO-3A distinguishes rollback's existing referent from restoration: restoration does not promise a causal parent. `derivedFrom` cannot be invented for restoration to turn research green.
- The later multi-writer section explicitly keeps `STATE-CONSEQUENCE-VALUE-0` closed. Reopening authoritative actor/delegation provenance requires evidence against its original falsifier, not these old expected failures, a renamed capability, or a request to make the suite green.

There is no public provenance guarantee to retract or silently “fix” here. A future exposure/retention decision belongs to the recorded owner-controlled derivation process. Keep these four as visible experimental debt; do not count them as completed public functionality or claim causal attribution from their passing controls.

### Open keys: unresolved public disposition, not permission to erase types

The [whole-value carrier](../../packages/kernel/src/lib/e-granularity.spec.ts#L105) records the preregistered choices: **OPEN-A** dynamic materialization; **OPEN-B1** a whole dynamic value representation; **OPEN-B2** explicit redirection of open-key types at the authoring boundary. **OPEN-C**, secretly treating initial keys as all legal keys, is inadmissible under the declared complete-value law.

The [TYPE-SURFACE-PROTECTION-0 record](../architecture/v15-framework-neutrality-spike.md#type-surface-protection-0--frozen-process-rule) and [typing tripwires](../../packages/kernel/src/lib/type-surface-protection.typing.spec.ts) forbid treating runtime failure as automatic authority to narrow public inference. The prior `string extends keyof T` shortcut erased recursive topology at 23 sites, including hybrid interfaces using Record as a generic constraint, and was reverted. Runtime satisfaction should be attempted first; any public contract change requires the named requirement, reproducer, positive control, measured blast radius, explicit fallout disposition, and owner approval.

This audit selects none of these architectures. The two public defects remain blockers to an unqualified claim that the admitted open-key API works. Publishing with an explicit limitation, changing admission, or choosing a dynamic representation is an owner compatibility decision, not something `.fails` settles.

## Restoration TODO: publicly reachable missing placement evidence

The initial audit left this precondition unproven. The authorized follow-up **demonstrated it through public operations**, then instrumented the unchanged planner only to read its actual inputs. There is no defensible “retained evidence always makes this unreachable” disposition.

[The original TODO](../../packages/kernel/src/enhancers/restoration/restoration.spec.ts#L1626) remains unchanged: “characterizes rollback when both remove anchors are gone and no retained structural fact proves placement.” It originated in `0a131c340d`, beside one-anchor-survives and reused-key-is-not-the-same-subject controls.

### Existing truthful refusal, now executable

[restoration-missing-anchors.spec.ts](../../packages/kernel/src/enhancers/restoration/restoration-missing-anchors.spec.ts) adds four controls: both enhancer orders, each with an empty collection or one unrelated new row after anchor removal.

All writes use public APIs:

1. Create rows `[a,b,c,d,e]` and flush.
2. Open a transaction that writes scalar `1` and removes `b` and `d` under `undoable`.
3. Outside the pending operation, remove `a`, `c`, and `e`; optionally add fresh `z`; flush.
4. Attempt rollback.

Before rollback, the retained remove effects record **defined numeric predecessor and successor SubjectIds**. The passive spy around the real target-derivation function then proves:

- Both structural inverses are additions with remove context.
- Neither recorded neighbour is present in the actual source order or subject inventory.
- Neither neighbour is an addition restored by the same target.
- The planner receives no order delta supplying an alternate endpoint.

No metadata is deleted, no private writer is invoked, no return value is mocked, and no failure is injected. The real planner rejects with `Collection structural target has no live placement anchor`, wrapped in `SignalTreeRollbackError` / `effect-validation-failed`.

The tests assert unchanged whole-tree state, scalar `1` still present, unchanged confirmed count, and identical pending turn IDs. A repeated rollback is still refused without retiring authority. Calling the retained handle's `confirm()` succeeds and clears pending authority without changing the current value. **This pins existing refusal and recoverable ownership; it invents no placement order.**

Results: **4/4 new controls pass**; with existing restoration and transaction safety tests, **141 passed / 1 existing TODO across 3 files**. ESLint passes. Logs: `/private/tmp/remaining-expected-failures/anchors-test.log`, `anchors-related.log`, `anchors-lint.log`.

### Single-restore counterexample: cannot close the general TODO

The original simpler probe's apparent success was not proof of sufficient retained evidence. A second passive probe traced its actual fallback:

```ts
// Start [a,b,c,d,e].
const pending = tree.transact(() => undoable(() => {
  tree.$.scalar(1);
  tree.$.rows.removeOne('b');
}));
undoable(() => {
  for (const id of ['a', 'c', 'd', 'e']) tree.$.rows.removeOne(id);
  tree.$.rows.addOne({ id: 'z' });
});
// Flush, then:
pending.rollback();
// Actual: rows [z,b], scalar 0, pending count 0; no refusal.
```

The unchanged `StructuralStore.resolveSubjectRestorePlacement` was called with recorded anchors `1` and `3`, neither active. It returned the **current unrelated tail**, subject `6` / key `z`, as the placement. The observer called the original method and returned its original result unchanged. Exact reproduction is in `/private/tmp/remaining-expected-failures/anchors.ts` and `anchors-public.log`.

The code explains the split:

- [requiresDeclarativeStructuralTarget](../../packages/kernel/src/lib/internals/causal-runtime/target-transition.ts#L131) does not route a single addition through declarative validation when there is no key handoff.
- [Transaction rollback routing](../../packages/kernel/src/enhancers/transactions/transactions.ts#L1755) takes the other realization path when there is also no order delta.
- [The physical restore fallback](../../packages/kernel/src/lib/physical/structural-store.ts#L516) returns the active tail after both supplied anchors fail, without consulting any other historical placement proof. Blame traces this fallback to `3f868bcc68` (“prepare entity restore before private commit”), not the current audit changes.

This establishes missing usable recorded anchors and the absence of alternate evidence **consumed by that restore path**. It does not claim no historical information exists anywhere else in the system. The decisive finding is that this path does not require such information: it chooses the current tail and retires the transaction. The multi-restore path rejects the corresponding condition. An empty current collection has only one insertion slot; the fresh-`z` case removes that trivial uniqueness explanation.

No new passing assertion blesses `[z,b]` as the required order, and no new expected-failure marker hides this result. **The general TODO remains open because the existing truthful-refusal behavior is not uniform.** The user-authorized scope was characterization, not a production guard change or an ordering decision.

### Decision boundary

The [restoration target architecture](../../RELEASE-1.0.md) requires a complete target derived from retained causal work and validation before atomic realization; owner-qualified subject identity, not reused key spelling, identifies anchors. The existing no-live-anchor rejection is the conservative behavior already executable above. The demonstrated single-restore bypass is concrete production reachability, distinct from the open-key architectural choice.

A subsequent authorized repair may attempt to enforce the existing refusal boundary consistently, with the same atomic-state and retained-authority controls. This audit does not establish that routing every single restore through the other planner is compatible; surviving-anchor, target-dependency, and rekey controls would have to prove it. If the owner instead wants restoration to succeed without the existing placement evidence, the additional ordering authority must be explicitly derived. Arbitrary append/prepend, invented indices, or treating a reused key as the old subject cannot be introduced as a test fix.

## Required honesty in handoff

Carry the counts explicitly: **six expected failures (four experimental provenance, two public open-key defects) plus one still-open restoration TODO and four new passing refusal controls**. The documented single-restore placement fallback is an additional concrete reachability finding; it is not covered by merely counting the six expected failures. Release/source green is a result for the asserted passing contracts, not an “all issues resolved” claim. This audit neither authorizes architectural changes nor upgrades source evidence into packed-artifact evidence. Frozen dist was not inspected as a substitute for current source and was not modified.

## Authorized singleton rollback follow-up — source candidate

The later owner instruction authorized a narrow tests-first repair under the existing complete-target/refusal law. This section supersedes the earlier single-restore runtime disposition **for the current source candidate only**. The baseline and exact published artifact evidence above remain valid; the original TODO is unchanged pending final disposition.

History review found an explicit low-level contract: `structural-store.spec.ts` requires appending when neither historical neighbor survives and normalizing reversed surviving anchors. Commit `cb6c4945fb` deliberately pinned that primitive contract; `3f868bcc68` moved its placement work into preparation. Neither primitive behavior nor its tests were changed.

The first candidate removed the singleton bypass in `requiresDeclarativeStructuralTarget` globally. Its run had **662 passes, one failure, one TODO**. The failing existing test deliberately corrupts an add-effect key before redo: refusal remained, but its message changed from `Unsupported scoped undo effect at structural-drift` to `Collection transition target contains duplicate keys`. This was error-channel drift, not a demonstrated atomicity failure. That candidate was reverted. Log: `/private/tmp/remaining-expected-failures/single-focused.log`.

Two initial new compatibility fixtures also needed correction, separately from production behavior:

- The target-anchor fixture removed `b` before `a` and assumed `[a,b,c]`; unchanged source produced `[b,a,c]`. That output was not promoted into a new expected ordering law. The corrected control removes `a` first, capturing `b` as its after-anchor, then removes `b`, capturing `c`. Its assertion follows that explicit dependency chain. The first sequence's general ordering disposition is outside this narrow missing-live-anchor repair.
- `moveToFront` is not a public EntityMap method. The corrected reversed-anchor fixture uses public `setAll([c,a])`, retaining the existing lifetimes. An attempted root `.subscribe` test hook was also invalid; final publication checks use the supported scalar subscription and the notifier.

The original logs are preserved as `single-controls-before.log` and `single-observers.log`, under `/private/tmp/remaining-expected-failures/`. Corrected fixtures on unchanged production yielded **four intended refusal reds and ten passes**, in `single-controls-corrected-before.log`.

The retained candidate changes only transaction rollback's admission into the existing target planner. The routing predicate can receive current owner-qualified collection truth; when a singleton restoration has recorded anchors and neither is live, it requires declarative target validation. The existing planner supplies the refusal. Surviving-anchor placement, no-original-anchor placement, physical realization, and undo/redo routing keep their existing paths. No new ordering algorithm or public API was introduced.

Current evidence:

- Dedicated spec **14/14**: four earlier multi-restore refusal controls, four new singleton refusal controls, six compatibility controls. The singleton controls cover both enhancer orders, structural-only and mixed-scalar turns, unchanged state/pending/confirmed authority, no notifier or scalar publication, repeated refusal across flush, and later confirmation.
- Focused restoration/transactions/physical/planner suite: **669 passed, one existing TODO, 67 files**.
- Full kernel: **2,681 passed, six expected failures, 13 skipped, one TODO, 313 files**.
- Source typecheck and changed-file ESLint exit zero.

Logs are `single-observers-corrected.log`, `single-narrow-focused.log`, `single-full-kernel.log`, `single-source-tsc.log`, and `single-lint.log` in the same scratch evidence directory. The isolated two-file production delta is `single-candidate-production.patch`; it excludes unrelated working-tree changes.

The exact preserved npm `15.2.1` artifact also reproduces the singleton defect with only public writes and normal microtask delivery. `/private/tmp/opaque-snapshot-review/exact15/restoration-anchor-probe.mjs` exits 1 because rollback succeeds and changes state; `single-exact15-red.log` records both structural-only and mixed-scalar witnesses. Artifact SHA-256: `0a46cd4ee624d59d86fca78aaa4606a3b1b33fa4b3a97fe372a61191d56d7ca9`; integrity evidence remains in `/private/tmp/opaque-snapshot-review/exact15/integrity-proof.json`.

Independent source review and explicit v15 scope confirmation remain required before a port. Main dist is stale after these production edits. No build, pack, publication, v15 source change, frozen-law edit, or existing-test-oracle change was performed by this follow-up.

### Independent review: restoration counterpart remains open

Descartes reproduced public `undo()` and `redo()` counterparts on the stable candidate. A designated remove, followed by ordinary removal of both anchor lifetimes and addition of unrelated `z`, still undoes to `[z, restoredRow]`. A designated add followed by undo, ordinary anchor removal, and redo likewise appends the restored row. The probe uses literal collection name `rows.with.dot` and distinct numeric `1` / string `'1'` keys, without private history mutation. Executable evidence: `/private/tmp/restoration-independent-review/public-restoration.ts`; observations: `public-results.json` in that directory.

The source repair therefore closes only the characterized **transaction rollback** path. It does not close restoration admission generally, and the original TODO remains open. The independent transaction matrix exercised ten cases including missing anchors, surviving anchors, reversed live anchors, originally anchorless singleton, internal target anchors, typed keys, owner collisions, and replacement lifetimes (`results.json` in the same directory). No change to public restoration semantics or v15 source is implied by that evidence. The typing-only TypeScript gate also exited zero (`single-typing-tsc.log`).

## Authorized public restoration and owner-identity extension — combined candidate

The owner subsequently authorized the public undo/redo counterpart repair and the independently reproduced cross-owner identity correction. This section supersedes the transaction-only candidate scope above; earlier logs and historical observations are preserved.

The public restoration extension first produced **eight corrected red tests** (undo/redo × structural-only/mixed scalar × empty/unrelated-row current collection), with the prior fourteen controls passing. All eight failed because the operation succeeded instead of refusing. The initial fixture attempted to compare `getRestorationHistory()` snapshots, but that accessor already throws during historical snapshot reconstruction in the redo witness, before the tested redo call. That pre-existing accessor behavior is not an admission fix; the corrected tests use the public history cursor and `canUndo()`/`canRedo()` to verify retained retry authority. Both logs are preserved: `restoration-public-red.log` and `restoration-public-red-corrected.log`.

`restoration.ts` now supplies the same owner-matched collection source callback as transactions. The singleton predicate accepts recorded remove contexts (inverse remove) and add contexts (redo add); only unavailable recorded anchors select the existing complete-target planner. It does not reroute valid-anchor operations or copy the placement resolver. Focused validation after this extension was **677 passed / one TODO**.

Independent review then demonstrated that the existing multi-add routing predicate conflated equal collection-local SubjectIds across owners. Root-only public witness: `/private/tmp/restoration-independent-review/cross-owner.ts`; original observations: `cross-owner-results.json`. The exact published `15.2.1` artifact also reproduces this in `published-cross-owner-results.json`. Two public regressions—transaction rollback and undo—were red while twenty-four controls passed (`cross-owner-red.log`). The predicate now keeps a `Map<PositionId, Set<number>>`; an anchor counts as restored by the target only within its own owner. No flattened string identity or new ordering rule is introduced. Same-owner internal-anchor positives passed before and after the correction.

Combined source validation:

- **26 dedicated tests pass**: four earlier multi-restore refusal controls, fourteen newly reproduced failures corrected (four transaction singleton, eight undo/redo, two cross-owner), and eight added compatibility controls.
- **681 focused tests pass / one existing TODO / 67 files** (`group-focused.log`).
- **2,693 full-kernel tests pass / six expected failures / 13 skips / one existing TODO / 313 files** (`group-full-kernel.log`).
- Source typecheck exits zero (`group-source-tsc.log`). Final changed-file ESLint exits zero (`group-lint-final.log`); one initial spec-only empty-cleanup lint finding was corrected without changing assertions, followed by **26/26** (`group-spec-final.log`).

All these logs are under `/private/tmp/remaining-expected-failures/`. Candidate-only production changes are isolated in `group-candidate-production.patch`, with exact reviewed source/test checksums in `group-checksums.txt`.

The existing conservative missing-anchor refusal also applies when the current collection is empty. The patch follows the already executable refusal rule; it does not claim that mathematical uniqueness of an empty collection's insertion slot establishes or refutes a new ordering authority. General ordering of earlier multi-remove sequences and the historical snapshot accessor failure are not silently resolved by this patch. The original TODO remains pending final disposition. Main dist remains stale, independent final review is pending, and no v15 port/build/publish or frozen-law change has occurred.

### Final independent source checkpoint

Descartes closed the combined bounded review with no blocker: `/private/tmp/restoration-independent-review/REVIEW.md`. **Nineteen independent case assertions pass**, plus an independent rerun of the **26 source controls**. Public ordinary-write and Link-update undo/redo witnesses now refuse; repeated refusal preserves cursor/flags and emits no outbound publication. A subsequent fresh write still emits current state after natural task settlement. The cross-owner witness now refuses. The three production file hashes match the frozen candidate.

Exact npm `15.2.1` public undo/redo failures are independently recorded in `published-public-results.json` in the review directory, in addition to the published cross-owner and transaction witnesses. Read-only v15 patch applicability succeeded, but no port was performed or authorized by this checkpoint. Main source is frozen and ready for main's fresh build/conformance. Dist remains stale until rebuilt.

This closes the reproduced admission bypasses in the bounded public transaction/undo/redo cases. It is not an all-restoration-behavior claim: the historical snapshot accessor limitation, separately noted ordering question, six expected failures, and original TODO placeholder remain explicit. No frozen ordering law or existing primitive oracle was changed.


## Restoration TODO disposition

At the owner's explicit instruction, the empty `it.todo` in `restoration.spec.ts` was replaced with a comment pointing to `restoration-missing-anchors.spec.ts` and this disposition. **No existing assertion was deleted and no duplicate assertion was added.** Its exact obligation—characterize restoration when recorded removal anchors are gone and no retained fact proves placement—is now executable: refusal precedes mutation/publication, preserves state and retry authority, and consistently covers transaction rollback and public undo/redo, including owner-qualified multi-restore dependencies.

The source production freeze is final: the three production files and the 26-control spec still match `group-checksums.txt`. Only the old placeholder/comment and this evidence document changed after independent review. Main may build and run conformance against that frozen production source. Descartes separately owns the authorized v15 port; this worker made no v15 edits.

Focused recount after removing the placeholder: **681 passed, zero TODO, 67 files** (`/private/tmp/remaining-expected-failures/freeze-focused.log`, exit zero). The dedicated 26 executable controls are unchanged. The prior full run remains historical evidence: **2,693 passed / six expected failures / 13 skips / one then-existing TODO / 313 files**. No second full run is claimed for a comment-only placeholder disposition.

Bounded closure does not choose an order when placement authority is missing, prove that an empty sequence alone supplies authority, repair the separately observed historical snapshot accessor failure, or settle the earlier multi-remove ordering question. It does not resolve the six expected failures. Open-key remains an owner architecture choice with no type narrowing; the four provenance failures remain experimental-observer limitations. Main dist must be freshly rebuilt before artifact claims.
