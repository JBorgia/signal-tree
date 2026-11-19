# C27 four-probe execution

Result: **4/4 passed on first Nx invocation; unchanged spec-type gate passed on first invocation.** No runtime, fixture, assertion, config, or ratchet corrections. No retry.

Exact disposable source: `execution/c27-copy`, reconstructed from all 3086 files in C27 manifest `bc4c2447f4deeec12bc4ef05ed61392da3ceabb087e55e01d543adae82376ebd`, plus only the previously frozen four-test overlay. All manifest files and the overlay verified unchanged before/after both commands. Production root and C28 author candidate untouched. Dependencies symlink to root node_modules; Nx cache/workspace data and TMPDIR isolated separately per command. Node v24.15.0, pnpm 10.17.0. Full argv/environment/version records in each COMMAND.json; exit/timeout/hash results in each RESULT.json.

Commands from own c27-copy (pinned executable PATH):

```sh
corepack pnpm nx test kernel equal-refresh-protected-paths --skip-nx-cache --maxWorkers=1
node tools/check-spec-types.mjs
```

| Probe | Observed useful property |
| --- | --- |
| Input confirmed before capture | Equal target declaration permitted; no duplicate 7; later independent 8 sends while unrelated owner remains pending; old started receipt stays frozen/sticky. |
| Input captured pending, confirmed inside updater | Exact declaration contradiction remains observable despite equal target; callback once; no duplicate 7; later independent 8 works; old receipt preserved. No-output source updater avoids relying on a second source mutation for contradiction. |
| Leaf adoption of equal physical inspection value | Independent ordinary adoption sends exact 7/0 while unrelated owner pending; no equal notification; foreign rollback does not undo/send again; later y=2 sends 7/2. |
| Whole adoption of equal physical inspection value | Same payload, ownership, notification, subsequent-write and duplicate checks pass through whole route. |

Premise classification: both input probes use public kernel operations throughout. Adoption probes use established private inspection setup only, followed by real public declarations/setters/Link delivery; they do not establish a public inspection API. No private comparator/proof injection. These results establish compatibility of the proposed assertions with exact C27, not their sufficiency to accept C28 or a universal mutation-sensitivity proof. C28 has not been inspected or run. Existing possible-window/actual-owner controls in the inventory remain separate.

Raw first logs preserved: `runs/probes-first/first.log` (1 file, 4 tests passed, exit 0) and `runs/spec-types-first/first.log` (exit 0). Both timeout=false. Nx emitted existing archived tsconfig extends-resolution diagnostics but actually executed all four tests; those diagnostics were not suppressed or fixed. Spec gate reported three existing baseline improvements; no --update used. No failed test premise or fixture type failure occurred.

The original preregistration REVIEW.md/SNAPSHOT.json remain unchanged, preserving their historical unexecuted status. This report and execution snapshot are the measured successor. No broader suites or source-type gate run; the requested spec-type gate is recorded exactly.
