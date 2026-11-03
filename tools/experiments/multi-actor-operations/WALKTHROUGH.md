# Current consumer walkthrough

This is an experimental, in-session application reference, not a published API
or a production authentication service. The [verification ledger](VERIFICATION.md)
identifies executed checks and the library artifacts. Native conditional Link
work remains separate; these examples do not activate it.

The historical browser runner verifies the pinned 5727cd8f package artifacts.
A clean candidate includes those inputs in a small archive, not an installed
consumer or dependency cache. Restore its two tarballs and original identity
receipt before replaying this historical reference:

```sh
tar -xzf tools/experiments/multi-actor-operations/installed/evidence/5727cd8f-inputs.tar.gz -C tools/experiments/multi-actor-operations/installed/evidence
```

These archived packages are historical reference inputs, not the selected v16
candidate. The comparison runner additionally requires the identified external
installation described in its README; source composition does not recreate that
installation or give its historical results current qualification credit.

Run the installed Angular reference from the repository root:

```sh
node tools/experiments/multi-actor-operations/installed/browser/run.mjs
```

The runner compiles a strict AOT application from verified installed tarballs and
executes real DOM scenarios. Its application is [app.ts](installed/browser/app.ts).
It uses an in-browser test authority. The separate [HTTP composition](http/README.md)
exercises a real server boundary; the browser's static server is not its backend.

## Follow one change

1. **Capture inputs before producing a proposal.** The host obtains an observation
   containing values and versions, supplies it to its producer, and passes the same
   observation to `backend.proposal(patch, reads, observed)` when the producer
   finishes. Passing the original observation preserves its preconditions; the host must
   not substitute newer versions without recomputing the proposal. Include write preconditions and every relevant business read.
2. **Create a draft and local preview.** The operation coordinator records immutable
   proposal data and an application-owned unique operation ID. The application
   retains the native transaction handle separately. The coordinator never owns
   rollback effects. DOM input has unknown executor attribution; a host label is
   only a declaration, not authenticated identity.
3. **Review the exact revision.** `review(id)` returns a frozen binding. Changing
   the proposal invalidates that review. Stream completion does not approve it.
4. **Apply through the authority boundary.** Explicit Apply obtains a host-issued
   grant for the exact command, then records local consent and transmits it.
   Backend permission, domain checks and version preconditions still apply.
   An actor label or client `approved` field cannot mint a grant. In production,
   this authority must be outside the untrusted client.
5. **Keep an ambiguous attempt unresolved.** A lost acknowledgment keeps the same
   command and grant for retry. Attempt identity changes; business command identity
   does not. Only a correlated terminal receipt establishes acceptance or rejection.
6. **Settle local state after the remote decision.** Revoke the grant after receiving
   a terminal receipt. Confirm or reject the native transaction as appropriate.
   If local rollback refuses, retain its handle and the remote outcome. The UI's
   local-recovery action never retransmits an already-terminal command.
7. **Clean up only when responsibility ends.** Forget terminal operation records,
   unsubscribe and destroy the tree after local settlement completes. Supported
   lifecycle observations distinguish a refusal from an observer error delivered
   after successful settlement. Absence from a pending list alone does not prove
   the intended disposition.

The reference refuses explicit disposal while a command is uncertain or native
settlement remains unresolved. That is not a navigation guard: an Angular view can
still be destroyed. A navigable application must use a reachable session owner or
its existing route guard; reload/restart requires durable backend recovery. These
are not demonstrated by this single-session fixture.

## What the application must supply

Production authentication and reviewer authorization; complete producer inputs;
atomic conditional writes and durable idempotency; receipt/grant retention; unique
operation IDs across sessions; and restart reconciliation remain application/backend
responsibilities. The examples deliberately use bounded or in-memory stand-ins.
See [developer guidance](../../../docs/architecture/multi-actor/DEVELOPER-GUIDE.md)
for the kernel, facade, operation, protocol and Studio ownership boundaries.

The [four-arm comparison](comparison/README.md) implements common outcomes with
ordinary commands, SignalTree, this coordinator and TanStack DB. All pass the
bounded common workflow. That establishes neither unique capability nor a speed
advantage for this coordinator.
