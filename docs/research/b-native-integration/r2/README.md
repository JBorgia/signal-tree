# B public lifecycle and entity slice R2

Starting checkpoint: `22ff8969dfdf46443e3d4295d8f3efa3a270b206` on
`codex/native-ownership-slice`. Original comparison baseline:
`8d220643e0d4e34cbdbc6e55e6ef692b25d5e023`. Rejected native checkpoint
`2d9ed132addd52a2ee5f3a85456be32426dd299f`, R1, A, and the model comparison
remain unchanged. The final local SHA is the commit containing this record;
`source-seal.json` identifies its tested source independently of commit metadata.

This is an internally selected integration experiment, not default activation,
API acceptance or production acceptance. Current v16 exposes `transact`,
`inspect`, `confirm`, and `rollback`. `propose`, `accept`, and `reject` were already
removed (transactions.types.ts documents the decision); no aliases were added.

## Authority and installation

An enhancer-instance WeakSet selects B before the incumbent transaction runtime
is created. Tests assert the selected authority and absence of that runtime.
Native slots, member descriptors and entity lifetimes remain current truth.
Pending location contributions retain hidden surviving values only while needed.
Scalar/member and entity indexes share one disposition coordinator; incumbent
compensation is not a second settlement engine on the selected path.

All mixed targets prepare and validate before installation. Membership, values,
ordering, responsibility indexes and owner terminality install before delivery.
The existing physical revision rejects stale preparation. Entity settlement uses
indexed lifetime targets; full ordering facts are reserved for actual ordering
operations or live ordering obligations. No performance equivalence is inferred.

Public settlement closes its outer native invalidation group before engine
terminal announcements and durable consequences. Native delivery runs outside
transaction-authoring context, allowing an observer to open a new transaction.
The public lifecycle hold releases after terminal consequences. Capture drains
before obligation-free backing is offered to the existing reclamation sink.
Native computed/effect scheduling remains framework-owned; SignalTree-owned
projections delivered to consequences must describe the installed state.

Prepared restoration claims protect pending lifetimes and placement dependencies
from unrelated history eviction. Released claims become reclamation candidates;
held retired references stay detached and never retarget replacement lifetimes.
Ordinary retirement maintenance runs after capture drain. Pending count alone
is not used to infer reclamation eligibility.

The owner-authorized v16 ordering decision is retained: prepend C completes
C,A,B before onAdd(C); callback prepend D produces D,C,A,B. Stable v15 is not
changed. Field inspection keeps field address separate from entity subject;
business keys are not inserted into address segments.

## Supported failure boundary

Preparation faults, stale-target validation and tested callback/getter failures
occur before the corresponding installation. Tests require no admitted state
without responsibility. Preparation failure during settlement retains pending
state and a useful retry. All native targets are prepared before any installs.

Successful abort rethrows the exact callback value. Failed abort throws existing
SignalTreeRollbackError with useful recovery.transaction and exact callbackError;
arbitrary callback values are never mutated. Destroyed trees offer no unusable
recovery handle. Already-terminal publication failure cannot fabricate pending
authority. Remaining publication channels and cleanup are attempted; established
terminal-cleanup error precedence is preserved. Same-terminal retry may drain
queued maintenance without repeating disposition.

This does not claim universal recovery from process OOM, termination, or arbitrary
Map/Set allocation failure after native writes. Prepared records allocate their
payloads before installation; native built-in operations are trusted within the
supported boundary. No new public fault API is introduced.

## First results retained

Raw logs and pre-fix sources are archived, including genuine failures and
incorrect test premises. Assertions were not silently reclassified.

- Public lifecycle: empty inspection during delivery, engine/public event order,
  scope creation after opened-listener destruction, history after destruction,
  opened-listener consequence deferral, leaked transaction context preventing
  observer-authored transactions, and pending records recreated after destruction.
- Entity integration: wrong collection binding; adjacent removal restoration;
  exact reorder omission; inspection address mismatch; early multi-collection
  membership delivery; throwing callbacks starving sibling publication.
- Retention and consequences: obligation-free backing accumulated; history
  eviction reclaimed a lifetime still needed by pending B; durable consequences
  read stale primed all/ids/count despite correct direct membership. Staging
  entity invalidation alone did not fix the outer group timing; terminal
  consequence delivery now follows that group.
- Test-contract mismatches: object entity fields are atomic reads; rollback
  preparation failure is wrapped with its exact cause; destroy-then-throw follows
  the established destroyed-tree error; Vue does not rerun a watchEffect for its
  own write. A separate observer and direct reads verify the surviving write.
- The immediate ordinary reclamation expectation was unsupported. Exact8d retains
  1/16 records synchronously and after microtask/timer drain. B retains them until
  capture drain, then retains zero. Original immediate assertions and diagnostic
  timing payloads remain archived; final controls require drained reclamation.

See RESULTS.md and INDEPENDENT-REVIEW.md for final verdicts and remaining limits.
The earlier primitive dynamic replacement counterexample remains an ordinary
failing baseline probe, not an expected-failure conversion.

## Limits

This slice establishes the tested public and entity paths, not complete transaction
replacement. Arbitrarily materialized new collections, Link composition and the
entire application lifecycle are not established by these tests. No package/demo
build, bundle or CPU/heap comparison was performed. Full suites were not rerun;
R1's broad results are historical and do not count as R2 coverage. No budget,
public export, v15 behavior, release or publication was accepted.
