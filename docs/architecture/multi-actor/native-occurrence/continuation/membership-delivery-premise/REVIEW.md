# R3 membership reversal delivery: independent source adjudication

Disposition: two concrete membership-delivery defects, not a value-payload oracle disagreement. No runtime/spec edits or independent duplicate test runs. Heisenberg retains runtime/replay ownership. His endpoint was not exposed by available thread tools; raw comparison outputs were found in `/private/tmp/st-r3-membership-discrimination`. Main should relay this source adjudication; direct coordination delivery is not claimed.

## Evidence identity and comparison limits

Root HEAD inspected: 628d302dadb082a48c58528651c9088234d0a777; unrelated dirty root preserved. R3 manifest SHA256 59cdc07d250e7262f09789c3332bd80363f152011d777cc15ca5226ffe69c6c8: independently checked all 3,008 listed files, zero mismatches. Read C0-to-R3 source.patch and R2-to-R3.runtime.patch. EVIDENCE.json preserves raw log hashes, failed names and source check; copied raw C0/R2/R3 logs retain original failures.

Existing Nx logs: C0 273 pass; R2 and R3 each 197 pass/76 fail across seven files. Parsed failed full names match exactly between R2/R3. This locates the regressions before the R3-only membership-phase delta; it does not prove every R2/R3 runtime behavior identical. Comparison command receipts live in the discrimination folder. I did not rerun them.

Important temporal qualification: the currently present C0/R2 test files now have two added MEMBERSHIP_TRACE console statements, whereas frozen R3 does not. Assertions otherwise match in inspected diff. Their current hashes cannot authenticate the earlier uninstrumented run inputs retroactively; EVIDENCE.json records those current hashes explicitly. Do not claim a fully frozen original differential from current files alone. Raw log comparison and source causal evidence remain useful.

## 1. Bulk structural facts delivered twice: 72 matrix cases

Actual failed names cover clear/setAll on either side across both enhancer orders: 36 combinations per order. This is derived from names, not guessed from total count. The assertions report duplicate adds/unmatched removals; these matrix failures do not report final membership divergence or partial-reversal visibility.

R3 entity-signal.ts:4733–4750 opens an ordered membership unit, installs clear's frame with deferred completion, then closes the unit. setAll does the same at 4925–5027. Close computes and delivers the physical before/after diff. Later updateSignals invokes the retained completion (clear 4768; setAll 5050), whose prepareEntityMutationFrame.complete at 1591 sends MEMBERSHIP_FACTS for those same installed mutations.

entity-membership-inventory.ts:304–312 suppresses frame facts only WHILE an ordered unit is open. At delayed completion that unit is already popped, so frameChanges emits the removals/additions again. C0 entity-signal.ts:1479 sent facts before the enclosing bulk close, when suppression still applied. This explains both clear unmatched removals and setAll unmatched removals plus duplicate additions. It is not an event-replica payload mistake: Replica only stores lifetimeId/key and validates predecessor/order.

Contract: entity-signal.ts:1715 says each structural operation reports facts once; entity-membership-view.ts:45 describes one structural unit's end-state changes. Replica deliberately rejects a second remove/add even if its tolerant application leaves final membership correct. Do not weaken that check or require consumer deduplication of distinct sequence numbers.

## 2. Deferred compensation completion escapes delivery hold: four cases

The remaining failed names are rollback listener remove/rekey, in both enhancer orders. The rekey cases additionally report final replica/snapshot divergence; undo and update variants are not reported failing in this log.

transactions.ts:3382 acquires membership hold, installs whole compensation, pushes point.complete into outer deliveries at 3393 and publishes with deferCompletion. The finally at 3396 releases the hold. Outer rollback drains completion.deliveries only later at 4939, after the invalidation group. Point completion calls collection completions sequentially (tree-realization-adapter.ts:842; heterogeneous completion at 1671–1675). Each collection completion now sends its membership facts. With the hold already released, the first event invokes the listener, whose write to the other collection delivers before that collection's earlier-installed reversal event.

Observed failure text is exact key/identity evidence: remove variant `seq4 remove 2 does not match`, `seq5 rekey 2 does not match`; rekey variant two mismatched rekeys plus `after: replica differs from snapshot at left`. This matches the source ordering: reverse right y→a physically, publish left, listener mutates right a→k, then deliver stale-in-order y→a. A correct key-event replay cannot accept a→k while its replica still holds y.

Contract: entity-membership-view.ts:118–123 explicitly requires reversal deltas sequenced in commit order and listener reentry queued after them. The source comment in transactions.ts:3379 assumes installation emits membership facts, but R3 moved them into deferred completion. This stale assumption is the causal seam, not a new policy requirement. Complete-target/undo retains the hold through detached completions at tree-realization-adapter.ts:728–737, explaining the route distinction without claiming all undo cases proven.

## Bounded correction obligation for implementer

Preserve exactly-once structural event ownership and commit-order capture independently of delayed callback/readiness completion. All installed reversal membership events must be queued before any listener can issue a nested write; release delivery only once whole-unit membership is recorded. Bulk ordered diff must remain the single producer for its enclosed frame, even when other completion obligations are delayed. Simply moving every completion earlier risks reopening the joint publication phase problem; simply suppressing all frame facts loses point/selected events. Do not infer fresh neighbours for an earlier add from a later reentered store: frameChanges currently resolves neighbours on invocation (inventory:264), so capture timing matters as well as delivery holds.

Minimum falsifiers: unchanged clear+add and setAll+add matrix cases; unchanged rollback other-collection remove/rekey controls; unchanged undo counterpart; installed completion throwing must still queue later collection facts and release hold; an event listener's nested write must follow all earlier installed deltas. Existing original suite already supplies most controls. No new runtime probes were run by this reviewer. Extra completion-throw/late-add-neighbour discriminators remain not run and are prospective risks, not additional demonstrated failures.

No evidence here authorizes native timing changes, payload oracle relaxation, global event deduplication, or broader integration acceptance. Both demonstrated failures require correction even though one family can converge to the right final membership.
