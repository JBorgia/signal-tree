# Independent adoption-contract review plan

Source checkout: `/Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree`, HEAD `676ecb7955c6a0af6898bb17225d68060692fc95`. At inspection, AGENTS.md and docs/performance/measurement-contract.md already dirty. Read-only source review; this note is separate research evidence.

## Frozen/current premises (verbatim at source HEAD)

- `docs/architecture/signaltree-15-product-decisions.md`: “Tree-scoped; unresolved scopes hold that tree's durable consequences; foreign-tree scopes never interfere.”
- `packages/kernel/README.md`: “`link()` expresses a live relationship between state locations while preserving the kernel's authority and causal-turn semantics.”
- `packages/kernel/README.md`: “Applications own storage formats, migrations, fetching, cancellation, retries, validation, and form control behavior.”
- `RELEASE-CURRENT.md`: “B's replacement track is closed at `17e1a76f` and is not a repair queue.”
- `RELEASE-CURRENT.md`: “Owner authorized comparison, not replacement or API selection.”

These define the incumbent/control and authority, not a prohibition on evaluating alternatives. The new authorized question is whether two application-shaped workflows expose enough actual behavior and developer responsibility to inform a later scope decision. Feasibility does not grant that decision.

## Draft workflow checks

1. Actual isolated review state is distinct from live truth; populated assertions demonstrate no speculative publication and useful concurrent ordinary Link progress.
2. Concurrent overlap is surfaced by an explicit conflict policy; test both acceptance and rejection, preserving unrelated edits. Inspect conflict detection for base/current/proposed comparisons, stale acceptance, and dirty-field handling.
3. Successful acceptance publishes a coherent accepted object and ordinary Link continues after settlement. Rejection does not publish review state. Acceptance failure must not be labelled accepted.
4. Ordinary counterexamples: non-overlap live edit, same-field conflict, external write between conflict detection and installation, obsolete async review completion, multiple reviews/repeated accept, and destroy while review work exists. Unexercised cases remain limits, not invented passing behavior.
5. Count and explain duplicated application state, change tracking, conflict resolutions, async generation/lifetime guards, publication authority and cleanup ownership. Avoid LOC as total ergonomics score.

## Outbox workflow checks

1. Entries declare all needed pending owners; independent entries make useful progress while actual kernel handle remains pending. Settlement state must follow actual handle success/refusal rather than optimistic wrapper flags.
2. Confirmation admits coherent payloads; rejection cancels dependent queued entries and retries before invocation. Failed delivery visibly persists until explicit retry, with useful retry success.
3. Ordinary counterexamples: two contributors/one confirmation, rollback refusal, concurrent drain, in-flight supersession/cancel, enqueue after settlement, failed earlier entry versus later independent entry, destroy during an awaited send, late completion/retry/enqueue after destroy.
4. Disposal policy must state what local work is abandoned and whether dispatched remote work can still complete. No persistence, cross-restart recovery, exactly-once or remote rollback inference from an in-memory harness.
5. Inventory per-command state, owner declaration, enqueue/supersession/retry/cleanup obligations, failure reporting, payload copying, and accidental omission of ownership. Deliberate negative controls should assert actual leaked payloads.

## Evidence and interpretation

Read complete fixture implementations and manifests, raw run outputs and substantive assertions. Check source/artifact identity and any preserved initial failures. Distinguish executed tests, inspected code, design inference and unknowns. Seek a concrete falsifier instead of adding broad requirements to force a decision. Narrow scenarios need not solve every counterexample but reports must preserve the limits.

Prior product-comparison evidence supplies bounded samples, not full production qualification. Its prior limitations (wrapper authority, concurrent drains, retry ordering, acknowledgement ambiguity, concurrent draft merge) deserve inspection in the larger workflows. Neither automatic provenance nor equivalent-capability runtime costs are measured here. Safe hold, closed B and existing supported-progress blocker stay intact unless separately authorized by the owner.
