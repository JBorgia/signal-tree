# Post-review freeze

Runtime remains byte-identical to 001-roles.patch and 009-final-runtime.patch.
Base and source hashes are in 006-source-identity.json. No commits by worker.

- 007-validation-window-corrected.log: 1/1 passes. Root changed only the invalid
  nested-transaction fixture. Original 005 and its failure remain preserved;
  root's 005-FIXTURE-DISPOSITION.md explains the correction.
- Independent reviewer reproduced two confirmed-input false contradictions on
  candidate and predecessor. Source explanation: lifecycle.ts73 promotes retained
  source owners into I;93 requires every I/V identity in the declaration regardless
  of confirmed outcome. prepareRevision has the same outcome-insensitive required
  lower bound. Retained history thereby continues to restrict a new declaration
  after the source transaction confirms. Root owns recurrence disposition; no fix.
- 008-spec-types.log: exit1, exactly two TS2339 diagnostics in reviewer's new
  publication-confirmed-input-independent.spec.ts lines13/14. The experimental
  `.declare` method needs the same local cast used by prior fixtures. No other
  spec ratchet regression reported. Reviewer and root notified; not edited here.

No entity work, instrumentation, broad qualification or performance execution.
