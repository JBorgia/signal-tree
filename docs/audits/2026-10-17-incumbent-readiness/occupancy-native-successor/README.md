# Coordinated occupancy successor — rejected

October 23, 2026. Owner-authorized bounded native capture/realization experiment.
No runtime integration. Slice1 remains valid within its accepted scope; slice2
recurrence stop remains active. Slices3–5 were not resumed. B remains closed.

## Identity and reproduction

Readiness source HEAD: `8c8968f2e1d894464216e2c8256383600ddc5a1c`.
Production remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`.
Comparator is the frozen rejected slice2 source associated with
`6bd4ee8a37ddc7ee5f84d5a983970cb8b2da8a48`, not a production baseline.
Candidate: `/private/tmp/occupancy-native-successor/candidate`.
Its final package TypeScript manifest SHA256 is
`9e4f72b0a3c83f3c60ba62ad35695c0f5ff41099060a65bf6271d8f736da5c54`.
The candidate has no Git SHA: 17 changed/new TypeScript files are archived as an
overlay against `/private/tmp/semantic-transition-slice2/candidate`.
The manifest identifies all package TypeScript, not built production artifacts.
Node24.15.0 / pnpm10.17.0; exploratory runs retain their own source provenance.

`evidence.tar.gz` contains overlay, full source manifest, first failures, reports,
review bundles and raw logs. `ARCHIVE.sha256` identifies the archive. Extract in
an empty directory. The preserved bundles run without reconstructing dependencies:

```sh
node review/capture-gap.mjs
node evidence/capture-realized-gap-baseline.cjs
node review/sparse-placement-field.mjs
node review/sparse-placement-field-before.mjs
```

Capture diagnostic catches and prints the exception; its exit status is not an
acceptance assertion. The final unchanged Nx regression is the assertion gate:

```sh
cd /private/tmp/occupancy-native-successor/candidate
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test kernel --testFile=src/enhancers/transactions/occupancy-inspection-chronology.spec.ts --skip-nx-cache
```

Final frozen run: **2 pass / 1 fail**, `evidence/final-frozen-chronology.log`.
No passing exploratory result qualifies a later source revision.

## Capture recurrence

Ordinary A@a7 and B@b8; inspection moves A to c. During one transaction:

1. B moves b→a, displacing ordinary A.
2. An independent realized/system write sets A.n123, restoring ordinary A@c.
3. The transaction writes A.n99.
4. Its c→d rekey throws `Discontinuous ordinary occupancy capture`.

The comparator constructs, inspects all contributions as current and confirms the
identical sequence. Candidate abort produces SignalTreeRollbackError retaining
the construction error in recovery.callbackError. This finding does not claim
that rollback must erase a surviving independent dependency or that recovery
refusal itself is wrong.

The selected transaction endpoint remains A absent after step1; step2 properly
does not belong to that transaction. The next own structural input starts at c.
`composeOccupancy` assumes selected own effects form a contiguous state history;
they do not. Removing the check loses the invariant; capturing the independent
binding as owned would misassign responsibility. No such repair was attempted.

This is an established internal inspection/realized-context control using native
row operations, consistent with queued-inspection-review tests. It is neither
fault injection nor a demonstrated public end-to-end Link/browser trigger.
Independent review and root both reproduced candidate and comparator results.

## Placement correction regression

Original sparse adapter control: two active transfers validate but produce
B,C,A instead of A,B,C. The public two-transfer transaction uses the full-target
path and passes; do not mislabel the private-port finding as that public failure.
A generic correction grouped revivals and active transfers into one placement
sequence. It passes its five focused native controls, including a mixed revival/
transfer, coherent callback state and subsequent adoption rollback.

Independent review then interleaved `restore A before B`, `A.n=17`, `restore B
before C`. Reordering only restoration slots changes validation chronology to
`restore B`, `A.n=17`, `restore A`, yielding structural-drift. The identical probe
with the exact pre-correction adapter and otherwise current modules succeeds with
A,B,C and A.n17. This is a differential single-module comparator, not the complete
rejected slice2 baseline. Root replay confirms both outputs.

Placement dependency order cannot discard field/lifetime execution dependencies.
The unchanged direct-port falsifier and before/after bundles are archived. No
ordinary public producer for this exact effect sequence is claimed. A possible
physical-empty inverse disposition concern remains source-only, not a proven defect.

## Preserved gains and verification limits

The experiment carries original ordinary inverses separately from physical
relocation and explicit field reversal, preserving the approved physical99 /
ordinary7 rule in tested cases. It stages bidirectional occupancy facts and
value-free inspection chronology alongside responsibility. The original vacancy
and C1–C3 controls pass in recorded component runs. Source isolation fixes remove
three stale absolute imports into the comparator.

Recorded exploratory evidence includes 16 passes/1 failure for combined capture
chronology controls; 4 original lifetime controls; point-work controls at16 and1024
entities with zero active-key traversal; and five final realization-worker controls.
These counts overlap and are not an aggregate qualification total. Final frozen
verification intentionally reruns only the decisive three-case chronology file.

First failures remain intact: field rebind lacked reversal, derived field lacked
inspection chronology, inverse orientation confused original and inverse kind,
preparation reentry lacked revision validation, multi-transfer placement failed,
and its correction displaced field chronology. The selected value-free chronology
handoff received separate independent source review. Reviews are archived verbatim.

Two new diagnostic expectations were corrected with their originals retained:
nested transact is rejected under the existing contract; cross-subject delivery
need not preserve a global order across path-queue coalescing. No original frozen
acceptance assertion was weakened. Invalid CLI/import attempts are unexecuted
checks, not runtime failures. Eleven known research-fixture type diagnostics
remain; no clean production typecheck is claimed. A completed-agent follow-up hit
a thread limit; the already-running independent reviewer completed the outstanding
capture review. No evidence was substituted for missing review.

Full suites, four-framework combined qualification, collectibility, installed
artifacts and fresh costs were not run. The central recurrence blocks them.
Existing costs, budgets and production hold remain unchanged.

## Disposition and alternatives

Reject this successor; do not lift the recurrence stop. It fails the covered
capture composition boundary after a purported shared repair, and its placement
correction introduces a separate execution-dependency regression.

A further representation would need to account for independent admission between
owned intervals, and order restoration with all dependent field operations—not
just structural slots. That is additional architectural work, not authorized
continuation of this rejected experiment. A second option is to defer structural
adoption/declared publication and retain production's conservative behavior, but
changing approved product scope requires owner authority. Weakening continuity,
claiming independent writes, or treating atomic refusal as useful success are not
acceptable substitutes.

Recommendation: retain production and the scoped slice1 result, park this
successor, and require a concrete representation addressing both boundaries before
any further native repair. No new mechanism is selected here.
