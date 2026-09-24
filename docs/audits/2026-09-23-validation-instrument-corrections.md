# Validation instrument corrections — September 23, 2026

Scope: the validation findings in the local audit at
`/private/tmp/signaltree-audit-7ade0e3e/AUDIT.md`, against source
`7ade0e3ecb25ff0d06da4355b5f7d67844e147b7`. This correction preserves the
historical observations; it does not turn instrumentation repair into a library
correctness verdict. No frozen law or research case was added or revised.

## Original 13-case evidence and corrected interpretation

The original report (`semantics-report.txt` beside that audit) said **7 held,
6 violated, 13 total**, and listed L3/L4/L5/L9/L11 as violated. Its successful
process exit certified only a nonempty result array. Even all thirteen candidate
constructors throwing satisfied that assertion.

| Case                                | Original reported result             | Corrected adapter result | Evidence limit / correction                                                                                                                                                     |
| ----------------------------------- | ------------------------------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 reject one pending writer       | held                                 | held                     | Measured scalar reversal only.                                                                                                                                                  |
| S03 reject older writer             | violated: y=0 instead of 2           | violated: same           | Newer pending value lost.                                                                                                                                                       |
| S04 reject middle of three          | violated: y=1 instead of 3           | violated: same           | Newest pending value lost.                                                                                                                                                      |
| S05 reject oldest then accept newer | violated: y=0 instead of 2           | violated: same           | Accepted contribution lost a field.                                                                                                                                             |
| S07 reject newest                   | held                                 | held                     | Older scalar value survives in this ordering.                                                                                                                                   |
| S11 reject both                     | violated: y=1 instead of 0           | violated: same           | Rejected value remains.                                                                                                                                                         |
| S10 accept newer then older         | held                                 | held                     | Measured scalar authorship order only.                                                                                                                                          |
| A1 unrelated snapshot               | violated: visible y=2 instead of 1   | unsupported              | No native canonical/pending split; adapter-maintained canonical state invalidated the original contract measurement. The historical visible-value observation remains recorded. |
| A2 correlated accept                | violated: contribution still pending | unsupported              | No native correlated-authority input; ignoring the relation was not an implementation of that input.                                                                            |
| A5 fresh snapshot without relation  | held                                 | held                     | Pending authority now checked against this handle's actual pending ID, not any pending turn on the tree.                                                                        |
| A6 stale revision                   | held                                 | unsupported              | Original adapter filtered revisions itself. This was never evidence that the kernel enforces revision ordering.                                                                 |
| F06 reject twice                    | held                                 | violated                 | Original wrapper intercepted the second call. Native rollback returns successfully again; the frozen case calls that a fresh successful settlement.                             |
| F07 reject then accept              | held                                 | held                     | Original wrapper also intercepted this call. The corrected adapter invokes native confirm, which refuses; the measured value stays rejected.                                    |

Corrected run: **5 held, 5 violated, 3 unsupported, 0 execution errors, 13 total**.
A held case is not proof of an entire law, the missing L1–L18 matrix, or release
readiness. In particular F06/F07 still do not cover failed-compensation liveness.
Predictions and historical research documents remain unchanged.

## Instrument behavior

- The adapter keeps no canonical truth, revision frontier or settled flag.
  Every accept/reject reaches the native handle, including repeated calls.
- For these synchronous scalar cases, a contribution is associated with the
  single actual pending ID added by its invocation. Ambiguous or absent IDs are
  unsupported. Ambient transaction IDs use a different sequence and are not
  substituted for pending IDs. Missing pending authority does not identify a
  terminal disposition; the adapter reports that limitation explicitly.
- Canonical reads, version ordering, correlated settlement and visible
  observation are unsupported. Observation no longer returns a no-op disposer.
  No observation case exists in this 13-case subset, so it proves no observation
  law. No new production API was introduced.
- Results distinguish held, violated, unsupported and execution error. Missing
  semantics cannot count as held. Construction, operation and teardown failures
  reject the runner with the complete per-case results; even a constructor that
  throws the unsupported marker is an execution failure.
- Every successfully constructed fixture is destroyed in the runner, including
  early semantic violations and unsupported outcomes. Instrument regressions
  live beside the report test, outside the unchanged thirteen research cases.

## Compiler and publication safeguards

The spec-type checker now invokes installed TypeScript directly, preserves exit
status/signals/spawn errors, and rejects global/configuration diagnostics,
unrecognized failures and incomplete execution. Infrastructure failures cannot
rewrite the baseline under `--update` or claim improvements. Located source
errors remain subject to the existing per-file ratchet; TS6133 is not mistaken
for infrastructure merely because its code starts with 6.

Publisher history (`109595e6`) intended tagged CI as the sole registry path, but
its authenticated local and prebuilt paths bypassed that provenance. Live calls
now require the sanctioned workflow, explicit matching version tag/HEAD, clean
tracked and untracked source, release gates and release mutation checks, then a
fresh uncached build after removing the release packages' old dist directories.
Source identity is checked again before registry operations. Dry-run/preparation
remain available locally, including prebuilt inputs; neither is publication
proof. Failed installed-consumer validation leaves the candidate `validating`,
not `validated`. Tests intercept every publisher subprocess in disposable
fixtures; they never contact a registry.

Both release and publish workflows now select `--release` for mutation execution.
The existing publish-architecture gate detects missing or narrowed coverage and
runs the publisher regression suite. Mutation coverage was checked statically;
**no mutation matrix was run while other workers edited this checkout**. Future
live CI must execute it, and a failure remains blocking.

`docs/README.md` now states workspace version and the release hold explicitly.
The version-claims gate and version-preparation helper no longer turn a manifest
version into a publication claim. The unpublished advisory withdraws “fixed in
15.2.2”, limits affected-artifact evidence to the four recorded exact versions,
and distinguishes the first thrown rollback from its misleading successful
retry. It makes no general safety claim for applications without transactions.

## Verification and remaining work

Focused commands (no publication, commits, remote writes or shared mutations):

```sh
node scripts/check-publish-candidate.mjs
node --test tools/check-spec-types-selftest.mjs
node tools/check-spec-types.mjs --self-test
node scripts/verify-version-claims.js --self-test
node scripts/verify-version-claims.js
node scripts/release-version.mjs --self-test
node scripts/verify-publish-architecture.mjs
node tools/verify-gates.mjs --only=spec-types,spec-types:hygiene,version-claims,publish-architecture,publish-authorization,release-prerelease-metadata
NX_DAEMON=false NX_TUI=false SEMANTICS_REPORT=/private/tmp/signaltree-semantics-corrected.txt pnpm nx test kernel --testFile=semantics-current.spec.ts --skip-nx-cache
```

Publisher regressions: 23 passed. Compiler regressions: 15 passed. Focused
research/instrument tests: 9 passed; this green test result certifies execution
and classification, not semantic conformance. Focused ESLint checks passed.

The first six-gate run returned 5/6: concurrent workers' new spec typing errors
were correctly rejected. They were reported, not rebaselined or edited by this
slice. The latest repeated run was also 5/6, with five remaining diagnostics in
`packages/kernel/src/lib/audit-entity-boundaries.spec.ts` (three) and
`packages/kernel/src/lib/audit-observation-lifecycle.spec.ts` (two). Neither
research file in this slice had a remaining diagnostic. Full
release/build/browser and mutation matrices were not run here.

Unresolved: implementation of missing semantics and the remaining frozen matrix;
actual library correctness defects; affected advisory range and verified fix
version; advisory publication and release authorization. Operator environment
checks are workflow safeguards, not a security boundary against someone able to
edit the publisher or forge its process environment. Tag protection, credentials
and GitHub's attestation trust remain external controls. None were changed.

Initial read-only serialization inventory (before removal was authorized): ESLint reported no unused imports in
`serialization.ts`; an AST identifier scan likewise found no import local with
zero references. This is not a workspace-wide dead-API audit and does not prove
all serialization code is needed. Production serialization was not edited at that stage; the authorized removal is recorded below.

## Current serializer removal: bounded pre-deletion coverage inventory

Pre-deletion inventory, retained as the reasoning record. At that stage no
serializer implementation, dependent test, gate anchor or public barrel had
been edited. The later authorized disposition follows below. The sole external non-test
source reference found is the empty type re-export at `packages/kernel/src/index.ts:278`.
The directory's own `index.ts` also re-exports its implementation/constants;
it is not a public package entry point. No serialization export/subpath appears
in the kernel package manifest or adapter barrel. Tests still import the
implementation directly, so lack of a public export does not make wholesale
test deletion safe. Packed-artifact absence has not been freshly verified.

| Gate / validation owner                                                      | Dependent evidence                                                                                                                                                 | Coverage required before deletion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `retention-gc`                                                               | `a2-5-lifetime.spec.ts`; explicit inclusion in `vitest.retention.config.ts`, exclusion in ordinary `vitest.config.ts`, mutation anchor in `tools/verify-gates.mjs` | Replace the live-send control, cancellation of armed work at the surviving ownership boundary, and discriminating payload GC controls (unowned / retained by live owner / released at teardown). Use the surviving Link/owner contract, not obsolete polling machinery. Existing `production-link-conformance-0` and `link-persistence-conformance` cover behavioral disposal, but no equivalent Link payload `WeakRef` GC test was found. Rebind the mutation to the replacement; retain the unrelated diagnostic-journal and derived-recipe GC suites.    |
| `test:all` — durable consequences                                            | `persistence-commit-boundary-carrier`, `persistence-commit-ordering`, `a2-4-1-drain-settlement`, `a2-3-1-rollback-cancellation`, `a2-persistence-discriminators`   | Map each shared row to Link/commit-consequence tests: held publication, no speculative sends on reject/throw, coherent confirmed values, out-of-order settlement, foreign-owner isolation, drain timing and lifecycle. Existing `link-persistence-conformance`, `production-link-conformance-0` and `internals/commit-consequence` are partial destination coverage, not proof of row-for-row replacement.                                                                                                                                                  |
| `test:all` — external truth and egress                                       | `persistence-as-link-swap-0`, `serialization-egress-disposition`, `per0-restore-semantics`, `a2-2-tree-scoped-rehydration`, restoration `documented-defects` 6c    | Retain inspection exclusion/no hitchhiking, realized external authority including equal-value acquisition, no echo, external truth surviving compensation and exclusion from authored undo, canonical collection publication and owner isolation. `link-root-source` already has inspection, realized-write, owner and collection rows; do not infer that it covers every composition row. Keep unrelated 6b/6d restoration tests.                                                                                                                          |
| `test:all` — materialization / consumer transfer                             | `marker-location-grammar`, `walker-conformance`, `m4-decline-uniformity`, `legacy-payload`, `marker-serialization`, Angular `ssr-transfer`                         | Preserve marker payload opacity (including actual endpoint output), deep callable traversal, entity value reconstruction and two-tree transfer through surviving public read/write APIs with an application-owned codec where needed. `rehydration`, `rehydrate-ownership`, `kernel-snapshot-authority` and canonical-snapshot tests provide partial independent coverage. Special-type wire encoding, old envelopes and codec-specific compatibility are retired-feature evidence; they do not define a new codec API. Keep unrelated rows in mixed files. |
| `typecheck`, `spec-types`, `spec-types:hygiene`, `lint:budget`               | `enhancer-chain.typing.spec.ts`, serializer/persistence contract typing files, `enhancer-safety.spec.ts`; type-only `StorageAdapter` imports                       | Preserve enhancer accumulation/order, composite additions, unchanged state typing and metadata law coverage using surviving enhancers or minimal test fixtures. Remove only obsolete method assertions and serializer metadata rows. `enhancer-metadata-authority` uses generic fixture capability strings, not the serializer: keep it. No serializer entry exists in the current spec-type baseline, so removal requires no blanket rebaseline.                                                                                                           |
| Build / `built-barrels`, `exports-importable`, API and packed-consumer gates | Empty root type re-export, internal directory barrel, stale generated artifacts                                                                                    | After the tests migrate, remove the empty edge and obsolete implementation files, rebuild cleanly and verify the public root/adapter declarations and actual tarballs. Source reachability alone does not prove stale serializer modules are absent from a packed artifact. No public API replacement is implied.                                                                                                                                                                                                                                           |

Two specific traps remain open:

1. `persistence-commit-ordering.spec.ts`'s two refused-rollback cases require only
   that some later write reaches storage. They neither inspect that payload for
   speculative values nor establish intact pending authority; this is the same
   boundary the audit found unsafe. Do not promote those assertions unchanged
   as the replacement safety contract. Preserve the historical failure evidence
   and require both publication safety and an explicit recovery/ownership rule.
2. `heterogeneous-atomicity.spec.ts` imports only the obsolete `StorageAdapter`
   type and constructs an adapter that is never attached. Its actual
   scalar/structural state and observer tests are independent and must survive.
   Empty recorded-write assertions are not durability proof. Retire the dead
   adapter fixture rather than deleting the whole suite or calling its empty
   write history replacement coverage.

`serialization.spec.ts`, `constants.spec.ts`, codec roundtrip tests and purely
retired save/load/configuration rows can be classified for deletion with their
subject; mixed files must be split by invariant first. This inventory does not
resolve security obligations for already published legacy artifacts.

The all-issue remediation ledger now lists **incomplete executable constitution**
separately from adapter honesty: thirteen cases are still not the full L1–L18
matrix, and M01–M30 mutation closure remains absent. Neither adapter repair nor
serializer retirement closes that work.

## Authorized dead serializer removal

The unexported `packages/kernel/src/enhancers/serialization/` implementation and
its obsolete tests were removed, together with the empty kernel type re-export.
Original source and assertions remain in git at
`7ade0e3ecb25ff0d06da4355b5f7d67844e147b7`; no archive copy of the vulnerable
implementation and no legacy v14 security patch was added to current source.
No production Link code was changed by this slice.

| Retired evidence                        | Surviving carrier / disposition                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A2-5 lifetime                           | `lib/link-lifetime.spec.ts`: live-send control, cancel armed publication on dispose, unowned/live/disposed payload GC. The retention config keeps the independent diagnostic-journal and derived-location suites. Only `retention-gc`'s anchor and description changed in the gate registry.                                                                                 |
| persistence-as-link-swap P1–P9          | `lib/link-authority-carrier.spec.ts`: retained authored publication, inspection/no hitchhike, equal-value acquisition, external authority, no echo, collection rows, owner isolation and disposal assertions. P5b remains explicitly non-discriminating; it is not classification proof.                                                                                     |
| persistence-commit-boundary-carrier     | `lib/link-commit-boundary-carrier.spec.ts`: all five cases, including positive control, confirm, supersession, throw, out-of-order overlapping settlement and foreign-owner isolation.                                                                                                                                                                                       |
| persistence-commit-ordering             | `lib/link-commit-ordering.spec.ts`: all seven cases. The two refusal cases incorporate Main's strengthened assertions from `/private/tmp/v15-transaction-safety.patch`: refusal plus unrelated write sends nothing; successful retry or explicit confirm releases publication. The obsolete file's patch was not applied. Effect-validation refusal now must actually throw. |
| A2-4.1 drain                            | `lib/link-drain-settlement.spec.ts`: positive application-endpoint drain control plus no speculative value while pending or after rollback. The endpoint drains only values received by `set`; it cannot force admission or read current tree state.                                                                                                                         |
| serialization-egress-disposition SER1–4 | `lib/link-snapshot-egress.spec.ts`: six cases retaining observable inspection, no authoritative inspection egress, read does not publish, external/realized classification and no hitchhike. Public retrieve and subscribe replace the retired inbound spellings.                                                                                                            |
| marker-serialization / roundtrip        | `lib/link-value-roundtrip.spec.ts`: special materialized values (Date, Map, Set, BigInt, RegExp, nested Date) and entity count/by-ID/value assertions; `walker-conformance` retains deep acquisition assertions. Codec-specific envelopes, malformed references, compatibility and wire encoding retire with the codec. No public JSON codec is invented.                    |
| per0 restore/scoping probes             | Diagnostic `expect(true)` and codec scoping probes retire. Real acquired-value/rollback behavior remains in P5b, classification in A2-2/SER3, no authored undo in restoration `documented-defects` 6c. The old logs were never executable law coverage.                                                                                                                      |
| a2-persistence-discriminators           | Rollback safety and drain control survive above. Optional internal flush, save-call counts and whole-tree codec-policy probes retire with their implementation. Bare tree/Link fixtures prove no storage platform is required.                                                                                                                                               |
| Direct-import mixed tests               | A2-2, A2-3.1, marker-location-grammar, walker-conformance, m4-decline-uniformity, legacy-payload, restoration documented-defects 6c and Angular ssr-transfer use public Link and application-owned JSON where needed. Independent cases/assertions remain.                                                                                                                   |
| heterogeneous-atomicity                 | All four scalar/structural state, revision and observer cases remain. The previously unattached storage fixture is replaced by real scalar, collection and theme Links; rejected `doomed` publication is checked after settlement.                                                                                                                                           |
| enhancer typing / safety                | `enhancer-chain.typing.spec.ts` retains accumulation/order and adds generic composite halves, unchanged precise state and negative controls. Existing enhancer-metadata authority tests remain. Only the obsolete serializer metadata row and serializer-only method/config tests retire.                                                                                    |

### Proven boundary and explicit gaps

- P2c now checks that waiting for `Link.settled()` does not publish inspection.
  It does **not** claim to preserve an explicit `save()` operation: Link has no
  such public method. Similarly, the test endpoint drain is application policy,
  not a replacement production drain API.
- Public Link types reject root/branch sources containing EntityMap construction
  markers (`TruthfulLinkSource`); direct collection sources compile and are used
  here. Collection rows and scalar endpoints do not prove typed whole-root
  heterogeneous acquisition/publication. No cast-to-never bypass was added to
  claim that missing coverage.
- GC proves payload release after relationship disposal plus tree destruction,
  and retention by a deliberately live relationship. It does not prove that
  `tree.destroy()` automatically disposes independently held Links.
- Type-preserving JSON wire encoding and legacy malformed-ref defenses are not
  surviving APIs. Materialized-value tests do not claim those codec properties.
- Legacy published artifacts and advisory affected/fixed ranges remain separate
  security work. The incomplete executable constitution also remains open.
- Out-of-scope inventory/generator strings still name the deleted feature in
  `tools/package-generation-census.mjs`, `tools/package-namespace-closure.mjs`,
  `tools/gen-kernel-ownership-ledger.mjs`, `tools/bare-module-list.mjs` and
  `tools/bare-module-identity-control.mjs`. They were not silently rewritten or
  counted as validated by this bounded removal.

### Removal validation

Before deletion, the focused migrated kernel suites passed **73/73**. A scoped
red fixture copied only the new lifetime test and removed the disposal anchor:
**one failed / four passed**, specifically the disposed payload's WeakRef stayed
alive. Restoring disposal gave **five passed**. The red log is
`/private/tmp/signaltree-link-lifetime-red.log`; temporary test/config copies were
removed. No production mutation or full mutation matrix ran.

After deletion and formatting, the Nx focused kernel run passed **73/73** across
15 files; Angular ssr-transfer passed **3/3**; the complete retention configuration
passed **10/10** across three files. Compile-only typing assertions and focused
ESLint passed. No spec-type baseline was changed. The normal spec ratchet failed
on other workers' new transaction/proposal test diagnostics, not these migrated
files; that remains a failure, not a release pass.

Exact commands and local logs:

```sh
NX_DAEMON=false NX_TUI=false pnpm nx test kernel --testFile=link-authority-carrier.spec.ts --testFile=link-commit-boundary-carrier.spec.ts --testFile=link-commit-ordering.spec.ts --testFile=link-snapshot-egress.spec.ts --testFile=link-drain-settlement.spec.ts --testFile=link-value-roundtrip.spec.ts --testFile=heterogeneous-atomicity.spec.ts --testFile=a2-2-tree-scoped-rehydration.spec.ts --testFile=a2-3-1-rollback-cancellation.spec.ts --testFile=legacy-payload.spec.ts --testFile=marker-location-grammar.spec.ts --testFile=walker-conformance.spec.ts --testFile=m4-decline-uniformity.spec.ts --testFile=documented-defects.spec.ts --testFile=enhancer-safety.spec.ts --skip-nx-cache
NODE_OPTIONS=--expose-gc pnpm exec vitest run --root packages/kernel --config vitest.retention.config.ts
pnpm exec vitest run --root packages/angular src/lib/ssr-transfer.spec.ts
pnpm run typecheck:typing
node tools/check-spec-types.mjs
xargs pnpm exec eslint < /private/tmp/serializer-owned-files.txt
NX_DAEMON=false NX_TUI=false pnpm run build:all --skip-nx-cache
```

Logs: `/private/tmp/signaltree-serializer-focused-final.log`,
`signaltree-serializer-angular.log`, `signaltree-serializer-gc.log`,
`signaltree-serializer-typing.log`, `signaltree-serializer-types-final.log`,
`signaltree-serializer-lint-final.log`, `signaltree-serializer-build.log` in the
same temporary directory. The initial sandboxed build stalled; only its inspected process IDs were stopped.
The retry used `NX_DAEMON=false NX_TUI=false NX_ISOLATE_PLUGINS=false pnpm run
build:all --skip-nx-cache` and completed all five projects, but emitted three
transaction TypeScript diagnostics. Concurrent `link.ts` and `source-mutation.ts`
changed during that retry (input hashes recorded in
`/private/tmp/signaltree-serializer-build-retry-inputs.json`). Therefore this is
**not a clean or stable-source authoritative build pass**. Build retry log:
`/private/tmp/signaltree-serializer-build-retry.log`.

The completed output contains root/adapter JavaScript and declarations and no
`enhancers/serialization` files. A local-only pack also verified the absence:

```sh
pnpm --dir dist/packages/kernel pack --pack-destination /private/tmp/signaltree-serializer-packed
```

The 89-member local kernel tarball contains both root/adapter entry pairs and no
serializer modules. This proves artifact absence in that build, not consumer
correctness or a releasable candidate. No registry operation or install occurred.

The final six selected validation gates were **5/6**: version claims, spec hygiene,
publish architecture, publish authorization and prerelease metadata passed;
spec-types failed. During a subsequent compiler check, transaction implementation
diagnostics had cleared, while concurrent test/Link work still produced 19
errors across `transaction-safety.spec.ts`, `link-structured-address-audit.spec.ts`,
`link.ts`, and `path-notifier-queued-witness.spec.ts`. Exact diagnostics are in
`/private/tmp/signaltree-serializer-current-types.log`; no errors were reported in
this slice's migrated tests. These snapshots must not be used as current-worker
completion claims. Repeat authoritative focused tests/types/build after shared
production edits settle; no repeated mutation execution was attempted.

The original 13-case evidence and first corrected-adapter measurements above are
historical run results, not a claim about later concurrent transaction changes.

### Latest adapter rerun during concurrent remediation

After Main's transaction changes, the same unchanged thirteen cases reported
**9 held, 1 violated (F06), 3 unsupported (A1, A2, A6), 0 execution errors**.
S03/S04/S05/S11 now hold in that run. This does not rewrite the original table or
attribute Main's implementation fixes to adapter honesty. The incomplete
constitution remains open. All nine instrument/report tests passed.

The repeat-settlement instrument regression now compares every result with an
independent native handle, rather than pinning successful repeat rollback as a
requirement. It continues to expose that behavior in F06 when the native handle
has it. No frozen case, production API, canonical cache, revision filter or
settled-state wrapper was added.

```sh
NX_DAEMON=false NX_TUI=false SEMANTICS_REPORT=/private/tmp/signaltree-semantics-latest.txt pnpm nx test kernel --testFile=semantics-current.spec.ts --skip-nx-cache
```

Logs: `/private/tmp/signaltree-semantics-latest.txt` and
`/private/tmp/signaltree-semantics-latest-test.log`.
