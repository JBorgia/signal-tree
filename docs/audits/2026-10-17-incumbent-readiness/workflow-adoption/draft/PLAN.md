# Preregistered bounded review-before-save adoption test

Baseline: unchanged kernel source at worktree HEAD 676ecb7955c6a0af6898bb17225d68060692fc95.
One neutral/headless Ticket editor service; no framework or browser claim, runtime
change, release acceptance, performance measurement, or automatic merge API.
Prior comparison: /private/tmp/link-product-comparison/{PLAN.md,README.md,examples.ts}.

## Domain policy fixed before implementation/execution
Ticket has id, title, assignee, status. Editable fields are title and assignee;
status is an independently writable live field. Draft is a deep copy outside the
live tree. Opening captures base. Per-field three-way comparison: a changed draft
field conflicts iff live differs from base AND live differs from draft. Unchanged
draft fields always preserve current live. Equal concurrent edits do not conflict.
Conflict resolution is explicit per field: choose draft or live, rebase that field
to current live, then review again. No collection/rekey/order/general merge claim.
Review is immutable application output. Any live or draft change since review
invalidates acceptance, including disjoint changes; user must review again.
Acceptance installs the reviewed complete Ticket in one actual kernel transaction
and confirms it, then ordinary actual Link synchronizes to a controlled endpoint.
It is local acceptance, not durable remote acknowledgement. Reject discards only
unaccepted draft work. Async suggestions require matching session AND draft edit
revision; a stale completion cannot alter a new session or a later user edit.
Destroy invalidates callbacks, discards draft and review, disposes Link and destroys
the tree. Already delivered/in-flight endpoint work cannot be recalled.

## Expected assertions
1. Draft title/assignee edits remain isolated; simultaneous live status change
   synchronizes via Link while draft remains open. Accept after review preserves
   status and emits exactly one coherent complete Ticket (no partial field pair).
2. Concurrent live title change overlapping draft title produces an explicit
   conflict, blocks acceptance, and emits only the independently accepted live edit.
   User choosing draft then reviewing/accepting publishes that chosen value.
3. Choosing live resolves overlap without overwriting live. Reject produces no
   draft publication. Later live edits continue ordinary synchronization.
4. Live change after review invalidates accept; fresh review preserves that change.
5. Deferred completion after reject/new session, after newer draft edit, and after
   destruction returns stale without publication. Fresh completion changes only draft.
6. Destroy is idempotent and further user mutation is rejected; endpoint counts
   remain fixed after stale work completes. This is observed lifecycle, not heap proof.
7. Equal concurrent title edits do not conflict. An unmodified draft title preserves
   a later live title. Returned draft/review copies cannot mutate service authority.

Strict TypeScript check of application and actual imported kernel graph, esbuild
execution, and per-input SHA256 receipts. Preserve first failures/logs and source
snapshot before correction. Report simple physical code counts with generating
command, not runtime cost. Passing assertions qualifies this sample policy only;
product acceptance and adoption choice remain owner decisions.
