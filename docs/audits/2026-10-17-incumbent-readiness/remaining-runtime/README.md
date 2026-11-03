# Remaining incumbent runtime work — October 19, 2026

Starting checkout: `d832058c120f560bfb995fc55de3fd43d99d40ed`, on
`codex/v16-incumbent-readiness`. Original incumbent baseline remains `8d220643`.
Reviewed runtime checkpoint: `87f6831fa60cafe87508f0ace84b7638698ca3b0`.
B remains closed. This work does not establish release readiness.

## Disposition

The restoration corrections survive focused review and broader affected checks.
Independent Link progression remains a supported-contract blocker. The attempted
location-disjoint admission is **rejected**: copied pending values can reach a
nominally disjoint field without recorded dependency provenance. Its exact local
checkpoint is `927ee0d8`; `e9653a41` reverts that experiment and restores the safe
gate. No original Link assertion was migrated or weakened.

The next Link prerequisite is a bounded design for consequence dependency
provenance through reactive writes. Existing transaction ownership, diagnostic
write scopes and computed freshness are not that evidence. Retaining the safe
gate prevents the demonstrated leak but leaves independent progress unmet.
Declaring all reactive work independent is unsafe; assigning it transaction
ownership changes a different contract. A new public dependency-declaration API
is not authorized. No such architecture was implemented in this turn.

## Restoration corrections and failures retained

- Complete-turn order capture composes recorded structural prefixes/suffixes with
  explicit reorders, retaining frontier validation. Admission keeps touched facts;
  explicit order materializes at drain. No growing-prefix dependency copying.
- Review found an ordinary `removeMany([A,C,B])` then reorder counterexample.
  Per-frame indexed placement dependencies replace inverse caller-order replay.
  The first failure and original source are retained.
- Capture prepares both authored and historical channels before retiring either.
  This is not universal post-install allocation recovery; one-shot staging and
  later entry-allocation failure recovery are not established.
- A permanent committed-field observer caused twelve new lifecycle failures.
  Structural boundary observation is now separate: ordinary field frames do not
  enable it, and destruction releases it.
- Restoration-origin order replay no longer creates fresh historical events.
  Explicit application-authored reentry still records and usefully undoes. The
  test explicitly resets inherited write metadata; it does not prove ordinary
  callbacks automatically clear restoration context. The
  test explicitly resets inherited write metadata; it does not prove ordinary
  callbacks automatically clear restoration context.
- Point compensation now uses the existing membership-delivery hold across all
  installation, frontier restoration and publication, including error paths.

The first full kernel run had **72 failures / 5,763 ordinary passes / five
expected failures / 12 skips**. Exact `d832058c` replay of the five failure groups
proved **60 failures already present**: 56 membership-publication failures and
four detached-history frontier failures. Only twelve observer-lifetime failures
were introduced by this turn. All three groups are corrected under unchanged
assertions. The six original R1/R2 desired assertions are unchanged; obsolete
refusal characterizations were archived and removed under their explicit
remove-when-fixed instructions.

## Verification and limits

Combined runtime full kernel: **5,837 ordinary passes, five expected failures,
12 skips**. The stronger historical semantic matrix remains unfulfilled; it is
not replaced by this suite result. Four frameworks: Angular **240 passes / three
skips**, React **77 passes**, Vue **175 passes**, Solid **107 passes**.

Source types and ordinary spec-types pass without baseline updates. An invalid
`origin: 'application'` in a new fixture was corrected to the established absent
origin; its original failure is retained and 24 affected tests rerun. React's
existing new-key fixture required explicit narrowing after the approved
unknown-access migration; every behavior assertion remains. Its initial compiler
failures, correction, final complete suite and independent review are retained.
These test-only corrections do not alter the full-kernel runtime input.

Fresh five-package and production demo builds pass. Unchanged bare budgets pass;
**entity production and development budgets fail** (gate's rounded KB displays:
26.27 / 26.16 and 29.05 / 28.98). Demo initial output is 568.56 kB and reports its
existing warning threshold of 525 kB. No ceilings changed and no cost acceptance
is inferred. No new CPU, heap or equivalence claim is made.

The complete release registry, mutation proofs, installed consumers and browser
release checks are **not executed for a final release candidate**: independent
Link progress and artifact acceptance remain unresolved. Package/demo hashes
identify measured bytes, not a release. No push, merge, activation, tag or
publication occurred. Unrelated user guidance/measurement edits remain separate.

## Evidence and replay

[Final combined review](COMBINED-REVIEW.md),
[Link review](link-admission-rejected/REVIEW.md),
[restoration review](restoration-order/REVIEW.md), and
[qualification map](QUALIFICATION-REVIEW.md) retain superseded findings and final
qualifications. Each archive has an SHA-256 manifest. Archives include raw first
failures, exact sources, scripts, commands and reviewer reports; generated probe
bundles are rebuilt by their scripts. `artifact-hashes.json` identifies fresh
package/demo output. `verification.tar.xz` contains root verification logs and
source receipt. Historical scripts retain executed absolute paths; relocate
those explicitly for a disposable replay checkout.

Use Node 24.15.0, pnpm 10.17.0 and `NX_DAEMON=false`:

```sh
pnpm nx test kernel --skip-nx-cache
pnpm nx run-many -t test --projects=angular,react,vue,solid --parallel=1 --skip-nx-cache
pnpm run typecheck
node tools/check-spec-types.mjs
pnpm run build:all --skip-nx-cache
node tools/check-bundle-budget.mjs
pnpm run build:demo:prod
```

At rejected checkpoint `927ee0d8`, the decisive unchanged falsifier is:

```sh
pnpm nx test kernel --testFile=src/lib/link-reactive-settlement.spec.ts --testNamePattern='hops of a write authored inside a pending transaction' --skip-nx-cache
```

Root independently reproduced all four selected failures. All-Link inventory at
that candidate was 318 passes / 18 failures: eight reactive leaks plus ten
unmigrated global-gate expectations. Frozen N replay stays **six held / four
violated / two unsupported**. The four later assertions require silence after
rollback; baseline and candidate both send restored zero, never rejected one.
The candidate alone delivers independent y before x settles. This narrower gain
does not excuse the separate reactive leaks or change the frozen verdicts.
