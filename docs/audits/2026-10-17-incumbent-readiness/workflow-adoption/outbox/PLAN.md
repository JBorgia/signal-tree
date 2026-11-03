# Preregistered bounded adoption probe

Source 676ecb7955c6a0af6898bb17225d68060692fc95; no production modifications.
Use actual kernel index and versioned /internals lifecycle reader through aliases.
Read prior product comparison and review: explicit labels are app assertions;
command transport is not automatic Link convergence. No API selection.

Before implementation expect:
1. Shipment assignment and dispatch approval owners hold a captured dispatch
command; unrelated audit command progresses; one confirmation is insufficient.
2. Reject either pending owner cancels unsent command; explicit replacement marks
old unsent intent superseded; deferred enqueue with rejected owner cancels.
3. A failed endpoint attempt is retained as uncertain and requires explicit retry;
concurrent drains share one worker and cannot duplicate one attempt.
4. Teardown abandons queued entries and marks active request uncertain; a later
ack cannot erase its recorded uncertainty. Cannot recall a request already sent.
5. Lifecycle observation reconciles thrown terminal settlement; refusal remains
pending. No optimistic local state flip based only on method return/throw.
6. Deliberately omitted contributor leaks speculative input: negative control
must exhibit this limitation, not count as provenance safety.

App owns frozen command payloads, explicit owner arrays, IDs, entry status,
retry authorization, supersession and teardown. Public PendingTransaction has no
status/ID query. Versioned tooling reader offers snapshot pending IDs and events;
map one synchronously opened transaction per begin, reject nested/reentrant
creation as unsupported. Snapshot alone does not distinguish confirm/reject.
Observe before opening; retain terminal facts for queued owners. Unexpected
missing pending without terminal evidence remains unknown/held.

Strict TS with no explicit any. Separate application.ts from test.ts. Esbuild
runner records actual source hashes, input identity, results. Preserve first
run logs/failure before repair. Headless in-memory endpoint only; no durability,
crash recovery, exactly-once, browser/four-framework qualification, benchmark,
or production replacement claim. Applied-then-ack-failure remains uncertain.
