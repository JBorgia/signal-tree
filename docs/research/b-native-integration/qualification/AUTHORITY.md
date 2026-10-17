# Independent activation and authority inventory

Source: f4d6a7ac30e7aa3c6352627133a702406486c84c, native-ownership-slice worktree. Read-only runtime review. Qualification test files subsequently dirty/untracked belong to other workers; their conclusions are not assumed here. Contracts: docs/review-contract.md, contributor-contracts.md, transaction-semantics-2/LAWS.md L8/L13/L14/L15. No new tests executed in this inventory.

## Activation and absence of silent incumbent settlement

`native-ownership-public-selection.ts` selects the exact enhancer function identity in an internal WeakSet. `transactions.ts:4040` returns the B public adapter before `getOrCreateInternalTransactionRuntime(tree)` at4042. B public adapter constructs its own native driver and uses shared lifecycle/commit-scope infrastructure, not the incumbent transaction runtime. Driver settlement prepares plain members/scalars and native entity deltas directly; native entity module resolves its pending contributions. Thus selected transaction settlement does not fall back to incumbent compensation. Existing direct selected tests assert the B controls getter; retained independent review of public source found no call to incumbent runtime. This proves the selected construction/control path, not that every possible later enhancer cannot separately construct an incumbent runtime.

Default transactions() remains incumbent. Default full suites qualify shared native regressions, not B semantics. A test-only Vitest wrapper of the actual transactions export is appropriate: importOriginal, preserve all other exports, return selectNativeOwnershipTransactions(actual.transactions(config)). Assert actual B controls and peekInternalTransactionRuntime(tree)===undefined in direct-module and public-barrel canaries. Alias/module-cache duplication or setup imports that preload the module must be excluded. Do not use an automatic fallback or alter assertions when B fails.

## Installation route table

| Route | Physical boundary / responsibility | Evidence and limit |
|---|---|---|
| Scalar direct writes, updates and replacement | tree-scalar-slot-runtime prepareInstallation:192, commitSlots:227, commitSlotValue:273, commitRecorded:333; paired terminal record at343 | Previously independently run native/public scalar controls; committed and pending writes use same hook. |
| Plain member presence/removal | member-membership.ts:792 | Boolean presence distinct from present undefined; pending ancestor dependency in driver:73–83; native R1 controls passed. |
| Dynamic plain member construction | materialize-markers.ts:766 prepares before construction; driver:121–143 binds descendants before publication | Existing dynamic plain controls passed. Does NOT establish dynamic entity registration. |
| Existing entity field/row replacement | entity-signal.ts:1349 preparation,1371 record install | Public entity overlap, object-valued field granularity and absent-vs-undefined tests passed in prior 111 run. |
| Entity structural membership/order mutation | entity-signal.ts:729 responsibility preparation; physical/entity-mutation-frame.ts:306 record install | add/remove, rekey, held lifetime, prepend/reentry and order controls passed. Not every method permutation established. |
| Declarative entity target / restoration | entity-signal.ts:4306 target host; physical/prepare-entity-target.ts:244 paired record | Entity restoration/current-truth control passed. Remaining full restoration permutations unqualified. |
| Point realization | entity-signal.ts:526 preparation,551 record install; causal-runtime/tree-realization-adapter.ts:736–758 mixed target/scalar preparation | Prior native restoration and mixed publication controls passed; this is a shared native route, not a second transaction authority. |
| B confirm/reject | driver prepares plain targets and entity partition together, installs, advances physical clock, terminality, publication; public adapter releases consequences afterward | Prior owner overlap, failure/retry, terminality, multi-collection delivery and callback-error controls passed. |
| Link inbound | link.ts:200 root.replace,208 branch accessor,221 collection.setAll,229 replaceLocation; acquire:485 external(() => write(value)) | No special Link setter bypass found: reaches ordinary native setters. Inbound truth with an existing pending contribution still needs dedicated qualification. |
| Link outbound | link.ts:795 scheduleDurableConsequence, public adapter:259 settleCommitScope | Shared commit-scope carrier reused. Outbound speculation suppression, release, async waiters and reentry need Link tests; source reuse alone is not runtime evidence. |
| Destruction | public adapter:87–90 driver.destroy; entity module clears owners/claims/collection registry | Prior public destruction and retained-reference controls passed; no heap universal claim. |

## Latent dynamic boundary at frozen HEAD — supported trigger not established

`native-entity-ownership-experiment.ts:65–82` discovers collections once during initialization. Runtime is assigned only when it encounters a collection; `:326` attaches prepareEntityResponsibility only if runtime exists. Driver dynamic-member registration only recurses writable locations/node accessors; it never refreshes the entity registry.

Two distinct falsifiers are required:

1. Start with no collection; materialize a supported dynamic collection through marker processor/materializeMember; add a row, transact field change, rollback. No initial collection means no entity responsibility hook was installed. Predicted failure: rollback succeeds while entity change remains live, with no B entity responsibility. This is silent missing capture, not silent incumbent compensation.
2. Start with one collection; introduce another dynamically and add/change its row. Existing entity hook sees an unknown owner and throws `Unregistered entity collection` at125 before its responsibility preparation completes. Assert physical state stays unchanged and any older pending handle remains useful.

These were source-derived predictions, not independently executed results. Subsequent independent inspection of signal-tree.ts:1681–1695 shows bindMember calls materializeOrdinaryBranch directly, not the marker dispatcher. The worker reports actual entityMap insertion returns an ordinary accessor and rows.addOne throws before B is exercised. Consequently neither proposed falsifier establishes a supported dynamic entity route. The static registry is a latent limitation, not a demonstrated integration regression. Do not add registration machinery unless a supported route is established.

Also test initially absent plain ancestor containing a newly introduced collection: member presence dependency must survive a later pending entity write. Refreshing the registry alone would not prove the pending-ancestor requirement. Cheapest control: owner A introduces branch/collection; owner B writes its row; reject A then B, require useful coherent outcome or atomic documented refusal with usable authority. No arbitrary disappearance of B's installed state.

## Boundaries of conclusion

No supported-route blocker demonstrated by this source inventory. Dynamic registry/hook coverage remains a latent limitation with no supported acquisition route established. Arbitrary allocation failure/OOM and monkeypatched native Map/Set corruption are outside the supported preparation-failure proof. Actual qualification tests and all-B full suites remain unrun by this reviewer in this phase. Previous independent 111/111 focused run establishes its named paths only. No new API or production acceptance recommended by this inventory.

## Link evidence interpretation

Reviewed worker Link source and preserved destruction counterexample, not independently rerun. Link dispose at898–922 explicitly resolves held observations, waiting sends and settlement waiters. No tree-destruction subscription was found. Existing link-reactive-settlement.spec.ts:534 requires settlement in its chained-write scenario and explicitly defers whether tree destruction also disposes the relationship. The new tree-only pending-transaction cancellation case establishes a narrower baseline-matching unsettled waiter; the lack of automatic disposal does not negate that observed settlement limitation. Explicit-disposal controls are valid cleanup qualification, but cannot be described as proving tree-only settling. Treat both incumbent/B red results separately from the supported Link controls.
