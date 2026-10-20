# Independent premise and developer-experience review

Evidence read: immediate-independence report at `2b1e80e8`, contributor contracts,
and current scoped independent-review protocol. Specification-only assessment;
no executable result or production implementation is claimed here.

## Established premise

The report observes identical responsibility receipts for independent `y(7)` and
`y(x())` while x's owner remains pending. It states: “It receives no list of
consumed source revisions or their owners, and no evidence excluding a dependency.”
The current mechanism cannot distinguish the pair. Responsibility revisions solve
stale tickets; they do not provide this missing information.

## Tracked execution scope

A supported read interception boundary can produce different evidence for literal
write versus direct SignalTree read during a synchronous scope. This is a useful
possible capability, not proof of automatic independence for arbitrary callbacks.
An empty observed read set proves only that no intercepted reads occurred.

Necessary rules before selecting any API:

- Scope input and invocation dependencies must be explicit. A callback invoked by
  speculative x can depend on x even if it writes a literal. An ordinary user
  event may be a trusted independent origin only under a stated supported rule.
- A value retained before entry cannot be classified by payload equality or by the
  absence of in-scope reads. Unknown captured inputs stay held unless provenance is
  supplied or independence is explicitly asserted under application responsibility.
- Native computed caches can yield speculative data without a fresh kernel read.
  Scope tracking must either import dependency evidence from a supported realization,
  require a transparent supported accessor, or classify this input unknown. It must
  not force native computed evaluation/timing merely to collect a read set.
- Writes receive the dependencies consumed before that write, plus inherited input
  and trigger facts; tracking everything read by callback completion may safely
  over-approximate but would need a rule preventing publication before completion.
- Reentrant callbacks require separate frames inheriting causality, not reset-to-clean
  scopes. Nested scopes cannot remove outer evidence. Throws unwind tracking state;
  a partially installed write still needs a valid immutable ticket.
- Asynchronous resumption does not inherit a JavaScript stack scope implicitly.
  The bounded synchronous contract must stop there; retained provenance or explicit
  declaration is needed for a later operation, otherwise conservative hold.
- Cross-tree and cross-runtime inputs must be distinguished. Instrumented sources
  can carry qualified source/revision identities; absent instrumentation is unknown,
  never an empty dependency set.

Developer burden: one apparent callback wrapper is insufficient if applications
must also account for closures, native caches and invocation provenance. Any example
claiming low ceremony must show these facts rather than hide them in a trusted scope
constructor. Pure scalar code may be straightforward; reactive framework effects and
application helpers are materially harder.

## Explicit publication ownership

An explicit declaration can distinguish the pair: literal write is asserted
independent, copy is declared dependent on the relevant revision/owner. This is
application-supplied information, not automatic verification. Missing declaration
must preserve the safe default. An independent assertion cannot erase a dependency
actually observed by the runtime; contradictory evidence must produce an explicit
failure/hold before unsafe publication, not best-effort override.

The declaration needs to identify publication eligibility separately from transaction
settlement ownership. Saying a callback belongs to a transaction must not silently
promise its ordinary writes will roll back with that transaction. Every operation
needs an immutable evidence snapshot qualified by source identity, not mutable
transaction lists or current pending counts. Multiple dependencies combine; confirming
one does not authorize publication while another is pending. Unknown evidence does
not vanish merely because a known dependency settles.

Developer burden: declarations at real command/input boundaries may be clear, but
per-field declarations are tedious and easily incomplete. Reusable helpers can lower
ceremony only if their inputs and trigger semantics are explicit. Cross-domain groups
alone provide no safety proof. Incorrect independence assertions are application bugs
and must be plainly described as capable of publishing speculation.

## Surviving writes and terminal outcomes

The approved case is a *new ordinary write after rejection* using a retained value.
It authors surviving application truth. Neither option may silently retroactively
label it owned by the rejected transaction solely due to the value's history.
Conversely the approval does not make an already-held dependent revision publishable
on rejection, and does not erase other still-pending dependencies. A new write revision
must be distinguished from terminal outcomes for older revisions. Retained metadata
must not resurrect rejected eligibility later.

## Review conclusion (before draft specification)

Neither alternative presently proves useful automatic independence with zero input
assumptions. Tracked scopes can prove observed dependency and conditionally prove
independence inside a truthful, complete input/trigger boundary. Explicit declarations
can supply missing information with explicit application responsibility. Neither is
selected, accepted, or implemented by this assessment. The production hold remains
required. A future specification must make the prior-read case as concrete as the
literal/direct-read pair, rather than solve the pair by assuming all closures clean.

## Draft review: /private/tmp/link-scope-comparison/SPEC.md

No blocking issue found for the stated specification-comparison scope. The draft
makes conditional independence explicit and does not advertise a plain wrapper as
proof of closure completeness. It distinguishes publication evidence from rollback
membership, includes trigger/native-cache/foreign-domain uncertainty, and retains
existing notification and delivery requirements. The owner decision asks about
accepting application responsibility rather than disguising a public-contract change
as an implementation detail.

Whole-invocation dependency union with deferred eligibility is conservative and
truthful: later reads can hold an earlier independent write. This is an express
precision limitation, not an observed runtime result. An eventual implementation
would need to freeze that complete evidence before any publication, including writes
created by nested observer delivery. The draft does not claim this has been done.

The rejection section correctly separates approved new surviving writes from older
held evidence and declines to invent a permanent veto. An eventual mechanism still
needs a concrete lifecycle rule for a held receipt whose possible owner rejects;
this comparison must not be mistaken for qualification of that unresolved mechanism.
It is appropriate not to silently select that rule here.

Nonblocking clarification: distinguish a user callback throw after successful read
capture from incomplete/failed evidence capture. A throw must unwind the scope but
need not itself imply that every installed write lacks usable evidence forever.
The draft's existing unknown/held fallback is conservative; an implementation should
not turn the fallback into an unreviewed permanent hold or new rollback promise.

No new empirical performance, developer usability, framework, lifecycle or retention
claims are substantiated by this review. The comparison's burden estimates are
correctly labeled estimates. Production hold remains intact; no API selected.
