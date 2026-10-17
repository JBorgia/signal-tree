# B placement repair results

Baseline: `7673f489f36d7be7f2d61e6fc4843ace0e5c48dd` on
`codex/native-ownership-slice`. The commit containing this record is the local
repair checkpoint. B remains rejected for integration.

## Narrow disposition

The approved placement defect is repaired: an independently unavailable successor
is distinguished from a proven same-settlement successor chain ending at the tail.
The former permits the specified lifetime-sensitive predecessor fallback. The
latter remains a valid tail placement. Fallback uses the predecessor's current
successor, or its resolved target placement when restored in the same settlement.
A complete prepared order also proves its final tail; a historical tail observation
does not. Neither key reuse nor missing original anchors invents a placement.

Resolution precedes native installation. Missing proof, malformed retained facts,
read errors and cycles still throw; no broad catch suppresses traversal errors.
The existing final dependency ranking validates the resolved graph. This change
adds no collection enumeration, API, activation, reclamation or ordering-authority
cleanup. It does not establish sparse settlement for B as a whole.

## Preserved failures and results

- Baseline, unchanged 20 policy instances plus four new controls: **19 pass,
  5 fail**. The original two B successor failures remain recorded. Additional
  failures: historical-tail restoration produced A,Z,B instead of A,B,Z; loss of
  the sole predecessor failed to refuse; same-target predecessor restoration
  produced Z,B,A instead of Z,A,B.
- First repair: **23 pass, 1 fail**. The existing several-temporary-anchor case
  exposed conflation of a complete prepared-order tail with a historical tail.
  Its source and first red log are preserved. Recognizing the existing
  `orderChanged` prepared-order proof corrected it without changing assertions.
- Final placement set: **24 pass**. Includes atomic refusal, lifetime replacement,
  exact internal-error cause, mixed-state preservation and useful retry.
- Nine focused regression files: **81 pass, 2 fail**. Remaining failures are the
  unchanged unresolved creator-payload premise and stale terminal ordering
  responsibility. They remain failures, not expected-failure conversions.
- Original rekey/order replay: **4 pass**.
- Independent incumbent counterparts for the three new placement cases:
  **3 pass**. These establish compatibility for these added cases.
- Spec-types ratchet: passes, **six existing diagnostics remain**. First run
  caught a test `.cause` typing error (and two in a temporary reviewer probe).
  A property matcher preserves the exact-cause assertion; the temporary probe
  was removed. No type baseline changed.
- Kernel lint: **zero errors, 15 warnings**, recorded in `lint-final.log`. The first attempt hit
  ENOENT when the original replay removed its temporary fixture during lint;
  it was an execution race. The next run found one new empty-function test
  initializer, corrected with its cleanup rationale. The 15 warnings are in
  three source files byte-identical to baseline.

Eight pre-existing policy/dependency/replay sources were verified against their
pre-edit SHA-256 manifest. No earlier assertion was changed. No full suite,
framework campaign, artifact build or performance comparison was repeated.
There was no approval-review rejection this turn.

## Independent review and limits

An independent premise/implementation reviewer executed the three incumbent
counterparts and inspected the final resolver. No bounded blocker was reported.
Root inspection confirmed the tagged unavailable result, prepared-tail distinction,
pre-install graph resolution and error propagation. A proposed cycle-injection
probe did not reach its intended branch because preparation replaced the anchor;
its failed expectation is preserved as a non-reaching probe, not a runtime defect
or a passing cycle test. Cycle protection is source-reviewed here, not newly
execution-proven. The read-fault and retry control does execute.

This closes placement only. Stale ordering authority, unresolved payload semantics,
quadratic admission, other qualification failures and CPU/bundle penalties remain
open. Reclamation is unchanged and has separate outstanding evidence; retained
recovery obligations must not be confused with obsolete records.

## Replay

Use Node 24.15.0 and pinned pnpm 10.17.0, from this checkout:

```sh
export NX_DAEMON=false
pnpm nx test kernel --testFile=src/lib/successor-placement-policy.spec.ts --testFile=src/lib/b-placement-resolution.spec.ts --skip-nx-cache
pnpm nx test kernel --testFile=src/lib/successor-placement-policy.spec.ts --testFile=src/lib/b-placement-resolution.spec.ts --testFile=src/enhancers/restoration/restoration-missing-anchors.spec.ts --testFile=src/lib/b-authored-topology-repair.spec.ts --testFile=src/lib/b-topology-dependencies.spec.ts --testFile=src/lib/b-dependency-lifecycle-audit.spec.ts --testFile=src/lib/b-operation-admission.spec.ts --testFile=src/lib/b-operation-admission-review.spec.ts --testFile=src/lib/b-operation-admission-terminal.spec.ts --skip-nx-cache
bash docs/research/b-native-integration/qualification/replay-counterexample.sh
node tools/check-spec-types.mjs
pnpm nx lint kernel --skip-nx-cache
```

Run the temporary-fixture replay separately from lint. The nine-file command is
expected to retain the two documented failures. Local execution prepended
`/private/tmp/st-b-qualification-20261016/bin` and
`/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin` to PATH.

Raw logs, first candidate sources, baseline sources and manifests are retained at
`/private/tmp/st-placement-repair/`; see `EVIDENCE.md` for the archive seal.
