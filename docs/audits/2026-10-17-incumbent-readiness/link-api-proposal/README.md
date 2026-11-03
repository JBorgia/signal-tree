# Link-local API proposal for owner review

[Concrete alternatives and recommended proposal](PROPOSAL.md),
[independent review](REVIEW.md), [review dispositions/type validation](VALIDATION.md).
Base6ceca15d. No public API selected or implemented.

Recommend connection.declare(responsibility, synchronousWrites), initially for scalar
connections. Responsibility is independent, dependent with authentic existing owner
references, or unknown. The result is a narrow per-operation receipt with read() for
validation/eligibility/conservative-fallback status, not a transport acknowledgment.
A proposed SignalTreePublicationError distinguishes declaration failures from rollback.

Compared with explicit snapshot publication and connection-owned setters, this keeps
existing facade writes and transaction capture ownership intact. Multiple connections
require explicit nested coverage, not a connection-wide trust flag. Known obligations
and unknown outer context cannot be erased by an inner independent declaration.

Independent review found two proposal gaps: missing validating state for nested
receipts, and validation-object getters/iterators executing before the horizon. Both
are corrected; disposal remains per connection. Type examples pass after preserving
an initial unexported recovery-type import failure. These are signatures and examples,
not runtime or four-framework verification.

[Archive](evidence.tar.gz) and [checksum](SHA256SUMS) preserve type sketches, examples,
compiler logs and reviews. Extract to a fresh directory; the archived validation
uses pinned Node24.15.0 and the recorded worktree TypeScript installation:

```sh
node /Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree/node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target es2022 --module esnext --moduleResolution bundler examples.ts
```

Owner API approval is required before the native experiment. First integration scope
is scalar declarations combined with existing delivery, ABA, reentry and disposal
controls, plus authentic recovery-owner and multi-connection tests. Entity ordering
and restoration follow before broader acceptance. Hidden-input omission remains a
prominent misuse demonstration, excluded from safety-pass counts. Production hold,
budgets and B closure remain unchanged.
