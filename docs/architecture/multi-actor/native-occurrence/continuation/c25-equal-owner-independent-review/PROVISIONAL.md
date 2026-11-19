# C25 provisional independent mechanism review

Not a freeze acceptance. No candidate edits or executions. Captured selected source hashes in SOURCE.json; this is a mutable-source observation, not a full candidate identity. Read EXPECTATIONS.md and the bounded-representation premise, then checked current source, C24 delta, and author raw selected-first / selected-owned-only / current-input-first results.

## Scoped selection

private.ts:161–168 separates replace intent without branch/entity consumption from derived/current-input work. Exact endpoint retention preserves the full selected requirement identity; it does not filter owners or convert old destination evidence into newly consumed input. Derived/branch/entity routes still combine admitted evidence. This is a principled scope for the literal counterexample, not evidence that all equal operations are no-write. It also applies to dependent/unknown declaration modes: “independently supplied” here describes the input route, not a check for declaration.kind===independent. Invocation validation must still govern those modes.

The owner-bearing guard is semantically significant. The first broader exact-retention attempt failed the existing unowned net-zero useful-progress case (selected-first:23 pass/1 fail). The narrower condition has author evidence24/24, preserving that case. No tests were changed by this review. An unowned selected endpoint must still be eligible for authorized fresh evidence; retaining every selected predecessor would violate that obligation. Conversely, owner!==undefined is not a proof of currently pending ownership; see the terminal-marker qualification below.

## Invocation readiness and retirement

private.ts:370 stores activation as a transient invocation on the prepared Unit. completeScalar:424 subscribes only when that requirement is not ready. ready:283 refuses reduction while invocation remains unfinished, then releases its subscription before proof reduction. dispose releases pending invocation subscriptions and resolves pending units. lifecycle.onNativeRequirementReady:128–143 removes listeners before invoking the wake callback; callbacks queue work rather than perform synchronous endpoint delivery. Releasing twice is harmless in that implementation.

This supplies a barrier for nonmatching recipients, whose lifecycle operation frames are matching-channel-only. It is materially stronger than relying on op.frames. It does not itself prove failed-horizon semantics for every literal exact-retention path: readiness means validation has closed, not that validation succeeded. The finalized proof used by matching/nonmatching recipients, and surviving old work versus newly admitted work, remain distinct obligations.

The new current-input fixture preserves actual q into a later updater; author current-input-first reports31/31 across four selected files. Its late-child tests author x7 outside a transaction, however: that endpoint has no numeric owner, so the nested equal call does NOT exercise the new owner-bearing exact-retention branch. They are useful unchanged-admission controls, not sufficient qualification of that branch's nonmatching validation. Require the preregistered owner-bearing retaining call inside an open horizon, including failure/closure and useful settlement, before closing that obligation. No leak is demonstrated by this coverage gap.

Transient release paths look coherent by inspection. Total retention is not established: occurrence requirements, operation dependencies, receipts/noop fallbacks, saved views and effect-pair roots must be checked after closed invocations. The source still forms recipient authored composites even when nativeValues is exact. Only bounded instrumentation can establish whether those become unreachable or collapse. Do not substitute weak-map reasoning or24 passing semantic cases for that check.

## Terminal p marker versus surviving q

transactions.ts:2875 retains before whenever an unchanged endpoint has owner!==undefined. private.ts:164 uses the same marker for exact literal selection. Neither tests p.outcome; confirmation does not clear this numeric endpoint field in the inspected paths. Thus this is selected historical provenance, not a predicate named or proven “actual pending owner.”

The rival with inherited actual q does NOT by itself establish erroneous retention. Approved CURRENT-SPEC.md:42 forbids erasing native destination/input/validation obligations. p.confirm settles p, not q. A NEW updater consuming the retained value must see surviving q; current-input-first explicitly tests that distinction. The existing inherited-q Main cases confirm p then q but do not issue another equal literal between those confirmations. Their green result therefore does not adjudicate that extra admission event.

Exact EQUAL-WHOLE-AUTHORITY.md at continuation root says the approved case is evidence “held only by a possible dependency on an unrelated pending transaction”; it permits explicitly supplied UNOWNED fields to refresh while preserving “actual pending destination ownership.” It does not say all historically transaction-authored endpoints remain owned forever, nor authorize erasing actual inherited q just because p is terminal.

Classification: terminal marker alone is insufficient authority for a permanent owner guard. With surviving actual q, retaining q is consistent with the obligation rule and no counterexample is established. A distinct p-confirmed endpoint carrying only unrelated possible W is the relevant unowned-freshness rival, conditional on demonstrating that exact reachable provenance and current selection. An exact public sequence should distinguish actual q I/V from possible-only q W, retain useful value/rollback/no-notification/settlement assertions, and verify current ownership before assigning an oracle. Do not repair this by simply dropping all proof on p.confirm, nor infer q is actual solely because it is pending.

## Provisional disposition

The literal-versus-consumption distinction is principled. No blanket acceptance of the owner-marker condition or total retention follows. Terminal selection authority, exact-branch nonmatching validation, and all-root bounded retention remain explicit qualification points. No new policy, source modification, broad run, or final acceptance is requested. Final review must compare freeze hashes and discriminate these boundaries with preserved evidence; existing first failures remain authoritative observations.
