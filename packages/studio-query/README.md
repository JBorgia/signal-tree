# @signal-tree/studio-query

Semantic session model and evidence queries for SignalTree Studio.

**Status: S1 scaffold.** Holds the session record model (`StudioTurn`,
`StudioEffect`) and a small read-only session. No AI, invariants, comparison,
graphs or source mapping — those belong to later slices.

Two rules the types enforce:

- **`owner` alone is not an identity.** Position ids are allocated from 1 per
  tree, so two live trees both call their first leaf `1`. Key on
  `effectKey(treeId, owner)`.
- **Effects are NET, not an attempt log.** The kernel coalesces same-location
  writes inside a transaction by design (MO-1B). An intermediate value written
  and corrected before commit is absent from this model, not withheld.

See `docs/research/studio-value-0/` for the slice plan and the gate.
