# Independent review and verified disposition

Reviewers received raw probes, exact-baseline overlay sources and manifests.
Runtime/architecture document edits remained centralized. Earlier review claims
were checked against source or replay, not accepted as authority.

- **C1/C2/P1**: publication_contract reviewed independent endpoint normalization,
  owner coverage under reentry, cleanup and named work accounting. No reproduced
  blocker in those changes; normalization failure was a distinct proposed fault
  boundary, subsequently reproduced and qualified in normalization-review.txt.
- **R3**: existing singleton placement can be preserved, but this duplicate route
  is excluded from the final lanes after existing structural planning sufficed.
- **R4**: publication_regression verified realized metadata is applied only to
  notification entries; taps retain authored ambient context. Callback/ABA/throw
  controls pass; this is not a blanket realized wrapper around callbacks.
- **R5/R7**: framework_boundary inspected prepare/install/publication and clock
  checks. publication_regression found the baseline-green ordinary array defect;
  R7 reuses baseline shape classification. Whole-row/field inspection keys and
  seven supported shape controls pass. Class prototype loss also occurs on
  baseline and is not repaired or relabeled.
- **R8**: publication_regression checked the scalar-only no-turn pruning against
  baseline's different entity-footprint behavior. Twelve cases match baseline
  exactly. No entity claim is removed merely because its value returns to its
  starting point. See no-turn-review.txt.
- **R6**: publication_contract initially questioned structural commit/publication
  separation, then corrected that interpretation: location grouping defers actual
  native delivery. Four structural replays of the original publisher fault pass.
  A further omitted-member replay DOES fail through the existing sequential
  fallback. Root reran CPR9 failure and CPR10 correction unchanged at closure.
- **CPR10 cost**: publication_contract verified the unrelated optional-member +
  one-row comparison and both inventory-processing call sites. Exact state,
  successful settlement, authority retirement and retry are checked outside
  measurement. Baseline zero inventory versus two N-sized candidate inventories
  is a valid granularity blocker. It is not a timing/allocation figure or proof
  of two uncached structural-list traversals. Root reran both, obtaining expected
  exits 0 and 1 with stable inputs.

Disposition: no reviewed runtime integration is accepted. Preserve CPR9's
controlled settlement counterexample and CPR10's ordinary-input work regression.
A shared prepared member/scalar/row composition boundary is the bounded next
option; further special route guards are not established as a solution. This
record does not conclude atomic responsibility capture is impossible.
