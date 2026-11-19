# Deferred point pre-admission correction

New successor based solely on `/private/tmp/st-packet-admission-refusal-successor/candidate`. No prior candidate/root edits. The independent report and exact failure log are archived under first-failures/. No public API, accepted-shape, point-budget, certificate or map-reuse change.

## Runtime correction

One method in `internals/entity-publication.ts`: within deferred `preparePoint`, complete `this.admission.prepare(packet)` before looking up/creating/enrolling the point group. Append the admitted packet afterward. The nondeferred route continues through ordinary prepare. This moves the existing complete admission operation; it adds neither a special-case frozen-shell guard nor cleanup logic for particular exceptions.

A caught rejected first fragment therefore cannot create an empty group or completion entry. A caught rejected later fragment leaves previously accepted group contents intact. Admitted fragments still use the same group/install/completion mechanism and exact edit identities. No broader poisoned-scope policy is introduced.

## Execution

- Exact independent three-case fixture copied byte-for-byte: all three pass. Original caught-first-fragment red remains archived.
- Two added useful-work controls pass: a refused-only scope never invokes source.prepare; a subsequent separate scope installs useful evidence and completes once. A refusal between two accepted fragments preserves both exact edits, their values7/11, and shared once-only installation/completion.
- Targeted total **5/5 pass**, targeted.log.
- Full selected total **72 pass / 11 fail**, focused-first.log. The same11 predecessor reds remain: the explicit partially frozen private precedence refusal, seven older private-mutation expectation/diagnostic differences, three inherited structural-sequence failures. All inherited tests are unchanged; no green reclassification.
- Original uninstrumented point workload: **15,800**, equal at2k/20k rows, unchanged<2,000 fails (point.log).
- Strict source types and existing spec-type ratchet pass; no baseline change (source-types.log, spec-types.log).

Pinned Node24.15.0/pnpm10.17.0/Vitest4.1.9. No fresh allocation/heap/CPU qualification, public packaging or combined integration claim. This successor awaits independent review. Earlier retirement review is separate at `/private/tmp/st-fixed-window-retirement-independent`; its runtime is not imported here.

## Identity

SOURCE-SHA256.json and FREEZE.json identify this candidate. runtime.patch is relative to the frozen refusal predecessor. VERIFICATION.json checks predecessor sources/frozen artifacts, unchanged inherited tests, and the exact copied independent fixture. COMMANDS.md reproduces the runs. No author source from either independent review was edited.
