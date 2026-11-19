# Independent C6 composition review

Bounded acceptance of the exact C6 composition. No composition blocker found. This is not full integration, R3, current-read, retention, or point-work acceptance.

## Identity and independent reconstruction

C6 manifest SHA-256: `925bd916560115e5fffd9c761e2eeca6a170f43dab0c8214aa5c7177315b69b4` (2994 files). FROM-C5.patch: `e299f8b10e219089f6b72a4ce27cd7fcb934161f26386e02a17e289d76bcc475`.

Independently hashed every manifested file of common C0, C5, shared-construction successor, and C6; zero mismatches. Recomputed the three-way selection from those manifests, without relying on COMPOSITION.json's decisions: 19 cumulative shared changes, no overlapping changed files, zero expected/actual differences. All 23 C5 changes from C0 remain byte-identical. Independently applied FROM-C5.patch to copies of its C5 inputs: exit 0, all 19 outputs exactly match C6. Evidence: verify.py, VERIFICATION.json, patch-reconstruction/, patch-apply.log, PATCH-AND-GATES.json alongside this report.

The preserved initial assembly actually names dynamic-member-enrollment as its base. That base would exclude already-present enrollment changes from the incoming delta. The final assembly uses common C0 and includes experimental-publication/private.ts, intrinsic-mutation.ts, materialize-markers.ts, member-membership.ts, native-occurrence.ts, and signal-tree.ts byte-for-byte from the shared successor. The initial failure is preserved, not used as evidence for final C6.

## Interface interpretation

Read the cumulative runtime patch and affected interfaces. Both ordinary additions and keyed construction carry PreparedMemberConstruction through installPreparedMember; cancellation remains per allocation. Prepared descendant registration is staged until source installation and activation remains in membership completion. The C5 scalar-runtime delta records counters at actual equality/write/revision operations; it does not alter the detached revision test used by the added constructors. The C5 lifecycle delta adds exact owner-transition observers for entity retirement; the incoming membership code still uses existing native requirement/revision admission. Entity packet, source retirement, placement, and ordinary-row code remain the C5 versions. No merge substituted one of those producers or silently imported singleton reuse.

Existing C6 tests exercise inspection-created members, foreign pending owners, failed preparation/retry, disposal, same-key reentry, descendant writes during completion, and keyed rollback/cancellation alongside the C5 packet/accounting and retirement controls. I found no additional composition-specific gap that justified inventing a new oracle or repeating these suites. No new runtime test was run in this review; patch reconstruction and source hashing were independently executed.

## Existing executed evidence, not an independent replay

Read raw logs, command records, results, and before/after source manifests. All seven gate runs start from the exact frozen C6 manifest and report unchanged sources afterward:

- Kernel construction: 433 pass, 16 files.
- Angular construction: 28 pass, 5 files.
- Packet/accounting: 138 pass, 1 skipped, 9 files.
- Retirement/enrollment: 61 pass, 5 files.
- Exact recipient-cause classification: 6 pass, 1 file.
- Source types and spec-types: exit 0; spec ratchet not changed.

Total recorded test passes: 666, plus one skipped. The initially unmatched recipient-domain filter is not counted as coverage; the later exact recipient-cause run supplies that evidence. Archived-document tsconfig warnings in graph initialization did not prevent test execution. These are author-run results whose source attribution was independently checked, not independently rerun totals.

## Boundaries retained

C6/REVIEW.md is the shared-construction component review; its component hash is not the C6 hash. This report supplies the separate composition qualification. Its cached-parent completion observation remains unresolved, not waived by resource cleanup or aggregate pass counts. R3 must still address membership/joint-phase ordering and bind actual live scalar sources after detached attachment. Nothing here imports or accepts R3. The unchanged point ceiling remains red; neither this composition nor the available counter evidence authorizes changing it.

# C7a diagnostic-output follow-up

Quick source/identity review accepted. Manifest `d911ae7768e8e1a43eceb99ef5277988a6ff9e59c910337bb1e6b79db4d1b71d`, all 2996 manifested files independently match. C7a differs from C7 only in singleton-row-allocation.spec.ts; relative C6 it contains only the already reviewed singleton runtime expression and two singleton specs. See C7a-VERIFICATION.json.

The only C7-to-C7a edit reads ST_SINGLETON_ALLOCATION_OUTPUT and conditionally appends the JSON diagnostic. It does not skip a test, population, measured 200 updates, constructor calibration, the 200 updated-row assertions, untouched sentinel, nonzero measurement assertions, restoration of global Map, or tree teardown. No semantic gate is weakened. An explicitly configured invalid output path still fails; an absent output path no longer causes a fixture-only failure. No runtime change accompanies this hygiene edit.

Raw C7a logs show 104 pass/15 files without the required output argument; the explicit-output measurement run has 5 overlapping passes, not 109 unique tests. Original point control still fails at 15400 versus less than 2000. The original unset-environment C7 failures remain archived. I did not duplicate the 104-test run. The allocation assertions are calibration/useful-work checks, not a newly invented allocation ceiling; matched baseline/successor measurement and its earlier limitations remain the basis of the allocation-reduction claim.
