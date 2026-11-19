# Adversarial public equal-owner specification — C23 baseline

Specification only. No execution, runtime/test implementation, new API or mechanism-author conclusion consulted. Inputs and exact hashes in INPUTS.json; original raw fixtures/failures copied under preserved-inputs. Source baseline C23 manifest bc8926949819af2cab3b716b71a04b6f3f97a6be5117b954bbfa236b66dec90b. This plan does not infer correctness from private maps or a proposed repair strategy.

## Governing contract and harness

The preserved EQUAL-WHOLE-AUTHORITY.md permits fresh authorship for explicitly replaced UNOWNED fields whose old hold is only possible dependency. It expressly preserves actual pending destination ownership, rollback/inverse/net-zero behavior and value-notification suppression. Observation/reorder/replay does not become fresh authorship. Publication declaration is a complete input claim, not ownership transfer, acknowledgment or a promise to cancel async work. The kernel README preserves current SignalTree snapshots while framework-created native computed/effects keep their own timing. Inspection egress tests distinguish local/physical display from ordinary externally eligible truth.

All actual interactions use supported facade trees, transactions and authentic handles, link, public setters/whole replacement/updater APIs, inspection at the existing DevTools boundary, public receipts and endpoint callbacks. No lifecycle/native-view/requirement maps, forged owner handles, injected preparers or test-only private frame commits. C23 does not yet type declare publicly: preserve the original local capability cast when testing unchanged C23; use approved public types only on the later API candidate. A cast calls the existing public-shaped method, not an internal implementation entry point.

Every fixture starts from a fresh tree and Link before the pending write, drains setup before assertions, and retains every endpoint payload without clearing unexpected sends. Copy endpoint payloads at invocation, so later mutation cannot repair a stale send in the log. Record callback counts, receipt snapshots and public owner inspection before/after declaration. A settled promise is armed before the hold checkpoint and checked after bounded microtask/framework drain, never awaited while deliberately held. All cases end with useful terminal progress or explicit disposal; always dispose/unmount/destroy. Do not turn no traffic into a passing test without a positive release assertion.

Use exact original raw fixtures as predecessor evidence; do not edit their assertions in place. The existing React first failure is actual outbound {x:7,y:0} while the destination owner remains pending, not merely a receipt mismatch. The independent raw direct-row counterpart distinguishes superseded receipt from delivery failure. These are different questions.

## Mandatory paired controls

### E1 — actual owner survives an equal explicit replacement

Start ordinary pair={x:0,y:0}. Link the pair. p=tree.transact(() => write x=7); drain. Assert displayed/source x7 and sent=[]; save p.inspect(). Then declare independent and explicitly replace pair with fresh literal {x:7,y:0}. This is not an updater and does not read old speculative data in the callback.

After drain: callback once; no throw for this independently supplied literal; physical/source remains7; p.inspect unchanged; value leaf notification count0 for the equal replacement; sent=[]; settled still unresolved. Receipt is immutable and not started/no-write/superseded/disposed. The raw oracle permits held or conservative at this intermediate boundary; record the exact state/reason rather than invent a new status guarantee. Never accept eligible as evidence of a send or reinterpret started as “only selected.”

Run separate terminal successors from identical setup:
- confirm p: exact one payload {x:7,y:0}; settled resolves; no subsequent duplicate. Valid current receipt reaches started, or, only if an observable later source operation actually replaced it, a terminal superseded receipt is accounted for separately (E4).
- rollback p: exact one surviving payload {x:0,y:0}, never7 before/after; local/native read0; settled resolves. Do not require the original receipt to become started when rollback created a newer operation. E4 pins that distinction.

Instantiate as scalar leaf literal7, ordinary branch/root whole frame, entity field literal7 and direct-row whole {id:'a',x:7,y:0}. Direct collection replacement with the same row is a separate source/shape: keep source and payload assertions explicit rather than assuming row Link covers it. Small domains only. The scalar/frame variants must demonstrate the same ownership preservation; do not make the test inspect how the implementation stores ownership.

### E2 — possible-only unowned value must make useful progress

Same values and sources, but q is on an unrelated owner tree z; open q setting z7, then write destination x7 OUTSIDE any transaction and outside declaration. Drain and establish the original ordinary hold with sent=[]. Declare independent explicit equal literal/whole {x:7,y:0}. Expect exact one payload7 (matching source shape), receipt started/declared, settled resolves WHILE q remains pending, q.inspect unchanged and q.z7 unchanged. Equal value notifications remain0. Separate q.confirm and q.rollback successors must neither duplicate7 nor change the destination. Later real destination update8 must still send8.

This paired case kills blanket “never refresh equal evidence” and “hold for any pending owner” repairs. If setup sends before the equal declaration, fail the setup rather than continuing with a vacuous progress assertion.

### E3 — confirming the destination author does not settle a consumed input

Use TWO trees to prevent a direct linked x-owner from explaining the hold. Source has x0; target has pair={y:0,z:0}. q=source.transact(() => source.x=7). Then p=target.transact(() => source.updateAndReport(input => { write target.pair.y=input.x; return {}; })). This is the existing public aggregate-input consumption pattern, not an outside sampled read or private proof injection. Link target y (then a separate whole-target-pair counterpart); no linked payload contains source.x.

After p installs y7, declare independent equal y7 / literal pair {y:7,z:0}. No send while p and q pending. Confirm p while q stays pending; prove q.inspect unchanged, y still7, no send and unsettled. After q.confirm, exact one target payload7, useful receipt terminal outcome and settled resolution, no duplicates. Add a distinct later unrelated r pending after both confirmations and a changed independent target write8: must progress without waiting for r. This distinguishes surviving actual input q from historical/ambient possible-owner retention.

Do not add a q-rollback oracle by guessing how confirmed p's surviving value is projected after rejected input; that is a separately approved post-rejection policy question. This mandatory discriminator uses q.confirm and has an unambiguous release.

### E4 — receipt supersession is not payload loss

Keep the raw direct-row rollback counterpart as a distinct oracle: held independent equal row replacement, rollback p, exact payload {id:'a',x:0}, settled resolves, original receipt superseded. Never rewrite this to started merely to match another source route.

Add an explicit, unambiguous replacement: while r1 is held, a second public source operation installs a different current value and yields r2. Record which operation becomes eligible and publish its exact latest value once after required owners settle. r1 must become terminal superseded and remain unchanged after r2 delivery/disposal; do not insist r1 started. Assert r2/current operation's useful delivery and terminal result. If a source route intentionally shares an operation, do not fabricate supersession: retain the raw exact direct-row fixture as the normative superseded case and choose an actual changed successor revision for this discriminator.

Frozen snapshots retained before transition must stay byte/value unchanged; subsequent read may return another immutable snapshot. Receipt has no cancellation/ack meaning. A held disposal variant must resolve settled, make the held receipt disposed, leave authentic owner.inspect unchanged and prevent delivery even when the owner later settles. A started receipt remains started through later disposal.

## Framework counterparts without timing substitutions

Run the E1/E2 core pair on neutral plus Angular, Vue, Solid and React using each public facade exclusively. Add both scalar and whole-branch source variants, with confirm/rollback branches kept separate. Do not multiply every secondary discriminator across every facade initially; E3/E4/inspection/reentry can start neutral plus the already-failing React branch, expanding only on evidence.

Angular: native signal/computed/effect/TestBed patterns already in its specs; leaves .set, branches/whole writes through actual declared facade APIs. Vue: .value leaves, real computed and scheduled effect/watch with existing nextTick helper. Solid: createRoot/createMemo/createEffect and real .set leaves, retaining owner disposal. React: renderHook/useSignalTree with act, as the preserved raw fixture; no invented native computed carrier. Read facade types for whole-row/branch syntax rather than forcing a neutral callable onto a native leaf.

Assert native display7 before and after an equal write, and display0 after rollback at the framework's established flush point. Instrument notification/effect/render counts only after baseline settling. Equal writes must not cause value-change notifications; do not equate subscription call count with render count across frameworks or demand eager computed reevaluation inside installation. The public endpoint payload order, owner inspection and settled behavior are common assertions across facades.

## Inspection, equality and reentry adversaries

### E5 — physical equality must not erase ordinary ownership

Use the existing DevTools enhancer/extension-subscribe harness and JUMP_TO_STATE message route (devtools.spec.ts and devtools-impl.ts:1535–1569/1623). That real boundary writes inspection participation. Do NOT use ordinary undo/jumpTo as inspection, and do not call private withWriteContext to make a purported public case.

Set ordinary x7 under pending p; use inspection replay to display x9. Assert local/native9 but sent=[], p.inspect unchanged. Then independently author an explicit literal9 equal to displayed PHYSICAL state. This is a changed ordinary value (ordinary was7), not E1's equal ordinary no-op. Even if adoption is valid, p's pending claim cannot disappear: no9 may escape while p pending. After p.confirm, the independently authored surviving9 must progress once; after p.rollback in a separate fixture, assert the existing rollback rule against this later ordinary write (preserve predecessor rollback/value oracle; do not invent it from the inspection display). Add an unowned possible-only counterpart: ordinary7 under unrelated q; display9 by inspection, explicit independent9 adopts ordinary9 and progresses without q. Verify replay alone never sends9.

Add the converse: while p owns ordinary7, inspection displays0; equal ORDINARY literal7 must still preserve p, and only confirm/rollback may release the appropriate ordinary payload. This separates comparing physical equality from actual ordinary authorship. Do not use record-internal snapshots to decide expected values: observe local display, owner inspection and endpoint results.

### E6 — explicit authorship is not observation or derived-input permission

Possible-only q/unowned x7 setup: mere source read, fresh object construction with no setter, and receipt from empty declaration must not refresh support or send. Empty declaration receipt exactly no-write. Reordering a collection without supplying new field values is not whole-field authorship; preserve its existing membership events, but no equal field proof refresh may be inferred from reorder alone.

Contrast E1's independently supplied literal with a derive callback returning its input while x is actually owned by p. An independent declaration cannot deny observed native input ownership: retain the existing contradiction/error contract for such callback forms; use dependent[p] as the positive counterpart, held until p settles. Preserve callback invocation count/primary thrown value. This rejects an optimization that treats all equal values or all returned objects as explicit independent authorship.

Use source-owned equality (fresh structurally equal ordinary objects versus genuinely changed object and same-reference observation) and existing scalar/custom equality controls; do not invent a new public comparator option. Keep getters in separate fixtures with counted access and existing supported input behavior. The plan does not assign an arbitrary getter-call budget absent a frozen predecessor contract.

### E7 — reentry must not steal outer context or overwrite newer truth

Use supported public callbacks only. In a whole-frame fixture containing equal owned x7 plus changed unowned y1, a guarded public onChange callback performs a nested independent declaration on another Link/tree with value9. Record entry order, callback counts, both receipts, both payload streams and p.inspect. The nested independent sink must progress9; outer aggregate still cannot publish x7 while p pending. Then confirm p and require exactly latest {x:7,y:1}, with no duplicate nested9. Do not use an equal-only write as the trigger: equality suppresses value notifications, making such reentry coverage vacuous.

A separate equality/input getter reentry fixture should mirror the existing supported refusal contract: getter or existing callback changes the same source while outer whole preparation is open. Preserve the first thrown object/stage and exact installed newer value; do not accept an old payload merely because the receipt is eligible. This is a fixture to derive from unchanged source-finalization reentry tests, not a license to assume all getter writes are accepted. If no supported callback can reach the intended point, record the limitation and stop; no injected private observer fallback.

After callback throw or reentry refusal, perform a fresh public independent write on a different tree. It must not inherit the exited declaration or transaction, proving context cleanup with useful publication. If the original callback throws after a write, preserve installed-write/primary-error behavior; do not demand rollback of authored writes. Retain original raw refusal messages rather than broadening assertions for the repair.

### E8 — held endpoint payload and stale continuation

Use an actual endpoint promise to keep the first VALID send in flight; while it is pending, create a newer owner-held equal-replacement scenario on the same Link. Resolving the first endpoint must not acknowledge or release the newer held value. Only its real owner settlement may start the next payload, which must equal the latest public source projection. Reentrant endpoint callback may author another changed value in a guarded way; assert useful final delivery and no stale duplicate, with each receipt tied to its own operation. Do not use private admission-ready hooks. Started means endpoint invocation, while settled waits for the relevant pending send/held work.

## Acceptance and first-failure rules

Preserve unchanged C23 raw failures and explicit source identities separately from new fixtures. Before interpreting a new failure, require setup evidence: actual pending transaction inspection; physical value7; no initial endpoint send; native observer established; callback trigger actually ran. Do not rewrite originals to repair a fixture mistake. A fixture correction gets a distinct file/log and rationale.

Hard failures: speculative owned value sent before settlement; unowned possible-only value never progresses; p confirmation drops still-pending q input; wrong/latest payload loss; duplicate send; rollback changes/no-op notifications differ without contract authority; leaked context; disposal starts new work. Receipt-only discrepancy is adjudicated against operation supersession, never used to dismiss an actual sent-value failure.

No pass/failed result is claimed for this plan. No full suite, large row workload, custom callback matrix, SDK/export change or runtime implementation is proposed. Any later execution should be small, serial and separately authorized; Main owns composition and runtime acceptance.
