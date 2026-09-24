# Current repair checkpoint — not release qualification

Main base: `7ade0e3ecb25ff0d06da4355b5f7d67844e147b7`, with uncommitted repairs.
No version bump, commit, push, tag, publication, deprecation or public advisory
has been performed by this repair pass. Original failures and prior artifacts
remain separate evidence. The frozen semantic laws and assertions are unchanged.

## Current workspace

- Kernel: 2,721 passed, six expected failures, 13 skipped, zero TODO.
- Angular: 164 passed, three skipped. React: 20 passed. Vue: 46 passed.
  Solid: 26 passed. React reference: 26 passed.
- Source typecheck and six-project lint exit zero. Spec gate exits zero after
  correcting two callback-only typing errors; its first red is preserved and
  its baseline was not relaxed.
- Fresh uncached empty-dist build: all five packages report 16.0.0, unchanged
  build inputs. The earlier build lacking `--forceExit` was stopped and is not
  counted as successful.
- Installed consumer: strict bundler and node16 checks with `skipLibCheck:false`,
  unchanged facade negative typing controls, runtime facade checks and six
  omitted-field regression/control probes all pass. All 144 build files remain
  unchanged after verification.
- Kernel tarball SHA-256:
  `92d3b949b1ed87d86baa3be50a98aacbbfd3a7fa95d7a03a94ce82033a68c7f7`.
- Declaration docs, package hygiene, 240-entry invocation surface and dev-mode
  checks pass. Bundle budgets remain red: bare 10.35/10.25 KB production and
  12.48/12.45 development; entities 23.01/22.60 and 25.60/25.25 respectively.
  No budget increase was made.

Evidence: `/private/tmp/main-audit-final-own-property/`,
`/private/tmp/kernel-prototype-key-audit/main-kernel-final.log`,
`/private/tmp/final-own-property-consumer/result.json`.

## Patched v15 artifact

This remains an **unpublished patched 15.2.1 test artifact**, not a released
15.2.2. The isolated branch starts from the exact 15.2.1 source base.

- Full kernel: 2,487 passed, seven expected failures, 13 skipped.
- Source/typing/lint pass. The spec gate first found six added-fixture typing
  errors; callback return types and required existing-row reads were corrected
  without changing assertions. Final gate passes against the unchanged baseline
  (223 known errors across 36 files remain; this is not zero total spec debt).
- Fresh installed artifact: prior 36 runtime controls, 20 own-property controls,
  four real-GC controls, three public omission probes and both strict consumer
  resolutions pass. V15-specific size ceilings and artifact/API checks pass.
- All 89 artifact files match dist and installation; public declarations and
  manifest remain unchanged. Only entity-signal.js differs from the previous
  preserved `3955ed32…` artifact. Subsequent source edits are test-only.
- Final tarball SHA-256:
  `7e5e8d288daf96174eea315fbb577b97e8cb6a095c2ef5c7302bfc5a744c84cf`.

Evidence: `/private/tmp/v15-own-property-qualification/`,
`/private/tmp/v15-packed-own-property-final-consumer/artifact-provenance.json`.

## Legacy maintenance security and own-property repair

The legacy serializer fix remains intact. The additional field-reader fix is
independently reviewed: identical 50-case controls went from 22 violations to
zero. It guards both held reads and updater arguments while retaining legitimate
own getters and field names; no global prototype mutation is claimed for this
separate defect.

The isolated legacy core passed 1,205 tests with 15 skips. Fresh installed
package-root checks passed 10 security/reference controls, six cycle controls
and 24 own-property controls. The unpublished patched 14.1.3 tarball SHA-256 is
`818fbef4d398c0f70f884e630ad9b784d54007ef2b0320d6cce60b9c110e19e4`.
The actual maintenance checkout also passed all 1,205 tests with 15 skips
(exit zero, `/private/tmp/actual-v14-final-own-property-core.log`).
Both runtime repairs and both specs now reside in the actual 14.x maintenance
checkout; all four files match the reviewed/tested isolated copy byte-for-byte.
Known preexisting full-workspace typing problems remain separate from these
passing source/artifact controls. No registry/advisory action has occurred.

Evidence: `/private/tmp/signaltree-14-security/artifacts/own-property/RESULTS.md`,
`/private/tmp/entity-own-property-14-independent/REVIEW.md`, and
`/private/tmp/legacy14-own-property-applied.json`.

## What remains unearned

The current frozen semantic suite has **188 held, 68 violated, 168 unsupported**
cases across 424 verdicts, with zero execution errors. Each of its four commands
exits one. All verdicts and assertion arrays match the preceding checkpoint;
S13/local-frontier/R is still a baseline-held → current-violated case because
conservative refusal does not meet its required successful reversal.

Fourteen killed production-source mutant variants cover twelve distinct IDs;
this does not establish M01–M30 closure. No architecture candidate has won.
The ordinary package suites are compatibility/regression evidence, not a
substitute for these stronger laws.

Read the [options and tradeoffs](2026-09-23-options.md),
[remaining owner decisions](2026-09-23-open-decisions.md), and
[chronological remediation ledger](2026-09-23-remediation.md).
The six expected failures comprise two public open-key defects and four separate
unexported provenance experiment limitations; neither category is silently
counted as repaired. Inspection-path ambiguity, live retention, recovery handles,
independent progress and the production/build policies retain explicit limits.

## Subsequent catalogue cleanup qualification

The preceding red size measurements remain historical evidence. Removing unused
private diagnostic catalogue entries restored the unchanged budgets: bare
9.75/10.25 KB production and 11.89/12.45 KB development; entities 22.39/22.60 KB
production and 25.02/25.25 KB development. Actual main build and budget exits
were zero, not inferred from the isolated candidate.

Fresh all-package build: exit zero, all five versions 16.0.0, no captured input
drift. Kernel: 315 files, 2,734 passed, six expected failures, 13 skips. Typecheck,
spec-type gate, kernel lint, invocation, error-code, declaration-documentation,
package-hygiene and dev-mode gates all exited zero.

Packed strict bundler/node16 consumers passed, with all four facade controls,
16 unchanged negative typing assertions and six own-property controls. All 144
built files stayed unchanged through consumer verification. Kernel tarball SHA-256:
`22e584aeeed0830fc5a217c6ba189966debba0164a74e8d063d58b7ccd9b14a0`.
Evidence: `/private/tmp/main-audit-catalogue-final/` and
`/private/tmp/catalogue-final-consumer/result.json`.

Mutation accounting has subsequently reached 17 killed production-source
variants covering 15 IDs. M18 survived its isolated publication mutation;
M19's notification-only failure is not counted as its required state-corruption
kill. The frozen semantic failures remain unresolved. This checkpoint is not
release qualification, and no publication is authorized.
