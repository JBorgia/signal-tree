# Successor validation

These are source/artifact checks for the measured changes, not a new publication
or a claim that every release gate passed. Runtime source and package bytes are
bound independently of the later documentation commits.

## Combined representation candidate 895

Runtime `895d5ae3b4de3bf9ef8c237c17d29c8ad293c807` adds exact source-run packing
and batch-local recipient snapshot sharing. The
[combined validation receipt](v16-combined-895-validation.json) binds its complete
fresh build and source suites. Kernel: 668 files, 7,283 passing tests, five existing
expected failures and 12 skips. Angular/React/Vue/Solid/reference and demo counts
are unchanged from the predecessor below; all pass. Source types and all four
built lifecycle/reentry witnesses pass.

Kernel seal: `sha256-9569f8750a59296aacd3fe7810dfffd8b5ba26eb745f38233e4caaf288a12df7`.
Five-package seal: `sha256-e16986d65eff713e7b9f6e91a7d09fcc549c3e75e2792a4d3524a1530a2d6d50`.

This first combined gate run passes 17/19: the unchanged numerical bundle gate
and five new kernel lint warnings fail. The warnings require correction; this
receipt is preserved before that correction. Strict production demo compilation
succeeds but its 821.99 kB initial output exceeds the unchanged 570 kB policy.
Its increment over the freshly measured original baseline is 6.37 kB. No size
ceiling or warning allowance was raised.

## Final combined runtime 5d04

The correction is source checkpoint `5d04ff65d2eaab1986ed1b420cbc013edc01542b`.
Five typed aliases replace the unnecessary assertions. The initial assertion-only
removal failed TypeScript and is preserved. The final correction passes source
types and 32 focused retirement/packing tests; independent review confirms the
same snapshot references and currentness checks. Only the emitted publication
`entity.js` changes; all other kernel and facade payloads match the 895 build.

The [second full combined validation](v16-combined-final-validation.json) then
reruns the five-package build, all six source test projects, demo tests, source
types, four built witnesses and all 19 affected gates on that corrected source.
All source suites pass with the counts above. Lint returns to the existing
11-warning total, zero kernel warnings and zero errors. Eighteen affected gates
pass; the numerical bundle gate remains the only failure. Strict demo compiles
with the same 821.99 kB initial total and unchanged size-policy failure.

Final kernel seal:
`sha256-a8220c572802aae475bf647e2c3c5c572477d56da90764f9defa941d5bd1f744`.
Final five-package seal:
`sha256-22d302ead9b5c676c9a32676258571918fbf4bb126c4aeee04c849c57d791faf`.

The [fresh canonical byte comparison](v16-terminal-final-budget.json) measures
45,187 / 48,948 production/development gzip bytes for entities, versus the
original 45,013 / 48,746: +174 / +202 bytes. Bare fixtures remain identical at
18,409 / 20,785 bytes. The receipt's `projection` label means the source-packing
145 intermediate in this cohort; it is not a v15 arm. No ceiling changed.

## v16 integrating predecessor a35

Runtime commit `a35ed7534996a80a77d0038ac61cb374fa5a1403` on
`codex/v16-egress-support-scan` combines lazy contributor/address indexes,
post-capture reclamation, the active-row inventory guard and weak activation-index
cleanup. Kernel seal:
`sha256-9f16e11ffe45f0db5af01b37e455146e021aec9ec485a52aeb52eaa166017f6f`.
All-five-package seal:
`sha256-53315ad83b9c69f7684291e9826df6bcc967882c75b40f8230286260944449eb`.

The [bound validation receipt](v16-final-validation.json) preserves commands,
timestamps, per-command status, source hashes and log hashes. Node 24.15.0 and
pnpm 10.17.0; canonical Nx builds, no output repair; fresh test execution.

| Check | Result |
| --- | --- |
| Five-package build | Pass |
| Kernel | 665 files, 7,252 pass; 5 existing expected failures, 12 skips |
| Angular | 306 pass, 3 skips; one file skipped |
| React / Vue / Solid / React reference | 111 / 227 / 140 / 26 pass |
| Demo Jest | 175 pass, 4 skips; 30 suites pass, one skipped |
| Source types | Pass |
| Installed built witnesses, clone/reentry, frame packet, public reentry | Pass |
| Affected gates | 18/19 pass; bundle-size gate fails |
| Strict production demo | Compiles, size policy fails: 818.62 kB initial versus 570 kB limit |

Affected gates include spec types, identity across GC, bounded and gross retired
retention, diagnostic/Link GC, forwarding GC, packed entity registration,
packed facade runtime/type identity, API/callable surface, source controls, lint
and documentation checks. Demo Jest disables only Watchman through a preserved
external configuration; it does not alter repository tests.

A fresh unchanged baseline demo is 815.62 kB under the same strict 570 kB limit.
The integrated increment is approximately 3.00 kB; the full 248.62 kB excess is
not attributed to this study. The [canonical package comparison](v16-final-budget.json) measures entities at
45,152 production / 48,910 development gzip bytes, versus the baseline
45,013 / 48,746: +139 / +164 bytes. Bare fixtures remain byte-identical at
18,409 / 20,785 bytes, and ordinary fixtures exclude the optional reclamation
scheduler. The package gate remains over its pre-existing v16 ceilings.
The receipt's `projection` arm label identifies the preserved pre-weak-index v16
intermediate, not the v15 projection optimization. Size failures remain failures, separately from the decision to
retain correctness and measured CPU improvements. No budget file was changed.

## v15 maintained runtime

Runtime commit `0d2b9619206ab9e7a7af998944e744f6d2b6e492` on
`codex/v15-retirement-reclamation` adds the ordered-subject projection cache and
ports reclamation/inventory/activation cleanup while preserving v15 settlement.
The [complete validation receipt](v15-final-validation.json) binds source, packages,
commands, logs and final controls. Full kernel: 435 files, 7,861 pass, 7 existing
expected failures, 13 skips, one todo.
Angular: 214 pass, 3 skips. Source types, the unchanged spec-type ratchet
(222 existing errors across 36 files), fresh build and strict demo pass.
Seven of eight selected gates pass; bundle-size policy is the numerical failure.

The [canonical fixture byte receipt](v15-final-budget.json) measures entities at
25,333 production / 28,273 development gzip bytes against unchanged ceilings
25,292.8 / 28,160: 40.2 / 113 bytes over. Relative to released v15.4.8, the total
increment is 111 / 126 bytes. The latest weak-index cleanup adds 19 / 17 bytes.
Bare fixtures remain byte-identical at 11,011 / 13,159 bytes, and the optional
reclamation scheduler contributes zero bytes to these ordinary fixtures.

These small increments buy a measured collection projection improvement and
correct bounded lifetime cleanup. Their cost is accepted for this candidate
under the owner's cost-versus-feasibility direction; the numerical gate is not
renamed green and no new version is selected.

## Review boundaries

Independent representation reviews inspect exact support/address semantics and
execute differential Map controls. Reclamation review checks capture ordering,
pending/history ownership, ordinary-state retirement and v15 compatibility.
The [weak-index review](weak-index-independent-review.json) checks actual
post-commit lifetime absence, including pre-install failure, value-only retirement
and late reads. That review does not claim fresh framework/heap executions; the
full final validation and final installed-artifact cohorts supply those checks.

Earlier candidate failures and package seals stay separate. A passing predecessor
is never substituted for a changed successor. Finite GC cohorts and sampled
objects do not prove universal leak freedom or minimum possible guarantee cost.

## Settled-build comparison and study tooling

The final rerun passes 578 comparative children and the original complete-cohort
analyzers. The separately reviewed matched-pair analyzers require the exact
packet plan and successful original analyzer receipt. A deliberately different
valid packet is rejected. The private-variant wrapper preserves the original
analyzer apart from the two recorded substitutions; its original self-tests,
42-child checks and eight containment controls pass. The initial wrapper's
premature output creation is preserved and corrected before final use.

The [study-tool receipt](study-tool-validation.json) records all 21 new JavaScript
tools passing syntax and focused zero-warning ESLint;
source controls pass. The README API check first stopped because this study
checkout had no restored build outputs, then passes after the canonical Nx build
restores its five cached package outputs. An initially mistyped documentation
command is preserved; the actual registered documentation-link checker passes.
These are study-tool/document checks, not a new runtime qualification pass.
The final v15 and v16 source/demo validation above remains bound to its own fresh
builds and artifacts. No production source changed during the comparison rerun.

A post-measurement `let` to `const` lint correction affects only two array bindings
in the coordination harness. Their mutations and runtime behavior are unchanged;
the exact measured harness bytes and correction receipt are preserved separately.
The final comparison protocol's two-source private-packet clarification likewise
preserves its exact earlier text. No historical source hash or result was edited.
