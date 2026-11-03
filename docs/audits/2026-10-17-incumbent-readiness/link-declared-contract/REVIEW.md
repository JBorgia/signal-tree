# Independent review: conditional declaration contract

Reviewed /private/tmp/link-declared-contract/SPEC.md. Read the earlier immediate-
independence evidence and repository review/contributor contracts in the preceding
review; inspected current `packages/kernel/src/lib/internals/commit-consequence.ts`
for the new compatibility claim. No runtime implementation or tests performed.

## Findings

1. **Clarify validation horizon before API/implementation.** The declaration is
   complete for a synchronous operation, while immutable evidence belongs to each
   destination revision. Admission says validate/freeze before early publication,
   then accumulate known dependencies. It does not yet specify whether delivery waits
   until operation completion (including nested/reentrant work), or whether each
   revision is independently validated at installation. This matters when observed
   evidence contradicts the declaration later in the operation. A started send cannot
   be recalled. Specify the horizon and corresponding expected counterexample; do
   not leave contradictory-declaration atomicity to an implementation convenience.
   This is a finite specification gap, not authorization for another mechanism.

2. **Rejection fallback remains correctly OPEN.** The inspected source executes
   scope-owned consequences only on commit, but releases tree-held ordinary
   consequences after the last scope settles on either outcome. The draft correctly
   avoids turning publication declarations into compensation ownership or an outbox.
   It cannot yet qualify rejection behavior for an old declared receipt. Keeping that
   rule explicitly open is honest and blocks implementation qualification, not this
   directional document. Missing/foreign outcomes and abandonment require positive
   lifecycle evidence; disappearance cannot stand for confirmation.

3. **Use existing rollback errors only in their existing context.** The paragraph
   preserving SignalTreeRollbackError/recovery is correct for transaction failure
   flows. A declaration scope is expressly not a transaction. Its eventual error
   surface must not invent transactional abort/compensation merely because declaration
   validation fails. The draft's separation supports this reading; API review should
   retain it.

## Authority and interpretation

No owner-approval overclaim found. The document quotes approval of conditional
progress with explicit complete declarations and separately states API and
implementation remain unapproved. Hidden omissions are application responsibility;
observed contradictory facts are mandatory lower bounds. It does not claim that a
complete assertion is automatic proof.

Preserving source-qualified owner identities, pending dependencies across trees,
immutable per-revision evidence and net-equal responsibility refresh is appropriate.
Independent write progress is a future test obligation, not an asserted empirical
result. Reentry, partial installation and recovery must preserve actual installed
responsibility without deleting newer work. The document makes those requirements
explicit without pretending they are implemented.

Lifecycle coverage names held/queued/in-flight and cross-tree obligations instead of
inferring collectibility from zero pending transactions. Declared-owner lookup is a
future sparse-work requirement; no unsupported cost claim is made. Existing tree
destruction and connection disposal remain distinct.

## Disposition

Suitable as a reviewed directional draft after clarifying the validation horizon.
No public API selection, runtime acceptance, compatibility change beyond the recorded
owner direction, or release qualification follows. Rejection fallback and exact
error/suspension surfaces remain explicit preimplementation work.

## Finding 1 disposition

Verified the revised admission item 1: form validation/freezing precedes writes;
early publication waits until the full synchronous operation and nested/reentrant
work unwind, then validates all known lower-bound evidence. Incomplete capture retains
installed writes and responsibility conservatively. This resolves the horizon finding
for the directional specification. No rollback atomicity is implied. No remaining
blocker to archiving this draft; the explicitly OPEN implementation boundaries remain.
