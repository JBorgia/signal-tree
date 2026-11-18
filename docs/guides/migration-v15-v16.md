# Migrating from v15 to v16

v16 retains the `@signal-tree/*` package scope and the kernel plus Angular,
React, Vue and Solid facades. Use one framework facade for application state.
Evaluate **16.0.0-rc.1** explicitly, for example
`npm install @signal-tree/angular@16.0.0-rc.1`. The `rc` channel is separate
from stable v15 on `latest`; an unversioned install does not select this guide’s
v16 APIs. Consult [the release controller](../../RELEASE-CURRENT.md) for exact
qualification and publication receipts. This prerelease is not stable v16.

Start with [one owned workflow](adoption-v16.md). The executable
[route-review story](../../apps/demo/src/app/pages/independent-publication/independent-publication.component.ts)
shows what the additional contract looks like to a user: ordinary external work
survives review, a real refused rollback stays pending, and newer overlapping work
is settled before retrying the older rejection. Its endpoint is deliberately in
memory; keep backend authority and durable reconciliation in the application.

Preserve the existing feature's business tests before adding the stronger
behavior. Passing those tests after a method rename does not by itself verify
new pending/publication/recovery requirements. There is no measured migration-time
promise and no qualified mixed-major runtime bridge. Independent versions must
not exchange live trees, entity or pending handles, enhancers or Link sources.

## Rename the transaction entry point

Change `tree.transaction(callback)` to `tree.transact(callback)` wherever the
transactions enhancer supplies the method. No alias ships. Transaction handles
continue to expose `confirm()` and `rollback()`; `inspect()` reports whether the
turn's contributions remain current or have been superseded. Inspection is a
review observation, not backend approval or an atomic authorization check.

Do not rename application-level transaction objects or backend transactions.
The library migration concerns the SignalTree method. The one-time naming
exception is recorded in the [support policy](../support-policy.md).

## Check open string-indexed state

Arbitrary child access through `Record<string, V>` is now `unknown`; it cannot
promise a handle for every possible key. Read the whole ordinary value when that
is what the application needs, and declare genuinely known children in the state
type. Avoid casts that recreate the old universal-handle assumption.

Named children, closed objects and whole-value write types remain supported.
The [open-Record guide](open-record-typing-v16.md) has checked examples and the
precise scope, including readonly and hybrid records. This is a typing migration;
it does not add dynamic mounting or a new lookup API.

## Update custom native adapters

The shipped framework facades implement the current-reader requirement. If you
maintain a custom native factory, supply `createCurrentReadonlyCell(readCurrent)`
according to the adapter SDK. Retained native readers must observe current values
and errors on direct reads, including during nested writes, while preserving
their native carrier identity. A missing capability rejects factory creation.
An ordinary cached computed cell is not a substitute for this contract.

Use the installed adapter declarations and current-reader conformance tests for
your factory; do not copy framework-specific scheduling into kernel ownership.
Applications using the shipped facades do not implement this SDK method.

As in v15.4.8 and later, entity field factories run when the field is first
acquired. A whole-row
handle still exposes its original field keys and descriptors, but acquiring that
row no longer constructs every field carrier. Custom adapters must initialize
from current values at field acquisition and must not depend on eager factory
side effects. Repeated acquisition returns the same carrier for that handle.

## Review recovery and publication behavior

Keep explicit ownership of pending handles. A refused rollback can leave pending
authority available for recovery; inspect the returned/thrown recovery information
and settle deliberately. Observer delivery failure and transaction settlement are
separate outcomes. Do not infer remote durability from local Link completion.

Conditional Link declarations describe contributing pending owners, declared
independence, or unknown completeness. They do not infer hidden application inputs,
transfer write ownership, authenticate actors, or authorize a server operation.
A retained row or field belongs to its entity lifetime; reacquire a handle for a
replacement entity rather than assuming a reused key retargets an old handle.

The read-only tooling readers observe existing capabilities and confer no write
or settlement authority. Confirmed-history opt-in already ships in v15.3 and later;
v15.4.4 applications do not need to migrate it again merely because of v16.

Compile the application against the selected candidate's installed packages,
exercise rollback/refusal and late-Link flows, and destroy component, route and
session-owned trees at teardown. A package version string alone is not evidence
of publication or application validation.
