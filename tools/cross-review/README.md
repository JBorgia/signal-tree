# Historical derivation review harness

`review.mjs` and the parent `tools/cross-review.mjs` wrapper preserve the old
v15 derivation experiment. They are not the current review procedure. Use
[the scoped review protocol](../../.github/skills/adversarial-confirmation/references/protocol.md)
and [code review guidance](../../docs/review-contract.md) for current work.

The old harness loads the architecture ledger, uses a fixed model default and
assumes derivation-row contracts. Its contract rejects legacy continuity as
premise; that is inappropriate for stable-line compatibility maintenance.

Do not invoke it as a routine gate. Even `--dry-run` can execute supplied specs
and write local packet files; it only prevents transmission. Other modes use an
external model service. This consolidation did not run those modes, update the
transport, or certify compatibility with current hosts/models. Historical
reproduction needs an explicit task, inspected packet and authorized transport.

The harness and original contract are retained in place for reproducibility;
current release workflows and package scripts do not invoke them.
