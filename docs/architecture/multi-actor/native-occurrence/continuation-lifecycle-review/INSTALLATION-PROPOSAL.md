# Invocation installation receipt — prepatch supplement

Read against frozen explicit successor. No runtime edits. This supplements SEAM-PROPOSAL.md: consumed and installed are independent facts; close only releases invocation references and does not erase installation evidence.

## Source-backed failure in terminal handling

transactions.ts:4900 creates completion={selected:false,committed:false}. applyRollbackCompensation:3810–3856 delegates the ordinary per-effect route to realizationPort.applyAtomically without marking selected. rollback():4931 then treats any shared physical clock advance as successful compensation after an exception. A nested interceptor write can advance that clock while the intended inverse never executes. Likewise, the unconditional installed=true after rollbackPendingEffectsThroughRealizationPort returns misclassifies a swallowed failure or skipped proceed.

Existing prepared routes already have the needed distinction: installPreparedCompensation:3370 marks selected, and :3389 marks committed at install; rollbackPendingTarget:3402 marks selected and its onCommitted:3594–3601 marks committed before delivery. Reuse that meaning: selected means exact completion accounting was chosen, not that the writer consumed its payload.

## Receipt and transport

Use a separate private installation receipt, scoped to the particular compensation attempt/effect. It holds only status plus first failure if necessary, not payload, endpoint, source row or target. The continuation request holds a reference to this receipt while open/executing. Clearing the request does not clear receipt.installed. A retry gets new invocation and receipt; never reactivate the old ones.

The receipt is supplied explicitly alongside the selected endpoint to applyEffect, through the selected binding continuation, writeField/shared private update/replacement, into the existing commit function. Do not store receipt in ambient metadata or infer it from clock/value equality. The installer receives a kernel-owned idempotent markInstalled operation; user interceptors receive neither receipt nor markInstalled.

Private handoff representation therefore becomes request={value,selection,installation}, with selection still the unchanged certificate. Terminal consume takes that request once. The consumed selected context can flow to the commit implementation as explicit {selection,installation}; public callers supply neither. Existing restoredFields remains the proof transport; the receipt is completion evidence, not support or a new owner.

## Exact install marks

Direct value path — entity-signal.ts:commitExistingSubjectValue:2258–2266:
valueStore.installValueTransition;
ordinaryPlan.install;
installTerminalRecord(publication.unit.record);
MARK THIS INVOCATION INSTALLED;
capture callback;
clock advance;
entityPublication.complete.

Mark only after the selected value/ordinary support and its terminal record are installed, before capture, publication or outer projection observers can throw. No mark on prepare, validation, equality, consume or a nested independent write. A semantically equal realized inverse can still install selected support; successful execution of this actual installation block is the fact, not a nonzero value diff.

Frame row/absent-field path — entity-signal.ts:1374 passes installOrdinary into frame.commit. physical/entity-mutation-frame.ts:394 executes it after physical placements/values and before observeCommitted at :399. Put the selected receipt mark at the end of that installOrdinary closure, after ordinaryPlan.install and publication terminal record installation. Do not mark only after frame.commit returns: its observeCommitted callback can already throw. Pass the receipt only for this explicit selected row replacement, never for unrelated frame calls. Existing preparation revision/lifetime checks remain in force.

## Completion at dispatch exit

Root selected dispatch closes/clears request in finally, without throwing. Outside cleanup:
- If the selected body/chain threw, preserve that primary error. Receipt tells transaction handling whether installation preceded it.
- If the chain returned but receipt is not installed (skip, deferred-past-return, consumed body error swallowed), explicitly refuse the selected application. Do not call it successful just because there was no propagated error. Capture a terminal-body failure on the receipt before rethrowing so a swallowing interceptor does not hide the original failure; use it as refusal cause when available. A skip with no body failure gets a private selected-write-not-installed error.
- If installed, no lifecycle guard retroactively makes it uninstalled. An observer/interceptor throw after installation follows the existing committed-on-error terminal disposition.
- A deferred continuation sees a closed invocation and cannot install; synchronous coalesce(proceed) drains before root exit and may install normally.

## Bridge to transaction completion — required before implementation

For the built-in ordinary selected route, exact per-attempt receipts must reach the completion object passed to applyRollbackCompensation, including an exception before applyAtomically returns. Set completion.selected=true before any selected dispatch can run user code, and derive completion.committed from actual required installation receipts, never from consumption, return success or an unrelated clock. rollback():4931 will then take its existing completion.committed branch; the selected route must not fall back to clock. Check receipts on normal return too, before outer apply() sets installed=true.

Bounded transport proposal: private effect-attached attempt receipt metadata, assigned to the already-selected inverse effects before passing them to the built-in adapter. Explicitly preserve it through prepareOrdinaryEffects/physical placement and pass it into applyEffect. It must be distinct from persistent field endpoint/history metadata: attempt receipt lives for this compensation only. Retained proceed holds a cleared invocation; it does not retain an effect. Verify actual clones, rather than assuming Symbol propagation; a missing expected receipt is a refusal before installation. No new TreeRealizationPort/SDK export and no alternate planner. Existing custom ports without this private transport must not be declared covered by this slice.

IMPORTANT remaining review boundary: do not equate 'one selected receipt installed' with 'all selected compensation installed'. Ordinary applyAtomically can contain membership installation, scalar/heterogeneous frames and multiple per-effect calls (tree-realization-adapter.ts:608–630). For a multi-unit attempt the completion ledger must represent every required unit in that chosen route, or retain an explicit partial state. Marking completion.committed from a single paired field would misclassify partial completion. Existing complete-target routes keep their onCommitted mark. Before coding the bridge, confirm the internal per-attempt hook/receipt transport for these units and the existing partial-failure disposition; do not change that disposition by silently selecting a new planner or applying a blanket any/all rule to the whole port. The single selected-effect cases have exact install sites above; this document does not pretend that proves all mixed routes.

## Discriminators before patch

Keep Hume3 and Main scope3 unchanged. Add real rollback cases:
1. interceptor writes independent13, never calls proceed, returns: rollback refuses, independent13/support retained, pending turn not terminally rejected merely because clock advanced;
2. terminal preparation fails, interceptor swallows: no installation receipt, still refuse; preserve original failure cause;
3. source installs then intrinsic observer throws: installed receipt true and existing rejection/cleanup disposition preserved;
4. source installs then interceptor throws: same installed-on-error result, primary error preserved;
5. synchronous coalesce(proceed): installed before scope exit; saved deferred proceed after return: no installation and no replay;
6. fresh retry creates fresh receipt; earlier failed/closed saved proceed cannot alter later truth;
7. mixed or multiple selected effects with failure after an earlier installation: preserve current native disposition explicitly, no unrelated-clock inference and no invented atomicity claim.

Keep held-continuation reference clearing control: request/value/endpoint/target gone after close/consume, installation receipt remains a small result only. User-retained operation.value and history-held support are separate obligations. No heap-release claim from record counts.
