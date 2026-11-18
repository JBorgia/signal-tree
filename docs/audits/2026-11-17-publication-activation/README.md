# Legacy cleanup and publication activation investigation

Owner instruction: clean up legacy source in both lines, audit v15's scope, and
investigate per-tree v16 publication activation while preserving all guarantees
and measuring the complete mechanism. This investigation does not authorize a
weaker default or deletion of supported v15 APIs.

Baselines:

- v15 `fc279c279b3f1a9d6a9ac17330f5dcf9d0ccdba4` (runtime `4d1142d6166b2d5b2874715e38097665545864dc`).
- v16 `aed4775434b843294310c227e27dc6134f027fb7` (runtime `7ab6cbcc70bf5abe9c5070e38a51bd0229ed1830`).
- Prior completed study `53b36fc6b42cc9f5435d33223f20a4927ece3272`.

Work is isolated on `codex/v15-legacy-boundary-cleanup`,
`codex/v16-publication-activation` and `codex/publication-activation-study`.
Fresh baseline kernel builds bind 109 v15 and 144 v16 payloads to unchanged
source inputs. They are prototype comparison artifacts, not a new release seal.

## Scope decisions

The applicable contributor contract at both baselines states:

> `@signal-tree/kernel` owns behavior SignalTree requires regardless of
> framework: state and identity, EntityMap, causal turns, links, restoration,
> and owner invalidation semantics.

> Only kernel, angular, react, vue and solid belong in this public release
> workspace.

The contract explicitly keeps public observation interfaces. Optional activation,
semantic ownership, exported API and package placement are different questions.

Independent premise and interpretation inspection found:

- v15 kernel production imports contain no framework dependency. Framework
  lifecycle, forms bridging and native realizations stay in their facades.
- Bare-tree dependency traversal reaches enhancer ordering, not transaction,
  restoration or DevTools implementations. These supported optional features
  implement kernel semantics; no further public removal was established.
- Link takes application endpoints, not a built-in HTTP client or storage policy.
  Its construction-time interception is required for held setters used after
  later attachment (`link-bare-contract.spec.ts`).
- Confirmed-turn and lifecycle observations project existing owner facts; they
  are not a Studio recorder, session store or query engine.
- Old audit and v15 serialization implementations are unreachable through the
  public exports. Their mixed tests still cover useful surviving behavior.
  Cleanup must preserve marker/walker/type/SSR/rollback/Link/retention coverage.
- Disconnected diagnostic/provenance/greenfield experiments are validation
  material, not shipped capabilities. Their filenames alone justify no deletion.
- Always-created capture/listener containers are allocation leads, not proof of
  a material cost or a reason to add configuration. The already tested fractional
  `history.retain` behavior remains unchanged; it is a separate policy question.

## Publication candidate and competing explanations

Module inclusion currently installs entity and scalar native factories. Zero
recipients, no local transactions, and no current subscriber do not imply absence
of publication obligations. Foreign owners, supplied snapshots and late readers
are concrete counterexamples (`integrated-late-history.spec.ts`,
`publication-native-provenance.spec.ts`, `fixed-window-independent.spec.ts`).

The prototype keeps collection interception and identity from construction. It
represents only an unobserved, positive, neutral prefix implicitly in kernel-owned
current state. Captures, recipients, removals, divergent/inspection writes,
restoration selection, declarations and owner/input-sensitive mutations activate
the full participant. Activated sources remain active. A private current-state
seed is valid only while this invariant excludes negative or divergent history.

Preparation rechecks eligibility at finalization. A preparer may open a foreign
owner; promotion must use already evaluated operands, preserve the separate
delete/write/add phases and never replay a user updater or introduce a new
rejection merely because the owner window changed. Neutral authored facts retain
their historical-window distinction from virgin initial requirements.

This first mechanism targets collection sources inside trees. Ordinary scalar
publication retains its established implementation; ordinary-state and many-tree
measurements must price any shared overhead rather than imply all factories have
been isolated. No public flag or export is added.

The alternatives are the existing eager implementation and compact evidence
without activation. Module-absent bundles are controls, not equivalent evidence
for isolation when Link remains used elsewhere in the application.

## Validation and measurement obligations

- Preserve first failures and exact source/build/bundle/runner identities.
- Test meaningful late enrollment, foreign-owner confirm and rollback,
  cross-tree supplied inputs, held stale fields, same-key replacement, reentry,
  safe refusal, settlement, retirement and destruction.
- Keep the original point-work test: 200 edits at 2k and 20k rows must have equal
  counts below 2,000 visits. No replacement threshold.
- Run affected kernel/facade/types/retention and package-consumer checks, fresh
  bundle measurements, production demo build and relevant documentation gates.
- Measure production bundles with Link usable and actively exercised on another
  tree. Compare cold prefix, first context/activation, active use, replacement
  history and settlement/disposal drains. Include narrow/wide collections,
  ordinary state, many small trees, transactions and restoration.
- Use separate CPU and explicit-GC heap children, alternating identified arms
  and same-arm controls. Retain signed heap deltas and adverse profiles. Full
  process heap is not exact feature allocation or dominator attribution.

The development record below preserves the order of discoveries and failed
attempts. The completed measurement decision follows it; release qualification
is reported separately with its own exact source identities.


## Preserved findings during development

The original baseline failed the first 10,000-row, 32-field full root snapshot
in `cpu-1/execution/child-012.json`. Minified stack position 3:84194 maps to
`private.ts` spreading `suppliedViews(...)` into a single `push` call. This is
about 340,000 call arguments, not excessive tree depth. The original baseline
and its partial cohort remain preserved; they are not final timing evidence.
The comparison reference is the same baseline plus iterative appends preserving
all view identities and order. The candidate contains the identical repair.
`publication-wide-snapshot.spec.ts` exercises that exact public shape and retained
snapshot isolation; it and the existing saved-inspection/cached-current controls
passed (3 files, 4 tests). v15 has no corresponding publication snapshot recorder.

Independent source review also identified preparation chronology: promotion at
finalization must not acquire a declaration that began after preparation. A
paired eager/deferred control reproduced this: the deferred arm acquired a later
validation owner; the eager arm passed. The retained red run has 1 failed and
9 passing tests. The correction materializes the originally neutral preparation
without resampling input, frame or write-context scopes; the pending-owner window
is still sampled at finalization. An already sealed window remains sealed.
The corrected deferred suite and unchanged point-work suite pass 20 tests.
Public orchestrator reachability of that private phase control was not separately
established; the internal chronology mismatch itself was executed and repaired.

The first full v16 development suite had four failures: one genuine repeated
whole-row eligibility scan violated the original point-work bound, and three
allocation-counter assertions ran before the now-deferred allocation. The scan
was narrowed to supplied point fields, and finalization rechecks only ambient
eligibility. The original point bound was not changed. The representation tests
now demand evidence before asserting its allocation, and still check retirement.
These focused results are not final release qualification.

The v15 scope review separately checked the old finalizer history. Commit
`713f8a458` already replaced strong dependency-map holdings with weak cleanup
edges. The surviving derived-chain retention test covers that mechanism. Link
lifetime tests preserve the separate disposed-endpoint/registry-closure case and
now include a root endpoint that actually captures and reads its owner, alongside
bare/live/destroyed controls. No current retention defect was inferred merely
from the retired persistence reproducer's historical comment.


## Active-recipient follow-up plan (before execution)

The completed packet-3 matrix passes 18 controls, 76 CPU children and 52 heap
children. It does not show a universal episode CPU improvement. In the
initial-recipient 1k-by-8 profile, all three population CPU pairs are adverse
(+34.77, +20.74 and +3.50 ms), while episode differences have mixed signs.
Independent interpretation identified this as a concrete follow-up question.

Keep both exact packet-3 package artifacts unchanged. The new
`config-active-followup.json` fixes seven paired CPU rounds and three paired heap
rounds for initial-recipient 1k-by-8 and 10k-by-32 collections, plus an
initial-recipient ordinary 128-leaf control. Each has eight complete replacement
cycles. Separate A/A observations and the same eighteen fault/positive/heap
controls remain. Evaluate paired population, replacement/history and whole-episode
cost together, plus retained heap before/after activation and teardown. The
larger active collection is additional coverage, not a rerun substituted for a
poor result. All earlier results remain part of the decision. No acceptance
threshold, semantic guarantee, source change or release budget is altered by
this follow-up. Run only after the functional suite finishes, with no concurrent
build/test load.


Follow-up admission correction, still before measurements: the existing runner
rejects seven CPU rounds (maximum five) and requires all coverage modes plus
unrelated-Link A/A profiles. Its validation is unchanged. Preserve the rejected
configuration; `config-active-followup-2.json` uses five paired CPU rounds and
three heap rounds, retains the three targeted profiles and adds six explicitly
small coverage/control profiles. This produces 94 CPU and 58 heap children plus
18 controls. Those small profiles are controls, not expanded application claims.


## Completed functional and active-cost follow-up

The corrected v16 development kernel run passes 686 files: 7,395 passing tests,
five expected failures and twelve skips. The shared wide-snapshot repair is
isolated in `7d51fb13b`; unreachable v16 audit cleanup is isolated in `dd0702f69`.
v15 cleanup is `2833164cf`, with current documentation/controller successor
`e35dfa1b7`. These are source checkpoints, not completed release qualification.

The active-recipient follow-up passes all 18 controls, 94 CPU and 58 heap
children. It does not reproduce the original small-store population penalty:
initial 1k-by-8 paired median population CPU is +0.473 ms, with mixed signs.
However initial 10k-by-32 episodes with eight replacement cycles are adverse in
four of five pairs (+7.64%, +20.49%, +4.93%, +17.23%, -4.14%). Paired median
whole-episode CPU is +1,126.04 ms and history-mutation CPU is +1,001.30 ms.
History-held heap differences are +8.990, +1.992 and +0.007 MiB; after helper
return every sampled tree and snapshot is collected. This is an adverse cost
signal, not established retained leakage or exact feature allocation.

A four-process ABBA V8 CPU-profile diagnostic checks the same exact frozen
workload and semantic observations. Its main sampled hotspots occur in both
builds: publication entry replacement/propagation, entity preparation, row storage,
row generation and garbage collection. Profiled baseline episode CPU differs
from about 14.58 s to 17.52 s; candidate runs are about 15.19 s and 15.32 s.
These profiled timings include instrumentation and are not substituted for the
unprofiled cohort. No activation-specific hotspot is established by this pass.

Before deciding, `same-artifact.py` freezes and runs three CPU pairs and two
heap pairs for each artifact on the exact active-wide workload. Each pair uses
identical bundle bytes in separate fresh processes; kinds remain serial and
CPU/heap separate. All value/delivery observations must match, and complete
packet bindings are checked around execution. This diagnoses workload variation;
it does not create a confidence interval or erase the adverse A/B observations.

## Measurement decision

Retain automatic deferral for an unobserved, neutral entity prefix. No public
configuration switch or weaker guarantee is introduced. Keep ordinary scalar
publication unchanged. The collected evidence supports a substantial cold-store
benefit and a small fixed bundle cost, with first-use work explicitly deferred.
It does **not** establish a universal CPU win, permanent heap saving, or active
wide-store nonregression.

The main matrix uses three CPU paired rounds and two heap paired rounds, plus
same-arm controls. It passes 18 controls, 76 CPU children and 52 heap children.
The active follow-up passes another 18 controls, 94 CPU children and 58 heap
children. CPU and forced-GC heap children run separately and serially. Every
accepted arm verifies frozen source/build/bundle/runner identities and useful
state, ordered delivery, confirm/rollback, restoration and cleanup observations.
Independent interpretation verified 2,247 packet bindings and the primary paired
observations. Original failures and rejected admission are retained.

Paired CPU medians for cold stores, candidate minus corrected eager reference:

| Loaded profile | Population | First full context | Whole episode |
| --- | ---: | ---: | ---: |
| 1,000 rows × 8 fields | −15.18 ms | +3.36 ms | +2.27 ms |
| 10,000 rows × 8 fields | −119.93 ms | +22.87 ms | −42.96 ms |
| 10,000 rows × 32 fields | −297.13 ms | +77.35 ms | −310.95 ms |
| 256 small entity trees | −33.08 ms | +0.83 ms | −43.15 ms |

These are medians of paired differences, not differences of arm medians. The
episode includes fixture validation, preparation, mutation, actual root contexts,
ordered delivery checks and drains/cleanup. Module import is recorded separately.
The numbers are fixture CPU costs, not browser interaction latency.

Cold retained heap falls by 17.35 MiB for 10k × 8 and 50.31 MiB for 10k × 32.
After the first full context requires publication evidence, savings shrink to
about 0.23 MiB in both profiles. Transactions can activate evidence immediately;
ordinary and module-absent controls do not establish a meaningful runtime gain.
Signed process-heap differences are not exact per-feature allocations or
dominator attribution. Held-object and release controls detect actual lifetime
failures; no sampled tree or snapshot remains after release.

The production neutral no-Link fixture grows 1,329 raw / 365 gzip bytes; the
loaded fixture grows 3,217 raw / 884 gzip bytes. The latter includes Link and the
selected enhancer exports, so subtracting the two fixture sizes does not measure
Link alone. Both native factories are present in the loaded fixture and absent
from the no-Link control. Canonical release-bundle sizes are measured separately.

The exact-artifact wide-active diagnostics pass all semantic and object-release checks.
Identical-baseline second-minus-first CPU differences are −318.82, +3,362.64 and
+5,018.21 ms; identical-candidate differences are −52.44, +1,872.73 and −7,039.60
ms. They exceed the adverse A/B median of +1,126.04 ms, but are not confidence
intervals and must not be subtracted from it. Same-artifact history-held heap
varies by about −3 MiB for the baseline and +4 / 0 MiB for the candidate; this
does not bound the adverse A/B +8.990 MiB observation. The source of the active
wide-cost signal remains unresolved on this host. Profiling identifies shared
hotspots rather than a distinct added-path hotspot. Retain the adverse data and
restrict the claim; a strict active-wide performance guarantee needs a more
controlled host.

## Verification corrections

The initial v16 normal registry passed 83/87 gates. Its four failures remain
recorded: three new lint warnings, an eager-allocation assumption in an active
evidence GC test, a stale registration-mutation anchor, and numerical bundle
ceilings. Type-erased assertions resolve lint without changing emitted payloads.
The active GC case now explicitly demands evidence before measuring its release.
A new cold-source case asserts no participant before/after destruction, proves
four weak targets remain alive under explicit pins, then requires their collection
after all pins are released. This is not a claim that the reader alone retains
the other three targets. The installed mutation uses the exact emitted registration
call and still requires behavioral failure witnesses, no-Link isolation and clean
recovery. Its first whitespace mismatch is preserved as a separate failed attempt.
Focused corrected checks pass; the numerical ceiling remains a failed predicate.

The initial v15 registry passed 88/91 gates. Two documentation checks rejected a
historical RFC's relative link to the deleted serializer. Pinning that historical
reference to the baseline commit resolves both without rewriting the RFC decision.
The remaining failure is the existing numerical entity-bundle ceiling. These are
covered gate sets plus documented corrections, not invented single full green runs.


## Completed local qualification and cost disposition

Retain the compatible v15 cleanup and targeted v16 activation. No further public
removal, new package or configuration switch is justified by this audit. This is
completed local qualification with the specific numerical exceptions below,
**not an all-green normal release result**. No tag, merge, registry publication
or deployment is selected. Documentation-only successors preserve these exact
artifact identities:

| Line | Qualified source | Normal coverage and corrections | Mutation sensitivity | Canonical artifacts and browser checks |
| --- | --- | --- | --- | --- |
| v15 | `891159222d40ccb8f55da038334b9197e0bc3432` | Initial 88/91; both failed documentation checks corrected; covered set 90/91 | 91/91, exact restoration | 5 packages, 158 shipped payloads; strict consumers/AOT/facades; strict demo and 146/146 browser checks pass |
| v16 | `5801008ea4ca591b3be483e8bbb0aa02e15f59ed` | Initial 83/87; lint, retention/spec-types and registration corrections pass; covered set 86/87 | 87/87, exact restoration | 5 packages, 193 shipped payloads; strict consumers/AOT/facades; 137 behavior checks pass, 1 numerical bundle assertion fails |

All 144 fresh final v16 kernel payloads match the measured candidate byte-for-byte.
The normal suites, directed chronology and reentry cases, late readers, cold and
active GC, retirement, installed registration witnesses, restoration and original
point-work bound remain intact. Mutation totals establish rejection sensitivity;
they do not replace normal-gate success or prove every possible future behavior.

Fresh `build-packages.py` runs bind both references and candidates to unchanged
source with the same pinned Node/pnpm. v15's complete five-package file sets,
JavaScript, declarations, manifests and every other built payload are identical.
The removed implementation was not a shipped expense. v16 changes five kernel
JavaScript files (+5,316 raw package bytes) against the eager reference with the
shared wide-snapshot fix; all declarations, manifests and facade payloads match.

Canonical gzip bytes, measured through unchanged budget predicates:

| Fixture | Reference prod / dev | Candidate prod / dev | Delta prod / dev |
| --- | ---: | ---: | ---: |
| v15 bare | 11,011 / 13,159 | 11,011 / 13,159 | 0 / 0 |
| v15 entities | 25,333 / 28,273 | 25,333 / 28,273 | 0 / 0 |
| v16 bare | 18,409 / 20,785 | 18,407 / 20,785 | −2 / 0 |
| v16 entities | 45,244 / 49,014 | 45,595 / 49,365 | +351 / +351 |

v15's entity ceiling remains exceeded by 40.2 production / 113 development bytes.
v16's bare and entity ceilings remain exceeded. Its strict demo fails at 827.15
kB initial total against 570 kB; the browser assertion fails at 801,461 main-script
bytes against 570,000. A temporary budget-only override emitted the production
behavior artifact and was restored exactly. The earlier runtime-exclusion
assertions in that browser test pass before its final size assertion fails.

Accept these exact costs under the owner's cost/feasibility instruction: v15 has
zero delivered growth, and v16 adds 351 gzip bytes to the canonical entity fixture
(and 884 to the broader loaded-workflow fixture) for substantial cold-store
savings. First activation is charged explicitly; wide-active uncertainty remains
visible. This decision is artifact-specific, not a blanket budget waiver. Both
passing/grown/restored fixture sequences return 0/1/0. No numerical ceiling or
semantic assertion was weakened to obtain green.

Independent final review checked 1,757 v15 and 3,886 v16 tracked-source bindings,
command logs and source patches, build/archive/journal/payload joins, measured/final
kernel equality, demo artifacts/reports and derived budget-checker controls.
It found no new compatibility or binding blocker and explicitly retained the
numerical failures. The qualifier's `complete` and journal's `validated` states
describe their local workflows, not publication or all-green release authority.

## Evidence and rerunning

The [evidence index](evidence/index.json) binds every supplied task file in
[the compressed evidence archive](evidence/observations.tar.gz). It includes raw
observations, negative/positive controls, original failed attempts, source/build
snapshots, package payloads, canonical archives, commands, receipts and logs.
Verify without extracting or executing archive contents:

```text
python3 tools/publication-activation/verify-evidence.py docs/audits/2026-11-17-publication-activation/evidence/index.json
```

This verifies supplied-file integrity, not complete Git history or portable
reproduction of every test. Node, installed peers, browser binaries and the full
emitted demo are not bundled; their identities and demo file hashes are retained.
Original absolute paths describe this run. Use new paths/configurations to rerun
with the pinned dependencies; do not edit the frozen evidence to make it execute.
The verifier rejects optimized Python, missing/changed files, bad archive hashes,
unsafe paths, duplicate members and links. Positive, corruption and recovery
controls are included. The archive inputs were reviewed; the exporter is not a
secret scanner.

Primary generating tools and evidence records:

- `tools/publication-activation/README.md`: frozen workload, timing boundaries,
  controls and commands. `packet-3`, `controls-3`, `cpu-3`, `heap-3`, `analysis-3.json`.
- `packet-active-followup-2`, its control/CPU/heap directories and
  `analysis-active-followup-2.json`; `active-profile-1`, `active-same-artifact-1`.
- `tools/optimization-sweep/qualify-artifacts.py WORKSPACE EXPECTED_HEAD EVIDENCE_ROOT`:
  `v15-final-artifact-checks` and `v16-final-artifact-checks`, with completed packed
  admission controls. No publication action.
- `tools/optimization-sweep/build-packages.py WORKSPACE NEW_OUTPUT` and
  `tools/publication-activation/compare-built-payloads.py BEFORE AFTER NEW_RESULT`:
  `v15-payload-comparison.json`, `v16-payload-comparison.json`.
- `tools/publication-activation/verify-measured-kernel.py MEASURED FINAL NEW_RESULT`:
  `v16-measured-final-equivalence.json`.
- `tools/optimization-sweep/bundle-economics.py CONFIG NEW_OUTPUT`: both
  `*-bundle-economics-config.json` and `*-bundle-economics/` directories.
- `tools/publication-activation/run-command.py NEW_OUTPUT WORKSPACE COMMAND...`:
  named normal, focused correction, mutation and final documentation receipts.

The code branches are `codex/v15-legacy-boundary-cleanup` and
`codex/v16-publication-activation`; the central record, runners and evidence are
on `codex/publication-activation-study`. The earlier demo clarity/deployment TODO
remains applicable to future demo-site updates; this task changes no demo UI or
Vercel deployment.


Final study-runner lint exposed a syntactic `no-unsafe-finally` warning in the
frozen cleanup path. The guard records cleanup failure and throws it only when
the body has not already failed. A rule exception is limited to that exact study
file; no runtime-branch lint budget changes. `check-cleanup-errors.mjs` executes
positive work, cleanup-only failure and combined primary/cleanup failure against
the real final kernel. All three controls pass; earlier control-construction
failures are retained. All frozen packet bindings still match, so no measured
runner was rewritten after execution. Final study-tool lint passes.
Independent review confirms that scoped exception for the admitted fixtures.
The controls use ordinary `Error` objects; exotic throwing error-formatters are
outside this claim. A cleanup error can stop the remaining cleanup loop, but the
sample is rejected and cannot count as successful disposal.
