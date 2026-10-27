# Test-only baseline and disposition

## Exact identities

- Frozen runtime: `2dacae7b9e9137018d05c4e00382ac9287bc76d4`.
- Test-only checkout/commit: `/private/tmp/link-membership-successor-contract`,
  `2d24966cc457529f876b06d950dd181acb5bfb69`.
- The commit adds exactly three specification test files; no runtime, existing
  assertion, configuration, package or budget change. Frozen checkout stays clean.
- Governing policy selection: readiness `75c645eb71e4a03e5c84491ce8078debfe797e19`.
- Production remains `87f6831fa60cafe87508f0ace84b7638698ca3b0`.
- Node24.15.0, Corepack pnpm10.17.0; Nx daemon/plugin isolation disabled and cache
  skipped. Tests use existing dependency installation; no fresh package build.

## Results, not qualification

| Run | Ordinary passing | Ordinary failing | Meaning |
| --- | ---: | ---: | --- |
| FIRST | 40 | 33 | Original membership54 + window17 + unchanged omission2. Includes3 confounded reactivation oracles; not33 independent defects. |
| REVISED | 46 | 35 | Corrected membership + window19 + separate6 + omission2. Two new propagation tests still assumed an unqualified cross-scalar handoff. |
| PREPOLICY | 46 | 35 | Same-leaf propagation, before the ordinary sibling possible-window oracle alignment. |
| FINAL | 28 | 53 | Exact final81-case baseline at test commit2d24966c, including approved possible-window receipt classification. |

No expected failures or skips in these81 tests. Final failure groups:

- Membership54:18 pass/36 fail. Independent declarations send0 prematurely through
  branch, root and updateAndReport supplied inputs, across all six observations.
  The other18 fail the required conservative/unknown receipt: the rejected runtime
  reports held/pending-dependency despite the undeclared sibling origin. Their
  later useful-send assertions do not execute. Dormant-payload exclusion, primed
  support and corrected retained-member controls pass within their tested scope.
- Window19:6 pass/13 fail. The rejected runtime sends undeclared values before
  captured-owner settlement. Early assertions prevent later liveness assertions
  from executing in those cases. The tests therefore preregister, but do not yet
  establish, late-owner exclusion and useful drain. No test result claims otherwise.
- Separate6:3 pass/3 fail. In-flight mixed undo sends an older row image after
  callback-authored777; registration coexistence and prep-reentry stop at the
  known exclusive registration error before their downstream assertions execute.
- Original isolated omission2:1 pass/1 fail, byte-identical to the frozen baseline.

The first failure logs and sources remain verbatim. Fixture corrections are in
FIXTURE-CORRECTIONS.md; they do not reclassify inherited runtime failures. Final
spec-types ratchet passes with existing diagnostics retained (not clean global
spec typing). FIRST source typecheck passed; runtime/types did not change afterward.
Original six new Object.hasOwn fixture diagnostics are preserved and corrected
without changing compiler settings. Nx prints an existing archived-tsconfig
missing-extends diagnostic, but executes and reports all requested tests; this
is not an unexecuted-run or approval-review rejection.

## Independent review and verified disposition

REVIEW-FIRST and REVIEW retain the initial concerns and dispositions. The reviewer
read source, approved premises and raw evidence, and did not run tests or edit
runtime. Parent independently checked the equal-sibling admission guard, scalar
input unit distinction, existing conservative/unknown receipt mapping, raw final
results and hashes. The final reviewed SPEC and all three test hashes match this
packet. Review found no unresolved contract/oracle blocker to requesting one bounded
implementation, under the named gates and recurrence stop.

This is a reviewed specification and falsifier packet, not a surviving runtime
candidate. Remaining entity supplied-input, cache/P-O correspondence, earlier
installed sibling windows, preparation faults, native invalidation reentry,
retirement and cost obligations are listed explicitly in TESTS and SPEC. The new
possible-owner mechanism has not been implemented. No broad suites, frameworks,
new artifacts, heap campaign or CPU benchmarks were run here.

The next action requires owner authorization for one bounded implementation of
this exact contract. It does not authorize a new API, integration, activation,
release, budget increase, merge, push or publication. B stays closed.
