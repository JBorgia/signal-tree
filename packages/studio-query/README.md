# @signal-tree/studio-query

Semantic session model and evidence queries for SignalTree Studio.

**Status: read-only evidence queries.** Holds the session record model
(`StudioTurn`, `StudioEffect`), evidence classifications, bounded transported-value
matching, and a small read-only session. No AI, invariants, graph rendering, or
source mapping.

Two rules the types enforce:

- **`owner` alone is not an identity.** Position ids are allocated from 1 per
  tree, so two live trees both call their first leaf `1`. Key on
  `effectKey(treeId, owner)`.
- **Effects are NET, not an attempt log.** The kernel coalesces same-location
  writes inside a transaction by design (MO-1B). An intermediate value written
  and corrected before commit is absent from this model, not withheld.

See `docs/research/studio-value-0/` for the slice plan and the gate.

## Transported value equality

Queries compare transported data structurally instead of requiring JavaScript
reference identity. The internal comparator returns `equal`, `different`, or
`unknown`; query matches require `equal`. Unsupported or budget-limited values
produce no candidate and cannot establish current observed responsibility.

The policy is deliberately deterministic:

- Primitives use SameValue (`NaN` matches itself; `-0` differs from `0`). Symbols
  and functions are unsupported. BigInts above 4,096 bits are refused.
- Plain objects compare own enumerable string data properties, ignoring property
  insertion order. Null and ordinary object prototypes represent the same data.
  Missing properties differ from properties containing `undefined`.
- Arrays additionally preserve length, holes, and enumerable extra properties.
- Dates compare timestamps, including matching invalid-date timestamps.
- Maps and Sets compare in insertion order. They do not perform unordered or
  backtracking matching; different observable iteration order means no match.
- Cycles and shared references must have the same topology in both directions.
  One shared object differs from two separately allocated equal objects.
- Accessors, symbol keys, non-enumerable custom properties, class instances,
  typed arrays, and other exotic values are unsupported. Date/Map/Set custom own
  properties are unsupported. Intrinsic methods avoid application iterators and
  coercions. No accessor is invoked, even for reference-identical objects.

Each comparison allows 4,096 charged visits, depth 64, and 1 MiB of conservative
string/key accounting. Limits bound comparison traversal, not the engine's
allocation for own-key enumeration. This operates on decoded transport data;
JavaScript provides no portable way to recognize arbitrary Proxies without
invoking their reflection traps. Exceptions are caught and refuse the match.

Equality does not establish causality, order, or a missing correlation referent.
Prior producers remain candidates only. Current observed responsibility retains
its existing observation classification; authoring-cause claims stay unknown.
The original semantic constraints are recorded in commit `030777de`.

See the [llms.txt](llms.txt) for the shared SignalTree model and observation boundaries.
