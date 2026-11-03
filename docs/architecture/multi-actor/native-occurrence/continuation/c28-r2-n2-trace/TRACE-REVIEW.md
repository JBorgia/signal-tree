# R2 n2 comparator trace — original failure preserved

Confirmed: n2's x comparison misses old confirmed a in the issued recipient predecessor. No runtime correction or policy selection. The original repeated-no-write fixture/assertions and first failure remain unchanged in `/private/tmp/st-c28-r2-qualification` and are copied unchanged here.

Separate observational fixture: `candidate/packages/kernel/src/lib/n2-observational-trace.spec.ts`. It executes the same four cleanup declarations, records receipts/root roles instead of asserting the failed no-write target, and continues to confirmation or pending disposal. It retains assertions for callback once, no premature output, useful exact final delivery, settlement, no duplicate, disposal cutoff and registration removal. Its2pass result is NOT a pass of the original no-write oracle.

Run: `corepack pnpm nx test kernel n2-observational-trace.spec.ts --skip-nx-cache --maxWorkers=1`, Node24.15.0/pnpm10.17.0, owned Nx cache/data/temp, external180s group cap. `runs/observational-first`: exit0, no timeout, sourceUnchanged. Original raw `first.log`, command/process/source identities and `N2-FIRST.jsonl` preserved. Source changes are only the explicit diagnostic/trace overlays, not a successor runtime. Native proof/readiness reads serialize identities immediately; they do not retarget proof/decision objects. No uninstrumented replay or line-isolation mutation was performed in this task.

## Exact n2 values (confirm arm; pending-disposal arm agrees)

p=id1 pending, original a=id2 confirmed; fresh current q=id4 confirmed before n2 admission. Inputs captured [p],[p],[]; frame protection[p]. Both source P witnesses and consumed historical inputs are ready. Both x/y masks contain only q4.

At x recipient admission: previous fact8 has a closed requirement and is not pending. Its issued aggregate proof retains p and a in owners, p in destination, p/a in input and validation, p in possible. At y admission: previous fact12 is tentative x; it has no finalized previousProof/factRequirement yet, is present in b.pending, and its native requirement is unready. This is a real sibling-predecessor distinction, not a hypothetical API case.

At reduction:

| Field | Prior/effective predecessor | Result | Remaining difference after mask |
| --- | --- | --- | --- |
| x | fact8/fact8 | no-write=false | prior owners/I/V contain confirmed a2; effective owners/I/V do not |
| y | fact12/fact12 | no-write=true | none |

Both comparisons preserve pending p; D and W are identical. unknown=true, invalid=false, unavailableInput=false, historicalWindow=true, terminalRejectedRoles=0; changed=false and both clean=false. No newly pending obligation or value/flag change explains x's inequality. It is the old recipient certificate that still knows a, after the successful n1 source cleanup no longer does.

This differs from the earlier R1 A/B failure (y proposal readiness). R2 solved that case. Here the source eligibility set is incomplete for a different, legitimate comparison operand: the older issued recipient proof retained by noWrite.

## Terminal continuation

Both arms: n1 no-write, n2 conservative/unknown and supersedes original receipt, n3/n4 no-write. No pre-terminal output. Confirmation sends exactly one `{x:7,y:0}` via n2 receipt (started/surviving), original remains superseded, settled=true, no duplicate. Pending disposal instead gives n2 receipt disposed, resolves settlement and sends nothing, including after p confirms. Both final disposal paths leave no registered operations/bindings and remove the original dependency registrations; subsequent x99 produces no outbound call.

Thus safe terminal progress/cleanup is observed, but approved original-receipt attribution remains violated. No claim of general retention or a repaired implementation. `COMPARATOR-SUMMARY.json` derives the role/flag differences and terminal rows directly from raw observations.

## Source boundary

`lifecycle.currentRelevance` enumerates source P/S/input/C roles. `private.prepareScalar` separately chooses recipient previous via mutation.publicationPredecessors or binding.current. `private.ready` compares that actual prior proof, then noWrite selects effectivePredecessor and deliberately retains the older receipt/operation. Current source support and issued recipient support have different lifetimes. Correcting only one fixture's a, mutating the issued prior proof, or discarding every confirmed owner would not implement the shared contract.

See ALTERNATIVES.md for the requested complete mechanism comparison, source lifecycle inventory, limits and unrun falsifiers. Neither alternative is selected or implemented.
