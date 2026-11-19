# Native admission experiment — frozen on covered inverse failure

Candidate: /private/tmp/st-native-admission-successor/candidate
Preserved predecessor: /private/tmp/st-native-reviewed-successor/candidate
No patches applied to predecessor. No public activation, persistent root or global responsibility index.

## Runtime work actually implemented

Native source publication now accepts a responsibility-preparation callback. The experimental native participant prepares proposed field facts, invokes native admission with before/proposed/selected endpoints before preparing recipient facts, and installs responsibility records with source publication. Native-absent fallback still runs responsibility preparation. Each source-owned ordinary field slot carries its actual value/presence, requirement and native-admitted owner marker. The owner marker comes from the transaction planner's admitted effect, not proof-role inference. Same-tree equal writes retain an existing native-owned endpoint; foreign possible-window writes without native ownership can use an independent declaration.

Actual field effects carry private symbol-paired endpoints through effect clones and scalar composition, including net-zero selection of the first endpoint. The native plain-member baseline replacement branch is recognized when composing endpoint metadata, but plain-member endpoint production and paired image normalization are NOT implemented/qualified. toCausalEffect and toRollbackEffect preserve/swap field endpoints. Two existing point/heterogeneous realization edit builders carry inverse endpoint selection into source point publication. That is incomplete: the ordinary per-effect fallback was missed.

This is experimental source, not accepted implementation. Structural endpoint normalization, complete row absence certification, member-image paired normalization, lifecycle retention qualification, all realization routes, source-demand capture and staged rendering remain incomplete. Do not infer any of these from the approved model or source/spec type passes. The current composition fallback when an earlier effect lacks endpoint metadata also requires correction to preserve missing evidence; no claim of model equivalence.

## Preregistered native correctness gate

native-admission-handoff.spec.ts was added before runtime edits. It asserts q remains destination after same-tree independent equal updateOne; r rejection restores q's destination; r11->r7 normalization retains q; final q rejection restores baseline without rejected destination; and independent equal updateOne releases a foreign possible window.

Before runtime: 1pass/3fail (first-falsifiers.log).
After runtime: 1pass/3fail (first-runtime.log).
After fixture-only typing correction: same1pass/3fail (final-runtime.log).

This is NOT observational acceptance. Assertions remain unchanged. New progress is limited to stages reached before failure:
- Equal updateOne now retains q destination and emits nothing before q rejection. Final q rollback restores value0 but proof still names rejectedq, failing the baseline-selection assertion.
- r11->r7 then rejectr retains q selection and value7. Final q rollback has the same proof failure.
- r11 then rejectr restores value7, but proof still names rejectedr. The q-restoration assertion fails.
- Foreign possible-window equal independence control passes before and after.

Source `tsc --noEmit -p tsconfig.typecheck-all.json`: pass (source-types-first.log).
Spec `node tools/check-spec-types.mjs`: initial2 new fixture callback errors (returning push's number, spec-types.log), corrected to explicit void-bodied callbacks; final gate pass (spec-types-final.log). Initial fixture preserved first-fixture.spec.ts. No public type weakening, assertion changes or runtime patch after the covered failure.

Commands use Node24.15.0, pnpm10.17.0. Nx command from candidate: NX_DAEMON=false NX_ISOLATE_PLUGINS=false corepack pnpm nx test kernel --skip-nx-cache native-admission-handoff.spec.ts.

## Concrete missing route

Separate trace-copy differs from frozen candidate only in native-field-selection.ts diagnostic logging. trace.log reproduces the same1pass/3fail. It records exact endpoint presence/value through native preparation, enqueue composition, toCausalEffect and toRollbackEffect, including inverse11->7. No endpoint reads occur in the wired point adapter paths.

Source route:
- transactions.ts applyRollbackCompensation applyAtomically only tries preparePointRealization for compensated frontiers or mixed scalar/entity effects. A single entity-field inverse uses realizationPort.applyAtomically.
- tree-realization-adapter.ts planHeterogeneousFrame rejects a no-structural-effect list; planScalarFrame rejects subjectFieldSegments. applyAtomically therefore selects perEffect.
- applyEffect resolves the entity leaf and calls target.set(effect.after) at1820–1835. It sets realized write context but does not carry the inverse endpoint certificate. Source publication consequently synthesizes a requirement from rollback context instead of using q's selected endpoint.

This is a covered recurrence in the attempted inverse handoff, not a new policy or an unsupported oracle. Candidate frozen immediately; no repair to that route made. Read-only tracing localized the omission. The same shared producer endpoint must reach this existing ordinary per-effect realization path; routing everything through an unqualified alternative planner is not established by this experiment.

## Scope of freeze / review handoff

Main can independently review source.patch, runtime.patch, correctness fixture, first failures and trace. No broader gate or demand/render implementation followed this covered failure. No projectionCounts zero literals were used as retention evidence; no work/retention claim is made. Further changes require respecting the recorded recurrence boundary, not treating the three failures as passed stages or changing the assertions.
