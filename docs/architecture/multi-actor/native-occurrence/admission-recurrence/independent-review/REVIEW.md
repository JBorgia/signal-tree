# Independent covered-inverse recurrence review

**Candidate remains failed: 3 failed / 1 passed.** Independently replayed the unchanged native-admission-handoff.spec.ts through Nx on Node24.15.0/pnpm10.17.0, NX_DAEMON=false NX_ISOLATE_PLUGINS=false, --skip-nx-cache. Raw replay.log preserves failures. Equal/netzero reach q rollback then retain rejected-q destination; inverse restores7 with rejected-r destination instead of q. The foreign-window control passes. Earlier assertions passing are not green test cases or integration acceptance.

Verified frozen evidence, all2923 candidate source files and the predecessor's2921 files. Independently reran the existing trace-copy, preserving trace-replay.log. Its only source difference is the archived logging-only native-field-selection.ts patch. The trace records an endpoint bound to inverse11->7 at toRollbackEffect and zero endpoint reads from tree-realization-adapter. verification.json records these checks. No runtime repair or source edit was made.

## Concrete route

1. transactions.ts:3823 only tries preparePointRealization when compensated frontiers exist or the effect list mixes scalar/entity effects. The single entity-field case uses realizationPort.applyAtomically.
2. tree-realization-adapter.ts:939 planHeterogeneousFrame requires structural work; :1583 planScalarFrame excludes subjectFieldSegments. This case therefore enters perEffect at :582 and applyEffect at :618.
3. applyEffect:1795 installs ordinary realized write context, resolves the leaf and calls target.set(effect.after) at :1831. It does not read or forward fieldEndpoints(effect). The leaf delegates to updateOne/commitExistingSubjectValue, whose publication consequently has no restoredFields selection and falls back to a requirement derived from rollback context.
4. The adjacent absent-field branch (:1801–1819) replaces the row after removing the property; it also omits the endpoint. The writable-entity-node fallback at :1835 has the same transport omission. These are existing neighboring producers, not an invented new route.

The observed trace plus dispatch conditions support this loss point. They do not prove that supplying the missing endpoint will by itself qualify every inverse, structural or normalization path.

## Bounded next mechanism

Transport the already-selected inverse endpoint through the existing per-effect realization dispatch to the same native source publication admission consumed by the point paths. Keep the current planner choice, ordinary inverse payload, settlement rules and callback order. The existing synchronous write-context/private metadata facilities provide a transport seam; no public setter signature or global endpoint lookup is needed.

The handoff must identify the source/subject/lifetime and exact field/presence domain with the originating inverse invocation. Capture/claim it for that setter before callback reentry; a broad ambient flag keyed only by value or business key is insufficient. Preserve it into the prepared edit's restoredFields, selecting the endpoint atomically with its actual ordinary payload. For absent-field row replacement, bind only the authorized absent field and retain unrelated sibling selection; do not certify the complete replacement row from one field endpoint. Clear request ownership on throw/return. Keep missing evidence missing and retain existing validation/refusal behavior. This is transport of existing selected authority, not new authorship or a new policy.

Do not reroute every effect through the point planner merely to obtain coverage; its different preparation/installation behavior is not qualified by these tests.

## Separate composition defect confirmed by source

transactions.ts:2007 uses oldEndpoints?.before ?? newEndpoints.before, so an endpoint-free earlier effect borrows the later baseline despite retaining the earlier raw before. If newEndpoints is absent, the conditional skips binding entirely and leaves an obsolete earlier after pair attached to a changed raw after. Both violate the accepted paired-endpoint model. The special absent-member baseline replacement remains legitimate only when native composition actually selects that incoming baseline.

Carry earliest-before/latest-after evidence with the native composition decision. When an endpoint is unavailable, represent missing evidence explicitly or clear the composite pair; never fill the missing side from an unrelated step. No runtime counterexample for this composition branch was executed here; this finding is direct source inspection and distinct from the replayed inverse failures.

Next bounded gate is the unchanged four-test handoff suite plus exact per-effect absence and callback-reentry transport controls, and the already-approved missing-endpoint composition falsifiers. No new architecture, persistent root, global index or widened public contract is required. Candidate acceptance remains withheld.
