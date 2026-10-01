# Read-only runtime observation — authorized scope

The owner approved a minor kernel release and full private Studio coverage on
September 30. These are supported tooling readers, not application commands or
backend receipts. Studio remains in its private workspace.

The implementation exposes separate tree-scoped readers for transaction lifecycle,
restoration lineage, entity membership, and Link activity through the supported
`@signal-tree/kernel/internals` entry. A reader offers `snapshot()` and
`subscribe(listener)`. Its snapshot includes a sequence boundary; delivery contains
only events observed after subscription. There is no implied retrospective history.
An unavailable capability differs from an available capability with empty state.

- Transaction identity is tree + transaction ID. Snapshot lists active pending
  transactions; events distinguish opened, staged, confirmed, rolled back, and
  refusal. A refusal reports whether pending authority survives and whether
  consequences have been released. Local confirmation never claims server approval.
- Restoration entries have stable entry IDs separate from transaction IDs.
  Undo/redo/jump events name the actual affected entries, outcome, and operation ID.
  A transaction relation exists only when the restoration owner recorded it.
- Entity identity is tree + collection position + entity lifetime. Business keys
  remain string or number; literal delimiters are never reparsed. Current inventory
  and membership transitions distinguish add/remove/rekey/reorder. Diagnostic paths
  are labels, never addressing authority.
- Link identity is tree + relationship ID. Read-only snapshots expose supported
  directions and actual dirty/held/queued/in-flight/retrieval/disposed facts. A
  latest-value reconciler is not represented as a FIFO queue. No endpoint object,
  URL, raw exception, or payload history is exposed.

Readers do not install missing enhancers, retain terminal operations for history,
perform writes, settle operations, or infer external causality. Snapshot mutation
cannot affect runtime state; listener failure cannot affect application operations.
Subscribers release at tree destruction. Late asynchronous completions cannot
recreate released observation state. Unobserved trees retain no event history.

Required falsifiers before completion: attach while pending/in-flight, two trees
with identical local IDs, two collections with identical lifetime IDs, number/string
keys, refused rollback followed by retry/confirm, callback-abort refusal, reentrant
listeners, listener throws, detached snapshot mutation, repeated cleanup, diagnostics
disabled, destroy during outstanding I/O, and source/installed-package equivalence.
The same facts must survive bridge serialization and saved-session export/import;
UI coverage claims must identify older runtimes that cannot supply them.
