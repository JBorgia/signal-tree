# End-to-end adoption evidence — October 19, 2026

Research source `676ecb7955c6a0af6898bb17225d68060692fc95`; runtime remains
`87f6831fa60cafe87508f0ace84b7638698ca3b0`. No package changes, new API, automatic
tracking implementation, budget adjustment, release freeze or B work occurred.

## Outcome

Two headless application-shaped workflows execute successfully through actual
SignalTree source, with useful controlled endpoint output. Workers, root and an
independent reviewer ran both final scenarios; root also reran strict noEmit
TypeScript checks. This is adoption feasibility evidence, not a browser app,
installed-package or four-framework qualification, remote protocol or production
replacement acceptance.

- **Ticket review-before-save:** eight assertion groups, thirteen complete Ticket
  deliveries. Draft edits stay isolated while accepted live changes synchronize.
  Disjoint edits are preserved; overlapping edits require explicit draft/live
  choice and fresh review. Stale review, including live A→B→A, cannot be accepted.
  Rejection creates no draft payload; subsequent live edits still synchronize.
  Session/edit guards suppress stale suggestions and teardown prevents new work.
- **Shipment command workflow:** eight asserted groups, including preserved old-code
  failure and intentional omitted-owner leak witnesses—not eight positive safety
  qualifications. Pending truck/dock owners hold dispatch; an independent audit
  progresses; joint confirmation releases a complete command; rejection cancels
  unsent commands. Concurrent drains share a worker. Failure retains explicit retry
  responsibility; destroy distinguishes queued abandonment from in-flight uncertainty.
  Lost acknowledgement plus retry intentionally applies a command twice.

The review workflow uses ordinary kernel/Link imports. The command workflow also
uses **existing versioned `/internals` tooling** for exact transaction identity and
lifecycle events. It is not yet an ordinary facade-only outbox recipe. Applications
must supply every contributor; no automatic effect scope or provenance is inferred.

## Developer burden measured on these exact samples

Counts include declarations/comments and are format-dependent. Application files
are separate from assertions, endpoint scaffolding, bundling and compiler config.
They do not measure effort, runtime overhead, usability or relative complexity.

| Burden | Ticket review | Command service |
| --- | --- | --- |
| Application nonblank / physical lines | 112 / 115 (`draft/editor.ts`) | 97 / 100 (`outbox/application.ts`) |
| Assertion/scenario nonblank lines | 116 | 143 |
| Additional retained state | Base and draft, reviewed snapshot/conflicts, session/edit/live revisions, closed flag | Owner-ID/handle map, entry IDs/payloads/contributors/status/attempt/error, worker, open/closed guard, lifecycle subscription |
| Explicit declarations | Editable fields and fixed scalar merge policy | Complete owner list and unique ID for every command; dependency labels are application assertions |
| Conflict/acceptance code | Per-field three-way comparison; draft/live choices; review freshness; accept/reject | Confirm/reject authority reconciliation; unsent supersession; manual uncertain retry |
| Cleanup | Clear draft/review, invalidate continuations, dispose Link, destroy tree | Stop lifecycle subscription, destroy tree; abandon queued work, retain in-flight uncertainty and inspection records |
| Accidental-publication opportunities | Copy draft through live write entry point; add writer without revision discipline | Omit contributor, mutate trusted bookkeeping, bypass registered transaction creation, retry ambiguously applied command |

`draft/counts.json` and `outbox/burden.json` provide exact source hashes. Counts are
reproducible with `sum(bool(line.strip()) for line in path.read_text().splitlines())`.
Root checked the draft's 90 and outbox's 101 bundled input hashes and the executed
bundle hashes against disk. Complete manifests preserve sources and outputs.

## First findings and corrections retained

1. **Draft review freshness:** initial source compared values, so live ABA could
   evade the preregistered any-change rule. Source inspection found the gap before
   an ABA run. Final service adds live revision and unchanged expected stale-review
   controls. Initial passing source/results are preserved, not claimed to cover ABA.
2. **Outbox identity:** counting opened lifecycle events could throw after obtaining
   the real outer handle when a lifecycle observer opened another transaction.
   A preserved counterexample executes the old implementation and demonstrates lost
   access to that outer pending authority. Final service captures its own callback
   ID through exported tooling; corrected control retains and settles both handles.
3. **Error-fixture premises:** initial tests expected contained leaf-observer and
   asynchronous Link endpoint errors to throw from settlement. Source review confirms
   containment; original failed assertions/logs remain. Corrected controls assert
   actual containment. A separate private test-only consequence injection verifies
   a genuinely thrown terminal confirmation and authoritative lifecycle reconciliation.
   It is a controlled fault boundary, not an ordinary endpoint failure.
4. **Fixture-only type narrowing:** an empty-array assertion narrowed a trace to
   never[]; the equivalent length-zero assertion avoids that compiler artifact.
   First compiler output is retained. No runtime/public typing change was made.

## Limits that matter to adoption

Draft policy covers one fixed scalar Ticket and one accepted local collaborator,
not remote CAS, arbitrary entity merges, multiple editors or confirmation-error
recovery. Every live writer must maintain its revision discipline. Local acceptance
is not remote acknowledgement. Async guards suppress stale completion but do not
cancel remote computation or establish heap reclamation. Consumers do not all
preview drafts through existing live references: that visibility difference is
intentional, not a failed implementation of live proposals.

The outbox is process-local. It has no persistent atomic commit/enqueue, crash
recovery, receiver deduplication or exactly-once guarantee. Slow/hung endpoint work
can hold later entries behind its serialized worker. Terminal entry records retain
owner handles; destruction does not demonstrate collectibility or a bounded
long-running retention policy. Mutable bookkeeping is trusted. Automatic-abort
recovery handles are not adopted by the wrapper, and raw transactions bypass its
owner registration. These unresolved boundaries prevent treating it as a qualified
general application library or stable public outbox facility.

Both tests are meaningful end-to-end service scenarios: actions → application
policy → real kernel → controlled endpoint. No browser rendering, four-framework
native behavior, real backend or equivalent-capability CPU/heap/bundle ranking was
performed. Existing full suites were not rerun because production source did not
change. The two entity-budget failures remain separate blockers; prior budget
approval is not extended.

## Owner scope decision — October 19

Evidence supports using isolated review for the tested review-before-save workflow.
The command workflow is feasible with explicit responsibility, but its tooling,
recovery and retention limitations remain experimental. Neither automatically
satisfies the prior promise of independent progress among live same-tree proposals.

Recommendation presented to the owner: automatic Link may retain conservative hold,
with independent progress specified through explicitly documented workflows;
isolated review is the supported application pattern candidate, while outbox remains
experimental until separately qualified. This is a proposed **scope change**, not
an implementation finding or authorization already granted. It does not select a
new API, remove existing live proposals, approve budgets or establish release readiness.
The owner subsequently selected **“Keep automatic independent progress required.”**
The proposed relaxation is declined; the existing blocker remains open. The owner
authorized a bounded comparison of automatic dependency-aware publication, the same
mechanism with explicit missing ownership, and manual publication on selected Link
connections. This is not a promise to infer arbitrary asynchronous causality and
not permission for a public API implementation before reviewed specification. The
archived original report predates this decision; it remains historical evidence.

## Evidence and replay

[Independent review](REVIEW.md) and [review premise checklist](REVIEW-PLAN.md) separate
source inspection, actual replays and interpretation. Detailed worker accounts:
[draft](draft/RESULT.md), [outbox](outbox/RESULT.md). Source application files and tests
are adjacent to those accounts. Archives retain exact first/final sources, logs,
compiler configs, compiled bundles and SHA receipts; each archive has a manifest.
Root rerun logs and common preregistered acceptance criteria are in verification.tar.xz.

Use Node24.15.0 and repository dependencies pinned to pnpm10.17.0. The preserved
worker reports give exact executed commands. Runners/configs retain original absolute
paths under /private/tmp and the reviewed worktree: extract archives into a disposable
replay directory and explicitly adapt those paths if not using the original locations.
Changing source baseline is a new evidence identity. No push, merge or publication.
