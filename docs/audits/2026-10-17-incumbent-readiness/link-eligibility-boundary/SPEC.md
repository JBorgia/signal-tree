# Eligibility investigation: prewritten discriminators

Baseline 7c511c2b59e803b065b2a674e0f7b0a897f85145. Production hold and reviewed
experimental delivery algorithm unchanged. No public API or configuration additions.

Question: distinguish a finite unresolved set of possible transaction dependencies
from unavailable evidence about which inputs an ordinary write consumed. Confirmation
resolves a known possible owner, not arbitrary missing provenance. A forgotten owner
must not be relabelled as absence of dependency.

Minimal actual-kernel traces, same scalar endpoints, direct vs synchronous reactive
copy, no invented input boundary:

1. One pending p, direct y=7; p confirms. Inspect y revision, authority and endpoint.
2. Same with synchronous observer copying x7 into y. p confirms. Compare receipts.
3. p and q pending; y copied from q; confirm p only: no publish. Then confirm q:
   compare current gate and experimental unknown gate.
4. Copy q, confirm p, reject q: preserve current surviving y and endpoint sequence;
   empty pending set alone must not be counted as proof of independent value.
5. Pending p then ordinary independent overwrite vs captured speculative overwrite:
   identical authored location/value does not establish identical dependencies.
6. Capture x7 from p, reject p, then write y from captured local synchronously;
   compare literal7 with identical observed metadata/no pending scopes. No timers,
   promises or asynchronous inference are needed for this boundary.
7. Later authoritative Link replacement remains the positive control which supplies
   explicit evidence rather than guessing that an ordinary overwrite is clean.

Record direct source availability: creation/open before writes, write notification,
terminal outcome removal, settle listeners and capture drain. Failed settlement is
not a terminal outcome. Do not change production transaction responsibility.

Expected outcomes: all actually known dependencies confirmed and no other possible
input dependency is a valid eligibility proof. Current private boolean `clean=false`
has no owner/outcome transition, so cannot implement that proof. Merely observing
zero current scopes is weaker. Reject must not turn a surviving speculative copy
into clean work. Direct independent progress while other owners remain open remains
required but cannot be claimed from disjoint target location.

One bounded evidence-resolution model may demonstrate finite owner-set resolution
using the already reviewed immutable engine and delivery seam. Label supplied facts
as model assumptions, not runtime-inferred dependencies. If kernel traces cannot
supply a sufficient fact without excluding supported local captures, preserve the
paired counterexample and present the precise boundary instead of adding inference.

Tree destruction is a separate source/contract investigation: queued, started,
completion and settled waiters, contrasted with explicit connection disposal. No
lifecycle repair in this eligibility experiment.
