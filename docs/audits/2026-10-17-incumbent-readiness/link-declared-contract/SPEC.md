# Conditional Link publication: declaration contract draft

Base 4a678e916f8a964916ebe4d33a8cb78697a72e35. Specification only: no API name,
export, callback syntax, implementation, release or artifact acceptance selected.

## Recorded owner authority

Owner selected: “Allow conditional progress through explicit complete ownership
declarations; application owns hidden-input omissions (recommended if retaining
same-tree live proposals).” The question explicitly states: “no API or implementation
is approved by this choice.” This approves the responsibility direction. The detailed
rules below are a reviewable draft, not a claim that every edge policy is approved.

Production conservative hold stays unchanged. The obligation for future qualification
is useful conditional immediate progress plus honest application responsibility;
undeclared ordinary writes have no newly promised automatic independence. Existing
unrelated-work safety, coherent publication and useful delivery requirements remain.
B and the failed owner-window mechanism remain closed.

## Meaning and unit

A declaration describes PUBLICATION dependencies, not which transaction captures,
compensates, confirms or rejects an ordinary write. It supplies a complete conservative
set of transaction owners whose pending state may influence a specific newly authored
outgoing revision, including control/trigger inputs. Empty set explicitly asserts none.
Omission is unknown, never shorthand for an empty set. Extra owners may over-hold;
missing hidden owners may leak speculation and are application errors.

The declared operation must be bounded and synchronous. Each resulting destination
revision receives its own immutable evidence; no reusable field/connection-level trust
flag. An operation writing several fields does not authorize a whole outbound object
unless every contributing field and structural fact is accounted for. Initial slice
should be scalar; entity/order/lifetime support cannot be inferred from it.

Owner identities must be authentic, namespaced by source, non-reused for a replacement
transaction and connected to authoritative outcomes. Caller-supplied integers/current
pending counts are insufficient. No new token API is selected. Declarations are copied
at admission; mutating a caller array later has no effect.

## Discriminator and retained values (illustrative, no selected syntax)

| Operation | Complete declaration | Required conditional outcome |
| --- | --- | --- |
| Literal y(7), unrelated p pending | empty | Publish without waiting for p |
| y(x()), x supplied by pending p | p | Hold while p pending |
| Read x into saved before operation, then y(saved) | p retained by application | Same hold; entry time does not erase p |
| Same saved value, declaration absent | unknown | Conservative path; no immediate-progress guarantee |
| Same saved value, false empty declaration | incorrect application assertion | May leak if unobserved; must be a negative control, never a safety pass |
| Runtime already knows p contributes, caller declares empty | contradiction | No unsafe publication; declaration cannot clear p |
| Native cached value | all actual possible contributors, declared by app | No forced native recomputation or inferred clean cache |

The application must preserve contributor information with retained inputs. A function
wrapper cannot recover it from primitive equality. Async continuation needs a fresh
declaration covering its retained inputs; ambient declaration ends at return, throw or
first suspension. Returning a Promise must not silently extend the original scope.
Exact sync-API/type treatment remains for API review.

## Admission, reentry and failure

1. Before writes, validate declaration identity/completeness form and freeze it.
   If these checks fail, installation remains untouched. Early publication waits
   until the bounded synchronous operation and its synchronous nested/reentrant
   work unwind. Validate the accumulated known lower bound then; no earlier send
   may escape before a later contradiction in that operation is discovered.
   Validity does not imply rollback atomicity. If completion/capture is incomplete,
   retain installed writes and responsibility on the conservative path.
2. Accumulate any known dependencies from active transaction attribution, supported
   trigger evidence, inherited scopes or tracked reads as a mandatory lower bound.
   A complete list omitting a known owner cannot replace valid responsibility. Merely
   knowing an owner exists elsewhere is not a dependency or a contradiction.
3. Do not let a nested empty declaration erase inherited known evidence. Reentrant
   observers do not automatically inherit a clean certificate from their caller;
   they need trigger/context evidence or their own valid declaration. A callback's
   literal output is not automatically independent of its speculative trigger.
4. Installed state and its responsibility must become live coherently. A failed
   post-install validation/capture must prevent early publication and retain usable
   responsibility/recovery; it cannot delete reentrant work. Do not invent a new
   wrapper error contract. Existing successful-abort identity and failed-abort
   SignalTreeRollbackError/recovery semantics remain requirements.
5. Callback throws do not erase valid evidence on already-installed writes. Scope
   unwinding uses finally; incomplete capture remains conservative. No promise of
   universal process-level out-of-memory recovery.
6. A later authored revision gets new evidence, even at equal value. It supersedes
   only its queued revision; no declaration relabels historical payloads or other
   derived copies. Existing ABA responsibility observation is a requirement, not
   proof that its research implementation is production-ready.

## Outcomes and compatibility boundary

Proposed additive interpretation: a declaration is eligibility for EARLY publication,
not a request to turn ordinary state synchronization into a cancellable outbox.

- Complete empty evidence, or complete evidence with every relevant owner confirmed,
  may publish early while unrelated owners remain pending.
- Refusal retains pending responsibility. Missing owner, destruction and disappearance
  are not confirmation. Mixed/multiple owners need each relevant pending owner resolved.
- Rejection/abandonment invalidates the all-confirm early proof. It does not itself
  cancel an ordinary installed write, nor retroactively assign compensation ownership.
- Existing ordinary conservative synchronization still publishes current surviving
  truth when its existing settlement gate permits it. Any known foreign pending
  dependency must also remain held; target-tree drain alone cannot bypass it.
- A fresh write after rejection is newly authored truth under the approved surviving-
  write semantics. It may declare independence from that now-rejected historical
  input, but must account for other actual pending dependencies.

Compatibility evidence: commit-consequence.ts at the base revision distinguishes
scope-owned work (commit runs, discard drops) from ordinary tree-held work (released
when all scopes settle after either outcome). The latter is not an outbox cancellation
contract. Existing declaration-free behavior must not silently change.

OPEN BEFORE IMPLEMENTATION: specify and qualify the exact fallback transition for an
older declared-dependent receipt after rejection. The additive interpretation above
is the compatibility-preserving proposal, not a tested rule. It must send a coherent
current eligible projection through the existing delivery contract, not resurrect a
historical receipt or read arbitrary inspected state. A permanently vetoed old receipt
or automatic cancellation would be a different observable product choice. Do not
relabel rejection as confirmation to obtain fallback progress. Cross-tree abandonment
and inaccessible terminal outcomes also need a bounded lifecycle rule; they cannot
be resolved from pending-count disappearance.

## Delivery and lifecycle requirements

Eligibility is only one condition. Preserve exact payload/revision pairing, coherent
installed state before delivery, final preflight validation under observer reentry,
queue supersession, serialized in-flight corrective sends, and existing endpoint-error
handling. A declaration grants no exactly-once/durable/crash-recovery guarantee.

Connection disposal prevents unstarted work and detaches subscriptions; started I/O
may complete and cannot be recalled. Tree destruction remains distinct under existing
contracts. Reference accounting must cover held/queued/in-flight receipts, active
validation, outcome waiters and cross-tree dependencies. After all live obligations
drain, source subscriptions and records must be reclaimable. Authentic identity must
not require permanent historical maps. No correctness claim from pending-count zero.

Lookup should follow declared owners/affected destinations rather than scan unrelated
trees. This is a future acceptance condition, not permission to optimize the rejected
owner-window mechanism. Owner registration/composition must itself be atomic.

## Fixed future qualification cases (not run)

- Exact literal/copy pair with correct declarations; pending owner remains open.
- Saved-input, async and cached-input declarations; missing declarations hold.
- Hidden-owner omission leaks or remains held explicitly; record app responsibility.
- Observed-owner omission rejects early admission; valid existing state/evidence survive.
- Multiple/foreign owners, confirmation, refusal/retry and terminal outcome monotonicity.
- New overwrite after rejection and older-receipt fallback remain separate assertions.
- ABA, nested/reentrant writes, callback throw and failed-abort usable recovery.
- Queued/in-flight supersession, endpoint failure/retry, dispose and tree destruction.
- Full snapshot composition cannot borrow one scalar's empty declaration.
- Fixed touched-owner work across growing unrelated trees; post-drain reclamation with
  held references and genuine cross-tree obligations. No cost superiority inferred.
- Public facade/type feasibility and all four framework controls before API acceptance.

## Remaining selection work

Owner approved application responsibility, not these API details: operation versus
revision binding syntax, authentic owner access, treatment of async callbacks, errors
on contradictory declarations, and the older-receipt rejection fallback. A reviewed
public surface must express these facts without internal tooling IDs or magic clean
constructors. No application-facing helper is exported by this document.
