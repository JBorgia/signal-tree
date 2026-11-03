# Owner-approved conditional publication direction

After comparison `4a678e916f8a964916ebe4d33a8cb78697a72e35`, the owner selected:

> Allow conditional progress through explicit complete ownership declarations;
> application owns hidden-input omissions (recommended if retaining same-tree live
> proposals).

The question explicitly excluded API or implementation approval. This is the governing
responsibility direction for the next specification, not production activation.

[Contract draft](SPEC.md) defines complete operation declarations, immutable
per-revision evidence, retained inputs, contradictions, reentry and future lifecycle
checks. Publication ownership is distinct from transaction compensation ownership.
Undeclared writes retain conservative behavior; falsely omitting hidden contributors
is an application error and may leak speculation. Observed contradictions cannot be
ignored. No tracked-scope wrapper or value comparison supplies completeness.

The reviewed scope comparison is preserved [unchanged](../link-scope-comparison/README.md).
Its previously pending direction choice is now answered. The detailed API, outcome
fallback and implementation qualification are not complete.

| Item | Status |
| --- | --- |
| Application responsibility for complete declarations | Owner approved |
| Useful conditional immediate progress | Required; no implementation yet |
| Export names, token access and operation syntax | Unselected |
| Older dependent receipt after rejection | Compatibility-preserving fallback proposed; exact rule open |
| Existing conservative automatic behavior | Unchanged |
| Independent review | See REVIEW.md; specification review, not runtime qualification |

The rejection boundary matters because existing ordinary tree-held consequences can
run after either confirmation or rejection when the tree settles. A declaration must
not silently convert ordinary surviving state into a cancellable command. The draft
marks the fallback transition OPEN rather than asserting a completed lifecycle model.

No public API, runtime/type change, new experiment, benchmark, budget adjustment or
B work. Independent review and documentation validation accompany this record.
