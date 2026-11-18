# Adopt one v16 workflow

This guide targets **16.0.0-rc.0**, an evaluation prerelease on npm’s `rc`
channel. Stable v15 remains `latest`; v16 is not yet a stable release. Install
the exact version for the application’s framework, for example:

```bash
npm install @signal-tree/angular@16.0.0-rc.0
```

Use the matching React, Vue or Solid facade for those frameworks; use the kernel
directly only for intentionally neutral code. Read the installed manifest and
types before generating code. Stable v15 uses `transaction()`; this line uses
`transact()`. The [release controller](../../RELEASE-CURRENT.md) records exact
qualification and publication receipts; a source version string alone proves
neither.

## Begin with the user's experience

Choose one feature that needs overlapping edits and explicit review. A useful
example is a dispatcher who receives a shipment update while an agent proposes
a route. The user needs to see what is still proposed, what has changed since,
what can proceed independently and what to do after rejection is refused.

The [working review story](../../apps/demo/src/app/pages/independent-publication/independent-publication.component.ts)
is available at `/independent-publication` in the demo. Its
[component checks](../../apps/demo/src/app/pages/independent-publication/independent-publication.component.spec.ts)
and [browser workflow](../../scripts/playwright/v16-candidate-workflow.spec.ts)
exercise real runtime behavior, including:

1. Propose west from north and inspect the current contribution.
2. Receive a separate server shipment update and publish a genuinely independent
   literal note while route review remains pending.
3. Open a newer east proposal; the earlier route contribution is superseded.
4. Try rejecting the older proposal. A real rollback refusal retains both handles
   and keeps route publication withheld.
5. Reject the newer proposal first, then retry the older rejection. The shipment
   and note survive. A separate confirmation check proves endpoint delivery.

After confirming west, use the explicit local reset before repeating the scenario.
An unchanged west write is blocked so it cannot masquerade as an overlapping
contribution. Reset is unavailable while either proposal remains pending.

The endpoint in this demo is in memory. This is not a server acknowledgment,
durability proof or an actual AI-model evaluation.

## Use the smallest useful setup

An Angular feature can start with a plain tree, native leaf writes and explicit
teardown. Entity collections, transactions, restoration and diagnostics are
selected capabilities; do not enable them for an imagined future requirement.

```typescript
import { asReadonly, signalTree } from '@signal-tree/angular';

export function createEditor() {
  const tree = signalTree({ note: '', selectedId: null as number | null });
  return {
    state: asReadonly(tree).$,
    writeNote: (note: string) => tree.$.note.set(note),
    destroy: () => tree.destroy(),
  };
}
```

The owning component or session calls `destroy()` when it closes. Separate
editors can own separate trees. Do not export a process-global mutable editor
when its lifetime belongs to one route, request or user session. Keep the scope
of its operations and its tree aligned; a root service must not accidentally
capture the first editor's state.

## Add review deliberately

Use `transactions()` when the feature needs pending local work. Keep its handle
until confirm or successful rollback. `inspect()` is a current contribution
snapshot, not a reactive signal, authorization check or snapshot of old values.
Display it beside current application reads and resample after relevant actions.

A `SignalTreeRollbackError` can leave the transaction pending. Retain the handle,
explain the unresolved state and offer the application-specific recovery path.
The story's newest-first recovery works for its demonstrated overlapping route
proposals; it is not a universal recovery recipe for every error.

When a Link declaration claims independence, establish that no pending-owner
inputs contributed, including saved values or caches. Declare every contributing
owner for dependent work; use unknown completeness when it is unknown. Hiding a
read outside the callback does not make the output independent.

The shipped native facades keep retained SignalTree readers current on direct
reads, including during nested writes. Application-created computed values still
follow their framework’s scheduling; do not promise that every computed consumer
refreshes synchronously. Verify both current state and the UI’s actual timing.

## Keep responsibilities explicit

The runtime coordinates owned in-memory state. The application owns fetching,
cache policy, request supersession, presentation and lifetime. The backend owns
authentication, authorization and durable effect handling. A review screen must
distinguish local confirmation, endpoint delivery and backend acceptance.

When combining a client query library with an editor, define the read model and
draft ownership separately. Do not make two stores competing authorities for the
same live record. Such integrations need their own tests and cost measurement;
this guide does not establish TanStack or mixed-v15/v16 interoperability.

## Validate the feature, then measure it

Keep the feature's business tests when migrating from v15. Add meaningful checks
for the v16 guarantees it uses: overlap and refusal, independent publication,
external updates during review, replacement lifetimes, late readers, navigation
and teardown. Test error presentation as well as runtime state. Run
`pnpm nx test demo --runInBand --no-watchman --testPathPatterns=independent-publication.component.spec.ts --passWithNoTests=false`
in this repository for the focused review example.

Measure complete application cold start, first use, sustained interaction and
retained/pending memory on representative data and supported devices. A lazy route
defers its code until use; it does not erase that code or the runtime's active
cost. AI-generated implementations should pass the same behavioral checks and
human review as handwritten ones. Adoption ease and user comprehension require
their own evaluation.
