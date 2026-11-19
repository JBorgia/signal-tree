# C28 bounded current-obligation authority

Owner approved current-obligation no-write semantics in the November 2 continuation:

> May v16 treat obsolete, already-confirmed input/validation history as irrelevant
> when deciding whether a new equal-value declaration is no-write, provided current
> ownership, publication obligations and validation are unchanged? In the reproduced
> pair, this would make both fresh declarations no-write; the earlier receipt would
> represent the eventual send. Fresh dependency validation, pending/rejected
> evidence, earlier snapshots and terminal receipts must remain intact.

Answer: **Approve current-obligation no-write semantics (recommended).**

This approves a bounded implementation and qualification, not activation, release,
new public API or increased budgets. C27 and its original public A/B observations
remain preserved. The new A/B expectations must be separate approved counterparts,
not edits hiding the original result.

## Scope and invariants

- Apply the approved relevance rule prospectively at a new real admission.
- Validate freshly supplied authentic confirmed handles and nested inputs normally.
  Input captured pending does not become obsolete history merely because it
  confirms during the current operation.
- Preserve destination ownership, pending/rejected/abandoned responsibilities,
  unknown or unavailable evidence, retirement obligations and inverse selection.
- Preserve previously issued evidence and terminal receipts. Cleanup must not
  invent authorship, notify equal values, invoke callbacks or send duplicate work.
- Preserve meaningful equal-value evidence refresh when current publication
  obligations actually change. Value equality alone does not establish no-write.
- Establish current-view, cached-snapshot and occurrence-accounting handoffs
  explicitly. No silent snapshot identity/API change is authorized.

Independent review and focused falsifiers precede broader qualification. A source
certificate bound is not a proof of bounded all-root retention or heap collectibility.
Retained production, B closure and existing release gates remain unchanged.
