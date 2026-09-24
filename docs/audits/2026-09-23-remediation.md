# Audit remediation — release held

Owner authorization: address all reproduced audit findings. Baseline main
7ade0e3e; v15 safety branch starts at v15.2.1 cde208a0; legacy security branch
starts at 14.1.3 maintenance tip 5028433e. No push, tag, registry change or
public disclosure is authorized by this work. Research models stay frozen.

Original evidence: /private/tmp/signaltree-audit-7ade0e3e/AUDIT.md.
Original untracked tools/experiments research is preserved, not swept into fixes.

## Work ledger

- [x] Legacy serializer security: red regressions, independent review, fresh build,
      installed tarball controls and actual maintenance checkout 1,181 pass/15 skip.
      Preexisting full-source typing debt remains baseline-equivalent, not green.
- [x] Current dead serializer removal: export/reachability and replacement callers proved.
- [x] Transaction failed compensation: keep authority and durable hold on refusal.
      Callback failure with no returned handle remains a separate open API question.
- [x] Pending overlap: safe refusal before compensation; no speculative resurrection.
- [x] Same-tick rollback/undo: account for unflushed truth, including ABA; no forced
      callback flush and no assumption that equal value means identical ownership.
- [x] Transaction terminal destroy and thrown-undefined callback behavior.
- [x] Restoration provenance: unrelated confirm, entity compensation, undo overlap,
      rejected pending action truncating redo.
- [x] Multiple links, coalesced held waiters, subscribe exception, disposal idempotence.
- [x] Identity through batching, Link reconstruction, realization, restoration.
- [x] Deferred write classification and dynamically materialized entity fields.
- [x] Collection reorder outbound and whole-tree replacement ordering.
- [x] Vue throwing destroy observer and Solid derived disposal/equality.
- [x] Dormant-field observation and native updater reactivation.
- [x] Entity-field Link ownership, terminal types and native tooling arguments.
- [ ] Active correctness retention vs confirmed diagnostic history: reader audit;
      no arbitrary cap or claim that prototype label retention is this defect.
- [x] Circular codec behavior beyond prototype pollution, legacy path only.
- [x] Compiler infrastructure fail-closed spec-type gate.
- [x] Original research adapter honesty/execution failures; preserve historical reds.
- [ ] Unmet executable constitution: 424 current verdicts span scalar, structural,
      composition and authority cases, with 68 violations and 168 unsupported cases.
      Fourteen killed source-mutant variants cover 12 distinct mutation IDs;
      neither whole-law conformance nor M01–M30 closure is established.
- [ ] Full release-only mutation coverage.
- [x] Publisher provenance and artifact-boundary enforcement: isolated mocked
      regressions and independent review pass; not live release qualification.
- [x] Live release/advisory wording accurately describes unpublished status.
- [ ] Production build contract: explicit ngDevMode=false folding is verified
      across all five packages; automatic NODE_ENV-only removal is not a
      universally established contract and needs an explicit disposition.
- [ ] Hosted benchmark endpoints: ascertain deployment/auth contract; do not contact
      live endpoints or read credentials merely to prove a source concern.
- [ ] Full regression/build/type/lint/packed-consumer verification for each branch.
- [x] Opaque terminal payloads survive canonical snapshots and restoration without
      being reinterpreted as topology; exact v15 artifact reproduced and repaired.
- [x] Diagnostic journal excludes foreign/unknown owners while retaining own writes.
- [x] Destroyed transaction machinery releases obsolete confirmed history; live
      history policy remains the separate unchecked responsibility above.
- [ ] Callback failure plus refused compensation leaves a pending operation but
      cannot return its ordinary handle: recovery API requires a decision.
- [ ] Independent outbound progress versus conservative tree-wide consequence hold.
- [x] Bundle ceilings restored without raising limits: unused private diagnostic
      catalogue entries removed; current build and packed consumers qualified.
- [ ] Two public open-key runtime/type-contract defects remain unresolved. Four
      separate unexported provenance experiment failures remain research debt;
      they are not evidence of a public provenance feature.
- [ ] Public Proposal inspection paths are ambiguous for some valid state shapes;
      no lossless public-address or restricted-domain contract has been selected.

Completion requires recorded tests and limitations. Reproducing a defect is not
fixing it, and safe refusal is not surgical-settlement product conformance.
Publishing/disclosure and product demand testing remain explicit owner actions.

## Integration checkpoints (not release qualification)

- Batching: original six controls produced five failures/one pass. After context
  capture, location-identity keys and pre-enqueue refusal for transaction scope
  escape, those controls passed. A seventh dynamic-field control then failed:
  lazily created entity fields bypassed interception. The construction-local
  runtime projection factory now intercepts these fields without a retained
  collection of release closures. Eight focused controls and the wider batching
  selection pass (51 tests) on main and the isolated v15 maintenance checkout.
  Angular and Solid native-field controls pass. Initial native-suite runs also
  caught syntax errors in new tests and Vue grammar/type errors in a moved test;
  those runs are preserved, not treated as library evidence.
- First integrated kernel run: 2,488 passed, 7 expected failures, 13 skipped,
  1 todo. This snapshot preceded the ongoing structured-address repair and does
  not close the known transaction failures or the incomplete constitution.
- Benchmark detail handler: nine mocked-network controls (initial seven failures)
  now restrict gist content to owned benchmark records and valid IDs/content URLs.
  No deployed endpoint or credential was used. POST authorization policy remains
  an owner decision; the read-boundary repair does not close upload abuse.
- Owner decisions requested while independent repairs continue: diagnostic
  history retention policy, hosted anonymous benchmark upload policy, recovery
  authority when a transaction callback throws and compensation also refuses,
  corrected snapshot typing versus deliberate Link admission, and the supported
  non-Angular production-build contract.

Logs are outside the tree under `/private/tmp/`: `batching-context-red.log`,
`batching-dynamic-red.log`, `batching-dynamic-green2.log`,
`v15-batching-all.log`, `audit-adapters-integrated3.log`,
`audit-kernel-integration-first.log`, `benchmark-detail-red.log`,
`benchmark-detail-final.log`. Source typecheck and focused batching ESLint also
passed at that checkpoint. Final combined verification remains outstanding.

- Structured Link addresses: original six controls were five red/one green.
  Producer-owned segment arrays now cross the Link boundary without reparsing
  display paths. The expanded 19-case suite and independent rerun pass, including
  literal dotted/empty keys, numeric versus string entity IDs and production
  metadata controls. Wider focused selection: 233 tests across 29 files.
- Queued proposal inspection: two additional red controls showed immediate
  external entity updates were missed, including an ABA write. The notifier's
  literal field footprint now informs inspection and rollback evidence without
  delivering callbacks. Combined inspection/safety/witness selection: 42 passed.
- Legacy security checkpoint: 47 security controls, 80 serializer controls and
  1,158 passing source tests; ten installed-tarball attack/reference-chain checks
  pass. Cycle round-trip follow-up is still in progress, so that artifact is not
  a final candidate. The actual 14.x worktree remains untouched.

- Structured-address integration kernel checkpoint: 300 files, 2,551 passed,
  7 expected failures, 13 skipped, 1 todo; command exit 0. Source typecheck and
  focused transaction lint exit 0. New hydration typing probes are red and await
  a deliberate Link-admission boundary decision; this is not a release pass.

- Framework regression checkpoint: Angular 164 passed/3 skipped, React 20 passed,
  Vue 46 passed, Solid 26 passed; uncached Nx run exits 0.
- Isolated v15 build initially emitted files but retained process resources;
  interrupted run exit 130 is preserved. Installed Rollup's documented forceExit
  runs after awaited writes/cleanup; canonical Nx build with that flag exits 0
  (7.6 seconds). Artifact consumer checks follow; output existence alone was not
  accepted as build success.

- Independent follow-up after the green checkpoint found four inspection
  chronology failures (queued/ABA evidence lost after flush) and three batching
  failures (nested scope rollback, escaped-field retention after destroy, partial
  queued publication on observer throw). These are preserved as fresh reds; the
  earlier full-suite checkpoint does not close them.
- An in-flight Link acknowledgement can enter another reconciliation send while
  a newer transaction is pending. A dedicated red probe is preserved; repair
  must recheck consequence permission for each outbound lap.
- Final legacy source checkpoint: 70 security/codec controls, 103 serializer
  controls, 1,181 core passed/15 skipped. Fresh build exits 0; clean isolated
  installation of the tarball passes 10 security/reference controls and 6 cycle
  controls. Tarball SHA-1 61b0a7d71e51095f326cd73cfa07f653a37d8f99.

- V15 installed artifact: H1–H10 pass through package-root imports plus the
  public internals ledger reader. Extended suite is 17 passed/2 failed: dotted
  entity-ID rollback fails with and without batching. Both reds remain intact;
  the main structured-address repair is being assessed for a bounded v15 port.
  No source-only green is substituted for those artifact failures.
- Independent guard probes show explicit ngDevMode=false folds advisory warnings
  while preserving mandatory error messages in all five entry points; automatic
  NODE_ENV-only behavior is still a build-contract decision, not a completed fix.

- Read-only downstream exposure scan: TruckTrax v3 resolves installed core
  14.1.3; 86xed resolves core 11.0.0. Both installed resolvers contain the unsafe
  legacy navigation and persistence.load reaches deserialize. No application
  serialization/persistence enhancer or matching deserialize/fromJSON/restore
  input path was found within the recorded source scope. This is a static
  non-reachability finding, not proof about deployed bundles/dynamic runtime code.
  Evidence: /private/tmp/signaltree-consumer-exposure/FINDINGS.md. No credentials,
  storage contents, deployed endpoints or application execution were used.

- Batching adversarial repair integrated from an isolated candidate: 13 added
  controls began 9 red/4 passing, then all passed. The combined main batching,
  transaction and in-flight Link run reports 285 passed/1 failed: the remaining
  failure is the newly added dispose-while-endpoint-never-resolves control.
  That first red is preserved and is being repaired; it is not waived.
- V15 dotted rollback: eight new source controls all failed before the seven-file
  structured-address port, then passed. Full v15 kernel checkpoint: 2,396 passed,
  7 expected failures, 13 skipped, 1 todo. This precedes the later batching/async
  Link backports and does not replace their final build and tarball verification.

- An independent probe proposed that a net-zero authored transaction should
  supersede an older contribution. History refuted that assumption: commit
  0a131c34 and existing confirmed-turn/restoration tests deliberately define
  transactions as net consequences, not attempted-write logs. No new ownership
  rule is introduced for that case. Ordinary/realized ABA remains separately
  covered. The independent probe is retained as a rejected hypothesis.

- Clean five-package build exits 0, all five artifacts report 16.0.0 (unreleased),
  built consumer warning-folding controls pass. Latest kernel checkpoint: 2,595
  passed / 7 expected failures / 13 skipped / 1 todo.
- Bundle gate is red: bare production 10.40/10.25 KB and development
  12.52/12.45 KB; entities production 22.91/22.6 KB and development
  25.51/25.25 KB. Reachability attribution is underway; no ceiling changed.
- Independent Link review reproduced inspection promotion through entity
  whole-row payloads: inspection-only x followed by authored sibling y sends x.
  That red is being repaired separately from per-send settlement permission.

- Verified legacy source and regression files are now applied to the actual
  signaltree-14x maintenance checkout; SHA-256 byte comparison matches the isolated
  built/tested copy. No version, commit, tag, registry or advisory action occurred.
- Main installed-consumer typecheck passes under bundler and node16 with runtime
  facade identity checks. First default-cache failure and restricted-network
  interrupted attempt remain recorded; successful run uses a temporary cache
  and public dependency access with install scripts disabled.

- Actual v14 maintenance checkout focused security/codec validation: 70/70,
  exit 0 from the package-root Vitest command. The preceding legacy Nx exit 0
  lacked totals and the root-directory direct attempt failed setup resolution;
  neither was substituted for this explicit execution.
- Confirmed-reader metadata: two new reds showed rejected/pending ID gaps falsely
  signalled truncation. The current never-evicting ledger now reports no truncation;
  52 related tests pass. Future eviction must provide explicit metadata. This
  does not decide or implement the pending retention policy.

- Actual v14 maintenance checkout full execution: 101 files, 1,181 passed,
  15 skipped. The source and regression files still match the independently
  built and packed isolated copy. Publication remains on hold.
- Entity inspection-egress repair frozen: 285 focused tests pass. The latest
  full kernel checkpoint reports 2,617 passed, 7 expected failures, 13 skipped,
  1 todo and one remaining opaque-leaf snapshot failure. The first integration
  regressions are preserved; they were repaired by keeping egress footprint
  intent separate from generic causal classification. The remaining snapshot
  failure is not waived and this checkpoint is not a full-suite pass.
- Hydration types now describe actual snapshots without widening Link admission.
  Existing negative Link admission tests remain unchanged. This resolves the
  earlier implementation-choice question; fresh artifact checks remain pending.
- Bundle attribution found no Link, transaction, restoration, PathNotifier or
  enqueue-observer code in either budgeted bundle. Moving that optional machinery
  cannot explain or remove this measured growth. No budget was raised and no
  speculative relocation was made. Evidence: /private/tmp/link-bundle-attribution/REPORT.md.

- Opaque terminal snapshot repair: root/branch snapshot traversal no longer
  interprets terminal payload objects as tree topology and drops their callable
  members. Seven controls plus independent accessor/non-execution checks pass;
  full kernel checkpoint: 2,625 passed, 7 expected failures, 13 skipped, 1 todo.
  Source typing subsequently exposed fixture/helper issues tracked separately.
- Workspace lint: all six kernel/facade/demo targets exit 0 (warnings retained).
  Integrated GC suite: 10/10, exit 0. These precede subsequent diagnostic-journal
  isolation work and are checkpoints, not final release qualification.
- Diagnostic journal isolation: promoted its existing expected-failure assertion
  to an ordinary test and added two journals writing the same path in one flush.
  Both failed before the owner filter; 63 diagnostic tests now pass. The journal
  uses its existing construction owner, ignores unknown/foreign ownership and
  changes no transaction-history policy. Dedicated GC controls still pass 4/4.
- Independent publisher review found four gaps despite 23 mocked checks passing:
  final rebuild was not tied to full-gated bytes; event provenance SHA could
  differ from checkout; release workflow directly interpolated dispatch input;
  tarballs could change during the registry lookup after integrity verification.
  Mock reproductions are preserved at /private/tmp/publish-independent-review/.
  Repair and expanded negative controls are in progress. No real publication or
  network action was used for these probes.

- Fresh main build from empty dist: all five package builds exit 0; each manifest
  reports 16.0.0 (unreleased); recorded production/configuration source hashes
  are unchanged across the build. Full kernel: 2,661 passed, 6 expected failures,
  13 skipped, 1 todo. The reduction in expected failures is the repaired journal
  isolation assertion, not deletion of its claim.
- Fresh size gate remains red: bare 10.35/10.25 KB production and 12.48/12.45 KB
  development; entities 22.99/22.6 and 25.58/25.25. Explicit ngDevMode=false
  warning-folding and readable mandatory errors pass for all five built facades.
- Four adapter suites and React reference pass: Angular 164/3 skipped, React 20,
  Vue 46, Solid 26, React reference 26. Combined command exits 1 because demo
  Jest cannot start Watchman inside the sandbox; rerunning the same demo config
  with Watchman disabled exits 0, 169 passed/4 skipped. First failure retained.
- Surface/documentation selection: 13/16 pass. Remaining findings were the two
  intentional hydration invocation-signature changes, a real test factory used
  through a runner string invisible to static reachability, and two stale links
  to removed serializer files. The live guide now points to migrated Link
  controls; the archived proposal retains its wording with a historical note.
  Doc-links rerun exits 0. No invocation baseline or dead-export budget relaxed.
- V15 final artifact checkpoint: 2,436 source tests passed, 7 expected failures,
  13 skipped, 1 todo; strict source types and changed-file lint exit 0; uncached
  build exits 0. A NEW installed consumer passes all 19 original probes (the
  earlier two dotted-key failures included), two opaque payload controls, three
  asynchronous Link controls and the public DevTools collection-egress probe.
  The 89 packed files match fresh dist and the installation. SHA-256:
  `2c6f0443e1b20941426a475da577eb2c2f637ab7e7c47b946dc2ef5c9a05aea0`.
  This is an unpublished patched 15.2.1 test artifact, not a released fix.
  Evidence: /private/tmp/v15-final-artifact-evidence/RESULTS.md.

- Main packed consumer types pass under bundler and node16; facade runtime
  identities also pass. All 142 built-file hashes match before/after validation,
  including the gate runner's intervening automatic build. This does not assume
  that a build runner is read-only; matching bytes were actually checked.
- Invocation baseline correction now records only `AccessibleNode` and
  `SignalTree.$` snapshot read/write/updater types, matching the verified runtime
  hydration contract. All 240 entry identities/kinds remain unchanged. The
  generated candidate baseline passed 13/13 mutation controls on an isolated
  copy of declarations; workspace dist was not mutated. Direct baseline check
  passes. The first red remains in `surface-doc-gates.log`.
- Retention measurements are not closure: 50,000 accepted transactions leave
  50,000 confirmed records/effect slots/baseline entries even though pending
  correctness maps are empty. A passing narrow pending-map assertion is not a
  passing L15 result. Live-history policy and destruction cleanup are being
  evaluated separately; no history cap has been silently chosen.

- Supplemental packed hydration fixtures exposed a gap in the standard consumer
  gate: six negative Link-admission controls are unused under both bundler and
  node16 for Angular/Vue/Solid. Source controls still reject them. The private
  construction identity is emitted independently by kernel root and adapter
  declarations. The preceding standard consumer pass is preserved, but does not
  qualify this boundary. Declaration repair and permanent packed negatives are
  in progress; no negative assertion is being weakened. Evidence:
  /private/tmp/hydration-packed-consumer/hydration-bundler.log and
  hydration-node16.log.
- Destroyed-tree retention is independently reproduced with a held tree/runtime/
  reader and no caller-held record snapshot: obsolete confirmed payloads remain
  reachable although the public reader rejects reads after destruction. A
  destruction-only cleanup now passes the frozen five-control GC probe and
  272 focused transaction tests. Live-history retention policy remains open.
  V15 backport passes its full source suite (2,441 passed, 7 expected failures,
  13 skipped, 1 todo); rebuilt-artifact verification is still in progress.
- Demo production build exits 0 outside the sandbox with two build workers. The
  first sandbox build's esbuild deadlock and the second failure remain recorded;
  the precise environment cause has not been established. No deployment occurred.
- Additional isolated source mutations M25 and M26 are killed: execution-time
  context lookup turns an external write into undoable authorship; queuing before
  an unsupported-composition refusal leaks a write despite refusal. Both record
  control 0 / mutation 1 / restored 0 with frozen source and no workspace dist
  mutation. This raises actual executed mutation coverage to five distinct IDs,
  not the entire M01–M30 inventory. Evidence:
  /private/tmp/signaltree-isolated-M25-M26/verified-sequences.json.

- Destruction cleanup artifact checkpoint: main 272 focused transaction tests and
  five independent GC controls pass; v15 full suite 2,441 pass/7 expected failures/
  13 skipped/1 todo, source types and changed-file lint exit 0. Fresh v15 build
  exits 0; a NEW installed consumer passes 24 unchanged runtime controls, one
  public DevTools collection control and four fresh-process public GC controls.
  All 89 artifact files match. New unpublished patched-15.2.1 SHA-256:
  `421c45edb7cd8c96ebdbd44fbf20794820436e471fc6d71e93b058e60351a78a`.
  The preceding `2c6f0443...` artifact remains historical evidence, not overwritten.
  Reports: /private/tmp/confirmed-destroy-main/RESULTS.md and
  /private/tmp/confirmed-destroy-v15/RESULTS.md.
- Independent expected-failure audit separates two public open-key defects from
  four unexported provenance-spike failures. Valid Record whole-value replacement
  loses new keys; unmaterialized descendants promised by types do not exist.
  Existing architecture alternatives remain undecided; inference is not narrowed
  to conceal the mismatch. The restoration TODO's exact missing-placement-evidence
  precondition is still under bounded characterization. See
  [remaining expected failures](2026-09-23-remaining-expected-failures.md).

- Publisher repair checkpoint: the four original publication reds remain
  preserved. Expanded mocked controls first reported 28 passed/9 failed. A
  subsequent A→B/B counterexample disproved the first post-suite-only seal:
  early gates could validate A while a later gate left B for the final rebuild.
  The publisher now seals an uncached clean build before the suite; explicit
  existing-artifact mode skips the runner's automatic build and checks the seal
  before/after every normal gate. Mutation proofs remain separate, followed by
  the deliberate clean uncached rebuild, which must reproduce the original
  seal. Exact release event/workflow/SHA/HEAD binding, environment-based tag
  transport and tarball hashing after registry lookup are enforced.
- Gate-write inventory found a persistent callable self-test backup in dist.
  The backup now stays in memory; success, baseline failure and an exception
  after a real mutant write verify restoration without adding a package file.
  Those cleanup controls were 40 passed/3 failed before repair. Bare/separate
  seal arguments were another 47 passed/2 failed, and now reject before a build.
  Current suite: 49 passed/0 failed; lint, syntax, diff and mocked publication
  architecture checks pass. Main and Mencius independently reran all 49.
  Boyle's isolated boundary assertions record sealed 49/0 → guards removed
  47/2 → restored 49/0, with no additional blocker. Evidence and exact commands:
  /private/tmp/publish-repair-evidence/SEAL-RESULTS.md;
  /private/tmp/publisher-seal-independent-boyle/sequence.json;
  /private/tmp/publish-main-independent-check.log.
  This proves identity at gate boundaries, not continuous immutability inside
  a gate or actual build reproducibility. No shared full release gates, live
  publisher, network operation, registry write or release qualification is
  claimed. Earlier publisher failures and unrelated release reds remain.

- Main post-destruction full kernel rerun exits 0: 312 files, 2,667 passed,
  6 expected failures, 13 skipped, 1 todo. Evidence:
  /private/tmp/main-audit-post-destroy/kernel.log. This includes destruction
  controls and preserves the six separately classified expected failures.
- Main independently reran the publisher regression harness: 49/49, exit 0
  (/private/tmp/publish-main-independent-check.log). These are intercepted
  subprocess/workflow controls; no real registry publication was attempted.

- Unified declaration build checkpoint: fresh empty-dist all-five build exits 0
  with unchanged recorded inputs. All five versions remain 16.0.0 unreleased.
  The actual packed consumer passes both strict bundler/node16 resolution,
  including all original hydration negative assertions and runtime facade
  identity checks. Two shared private declaration chunks are packed; no public
  exports were added. Kernel tarball SHA-256:
  `7f952abd757dc7a07b0621b8dd154c4e6e23be89a7f607e24785c25f9280bdb0`.
  Evidence: /private/tmp/hydration-declaration-repair/. Independent stripping of
  only the six negative directives produces exactly six intended TS2345 errors
  in each mode; a framework-free fake realization compiles and runs.
- This declaration layout exposed allocation-dependent Symbol.iterator names in
  the callable baseline and single-file mutation targets in its self-test. The
  first red is preserved; stable identity and declaration-owner repair are in
  progress. Neither is an API change or permission to weaken the 13 mutants.
- Fresh source typecheck, spec-type gate and six-target lint exit 0. Declaration
  documentation and declared artifact checks pass. Package hygiene initially
  fails because npm cannot write its default cache; unchanged artifacts pass
  all-five actual tarball checks using a writable temporary cache. No cache
  ownership was changed. The unchanged bundle ceilings remain exceeded. Logs:
  /private/tmp/main-audit-final-declarations/.
- Restoration follow-up proves the no-placement-evidence condition reachable.
  Four multi-restore controls pin truthful refusal and retained authority; a
  single-restore path instead chooses an unrelated current tail. The existing
  TODO is not closed. Tests-first enforcement of the already-recorded complete
  target/refusal requirement is now in progress, with no new placement rule.

- Budget follow-up tested three address-plumbing variants in an isolated source
  snapshot. Shared freezing worsened development bundles; a larger saving moved
  registration timing and was not promoted. The semantics-preserving loop
  deduplication saves only 3–9 gzip bytes and leaves all four limits red. No
  micro-optimization was integrated merely to claim progress, and no budget was
  raised. Evidence: /private/tmp/address-budget-slice/REPORT.md.

- Independent review extends the placement finding beyond transaction rollback:
  public undo and redo also append after an unrelated new row once recorded
  anchors disappear. Public ordinary-write and Link-realization controls reproduce
  it on current source and exact npm 15.2.1. A further two-collection probe finds
  bare lifetime-number joins treating another collection's restored entity as
  an anchor. Both are now under tests-first repair at semantic planning boundaries;
  transaction-only green does not close them. Evidence:
  /private/tmp/restoration-independent-review/public-only-results.json,
  published-public-results.json and cross-owner-results.json.

- Shared declaration chunks exposed two tooling defects: TypeScript iterator
  allocation IDs changed despite identical public contracts, then six of the
  13 callable mutations were inert because their owners moved out of index.d.ts.
  Both original reds are preserved. The reader now canonicalizes only computed
  keys resolved to standard-library SymbolConstructor unique-symbol properties;
  arbitrary unique symbols and literal property names remain distinct. Exactly
  two baseline id/name pairs changed, with all 240 records' other fields and
  the prior hydration signature corrections preserved.
- Callable mutations now resolve each exported type/member to exactly one
  declaration inside the kernel artifact before writing. Shared chunk basenames
  are not guessed; original buffers are restored in finally. The existing
  api-callable-baseline:self path permanently runs the four symbol regressions
  and then the unchanged 13 mutation expectations, reporting separate 4/4 and
  13/13 counts. Publisher fixtures execute the regression child rather than
  mocking success; missing/failing children stop before the mutation checker.
  Wiring controls were 54 passed/6 failed and now pass 60/60. Independent review
  reproduced these final counts and added outside-owner, zero-write and symbol
  collision controls. All 144 copied artifacts were restored and all 144 main
  artifact files remained unchanged. Lint, scoped diff and publication-architecture
  checks pass. Evidence: /private/tmp/callable-declaration-owner/RESULTS.md and
  /private/tmp/callable-independent-boyle/REVIEW.md. No main-dist mutation, build,
  network action, public API change or release qualification is claimed.

- Callable-tooling follow-up is independently verified: standard-library symbol
  identities no longer include compiler allocation numbers, and mutation targets
  resolve to their actual declaration owner across shared chunks. Only two
  baseline IDs/names changed; all 240 entries and signatures otherwise remain
  intact. The existing self-test gate now runs four permanent allocation/collision
  controls followed by the original 13 mutation controls. Independent execution
  passes both; publisher orchestration fixtures pass 60/60, including missing or
  failing regression-child refusal. All 144 main artifact files remain unchanged,
  and all isolated files restore exactly. Evidence:
  /private/tmp/callable-declaration-owner/RESULTS.md and
  /private/tmp/callable-independent-boyle/REVIEW.md.
- Architecture options are recorded as unvalidated alternatives, not a selected
  replacement: [options and tradeoffs](2026-09-23-options.md). Independent premise
  review corrected the distinction between a native draft projection and ordinary
  application-root compatibility, and separated already-required independent
  progress from unknown application dataflow. No new law or prototype was added.

- Combined restoration repair now passes independent 19-case review and the
  26-control source suite. The obsolete empty TODO is explicitly dispositioned
  to the executable controls; no asserted expectation was deleted. Full main
  rerun: 2,693 passed, 6 expected failures, 13 skipped, zero TODO. Angular 164
  (3 skipped), React 20, Vue 46 and Solid 26 also pass. The combined command
  exits 1 because React reference's runtime resolver loads a declaration file
  through a library typing path. This newly exposed configuration defect is
  being fixed; the combined run is not reported green.
- A fresh five-package build after restoration exits 0 with unchanged recorded
  inputs. Declaration docs, declared files, actual package hygiene, invocation
  inventory and devmode controls pass; all five versions remain 16.0.0 unreleased.
  Bundle limits remain red. Logs: /private/tmp/main-audit-final-restoration/.
- New frozen-oracle conformance outputs preserve all prior evidence. All four
  semantic commands exit 1: scalar 25 held / 9 violated / 1 unsupported;
  structural 135 / 48 / 24; composition 28 / 10 / 133; authority 0 / 1 / 10.
  Zero execution errors and no production-input drift were observed. These are
  bounded scenario counts, not passed laws. Scalar S13/local-frontier/R is a
  baseline-held/current-violated case: conservative pending-overlap refusal
  denies a reversal the frozen oracle requires to succeed. It remains visible,
  not reclassified as conformance. Evidence:
  /private/tmp/signaltree-final-current-conformance-20260924/RESULTS.md.

- V15 placement/owner repair checkpoint: the corrected test-only evidence adapter
  preserves 14 genuine initial failures and removes eight absent-v16-helper
  harness errors from the earlier run. All 26 controls then pass; full v15 suite
  2,467 passed, 7 expected failures, 13 skipped, with its covered TODO subsequently
  dispositioned to the executable tests. Source/typing/lint checks pass.
- Fresh v15 artifact SHA-256
  `3955ed32c6aedf804b11464b7cc809c6c5619419012baeeafd3eb4142892aad9`
  passes 36 installed runtime controls, four real-GC controls and strict consumer
  types in both resolutions. All 89 files match fresh dist/installation; public
  declarations and manifest remain unchanged. First v15-specific budget run
  passes unchanged ceilings: bare 10.15/10.25 KB production, 12.27/12.45 development;
  entities 22.55/22.60 and 25.18/25.25. Devmode and artifact/API inventory pass.
  This is an unpublished patched 15.2.1 test artifact, not a published 15.2.2.
  Evidence: /private/tmp/v15-restoration-l17/RESULTS.md.
- A final bounded reserved-key audit finds no global prototype mutation in 33
  initial controls, but identifies an actual inherited-property read/egress gap
  after an entity update omits an own special-named field. A held accessor can
  return Object.prototype/Object rather than undefined. Repair is in progress;
  the negative pollution controls do not establish universal security clearance.


## Final own-property checkpoint (2026-09-24)

The held-field own-property repair passed the permanent 28-case suite and an
independently authored 44-case source suite. The latter preserved 22 violated
controls before repair and 44 held afterward. It guards omitted field reads and
captured field-Link payload projection; it does not blacklist legitimate keys
or claim global prototype pollution. Full kernel: 2,721 passed, six expected
failures, 13 skipped, zero TODO, exit 0. All four adapter suites and the React
reference application passed a subsequent combined run (20/164/46/26 adapter
passes, three Angular skips, and 26 reference passes).

Source typecheck and six-project lint passed. The spec gate initially found two
new callback-return type errors in the restoration placement spec; changing only
those callbacks to block bodies preserves assertions and returns void. The next
spec gate exited zero; its baseline was not relaxed.

The frozen conformance rerun retained all 424 verdicts and assertion arrays:
scalar 25 held / 9 violated / 1 unsupported; structural 135 / 48 / 24;
composition 28 / 10 / 133; authority 0 / 1 / 10. Each semantic command exited 1,
with zero execution errors. S13/local-frontier/R remains a baseline-held to
current-violated case: conservative refusal does not satisfy required successful
reversal. See `/private/tmp/signaltree-final-current-conformance-ownproperty-20260924`.

The first final build omitted the established Rollup `--forceExit` flag and
remained alive after producing kernel output. Only its identified processes were
terminated; exit -15 and the incomplete one-package output are preserved. The
only input change during that attempt was the two test callbacks above. A fresh
empty-dist build with the established flag follows; the stopped attempt is not a
passing build. Evidence: `/private/tmp/main-audit-final-own-property/`.

The subsequent empty-dist build with `--forceExit` exited zero with unchanged
inputs and all five built versions 16.0.0. Declaration docs, package hygiene,
240-entry invocation baseline and dev-mode checks passed. Bundle gate exited one:
bare 10.35/10.25 KB prod and 12.48/12.45 dev; entities 23.01/22.60 prod and
25.60/25.25 dev. Ceilings are unchanged. The callback-only test correction was
then rerun: all 26 restoration placement controls passed.

Final installed current packages pass strict consumer types under both
resolutions, unchanged facade negative controls, all four facade runtime probes
and six original omission controls. All 144 dist files remain unchanged. Kernel
tarball SHA-256 `92d3b949b1ed87d86baa3be50a98aacbbfd3a7fa95d7a03a94ce82033a68c7f7`.

Final v15 own-property candidate: 2,487 ordinary passes, seven expected failures,
13 skipped, zero TODO. Source/typing/lint pass. Spec gate's first six errors were
corrected only in test callbacks and required-existing-row reads, then passes
against the unchanged 223-error baseline. Fresh unpublished tarball SHA-256
`7e5e8d288daf96174eea315fbb577b97e8cb6a095c2ef5c7302bfc5a744c84cf`
passes 36 prior runtime controls, 20 own-property controls, three original public
probes, four real-GC controls and both strict consumer resolutions. All 89 files
match dist/installation; only entity-signal.js differs from the previous
`3955ed32…` artifact. V15's unchanged budget passes: bare 10.15/10.25 KB prod and
12.27/12.45 dev; entities 22.57/22.60 and 25.20/25.25. Main's red budget is not
transferred to this distinct v15 artifact or waived.

Legacy own-property follow-up: the isolated 14.x candidate passed 1,205 tests
with 15 skips. Independent 50 controls went from 22 behavioral failures to zero.
Fresh installed artifact passes 10 security/reference, six cycle and 24 field
controls. Tarball SHA-256
`818fbef4d398c0f70f884e630ad9b784d54007ef2b0320d6cce60b9c110e19e4`.
The exact independently reviewed helper and spec patch is now applied to the
actual maintenance checkout; all four security/field source and spec files match
the tested copy. No version or public action. Earlier security/codec artifact
remains preserved separately. Actual checkout full-suite rerun follows.

Actual14 final full suite: 102 files passed, 1,205 tests passed, 15 skipped,
exit zero. `/private/tmp/actual-v14-final-own-property-core.log`. All source
repairs are uncommitted; publishing/disclosure stays on hold.

## Continued independent work after the checkpoint

The open-decision list is not a task-wide blocker. Further isolated mutation
proofs, measured budget candidates and contract feasibility work continue.
Public docs now state the independently reproduced inspection-path limitation:
literal dotted keys and nested fields can share both path and status, so neither
is a universal address. This corrects an overbroad JSDoc claim; it does not add
an address API, restrict valid keys, or change runtime classification. The demo
resolver is explicitly an application adapter for its known IDs. Two stale
`proposal()` spellings in live JSDoc now use `propose()`. All three touched files
pass focused Prettier checks. These comment/README edits postdate the captured
artifact checkpoint; generated declarations/README require a fresh build before
any subsequent artifact claim.

Additional isolated mutation evidence: M04 confirmation-sequence reassignment
changes the frozen S11/12/AR final value; M06 business-key-as-lifetime makes an
old held reference read a fresh entity; M08 enqueue-context omission misclassifies
external writes as undoable. Each has actual source green/red/restored-green
evidence. Inventory is now 17 source variants across 15 distinct IDs.
The M19 guard probe produced extra publication but did not mutate values or
settlement membership, so it is recorded separately and not counted as the
frozen state-mutation definition.

Independent prerequisite review found no requirement that capabilities absent
from the current implementation must first be added to it to test the suite.
Strict finite authority traces can test oracle/runner sensitivity separately;
they cannot manufacture native conformance or count as production-source kills.
The stronger T19/T21 instrument verifies truth-callback invocation and complete
operation consumption; omitted callbacks and unused traces are errors. Current
authority capability labels remain unchanged.

Strict authority instrument checks are now permanent in
`semantics-authority-trace-selftest.spec.ts`: 13 new checks plus the unchanged
28 existing checks pass (41 total). Independent review reran the exact traces
and verified protocol faults are errors, while arrival-order bad values produce
the intended assertion violations. This is explicitly not a native authority
implementation or a production-source mutation kill. No frozen oracle changed.
