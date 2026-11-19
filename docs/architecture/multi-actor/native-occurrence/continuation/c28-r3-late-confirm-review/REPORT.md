# Frozen R3: late-confirmation comparison boundary

**Finite control passes; spec-types passes. Post-cutoff historical cell is demonstrably retained in both actual comparison operands.** No runtime source edits, no author writes, no retries or assertion corrections. Unresolved aggregate qualification remains open and was not rerun/fabricated.

## Exact source and invocation

Requested runtime manifest SHA256 `1edb39e668f2a370554f692d455b75fac08a9836003a150acd09e2326368a08c` verified before capture. Full manifest `e0b64de42df330abff455d2ee1b981c99abee187a77269cd064f52f3b08505f3`; all3095 files copied from `/private/tmp/st-c28-r3-comparator/candidate` and checked against frozen hashes before/after copying. Own `r3-copy` adds only the one-test fixture. Root dependencies symlinked. Before/after both commands every manifested file and overlay matched; runtime remains byte-exact frozen R3.

Node24.15.0/pnpm10.17.0; isolated Nx cache/workspace data/TMPDIR and output sink. Commands in own copy:

```sh
corepack pnpm nx test kernel late-confirm-comparison-observation --skip-nx-cache --maxWorkers=1
node tools/check-spec-types.mjs
```

First Nx result: 1 test passed, exit0, timeoutfalse. First unchanged spec gate: exit0, timeoutfalse; no baseline --update. Raw logs/commands/process/results are under runs/{probes-first,spec-types-first}. Existing archived tsconfig diagnostic output retained. Source identity/manifests, original prior boundary fixture, output and TESTS.patch are preserved.

## Minimal seam and observation

Unchanged public sequence from the earlier boundary control: p owns x7; historical dependent[p,a] root updater consumes a's pending q1. Callback-capable private preparer registered before Link confirms a after native prepare and before real recipient preparer. Fresh equal literal declaration names p only. a is not a new updater input or declared owner, so the post-cutoff condition is not disguised by captured-pending protection. An after-Link preparer witnesses ordering. No private proof or owner injection.

The only additional observation is a Vitest spy on exported internal lifecycle.comparisonObligations: it calls the original exactly once, returns the original result unchanged, and immediately serializes role membership/flags for the exact a cell and admission cutoff. Exact a identity is obtained by pendingOwners set difference at its real transaction construction. The preparer records its native completion's comparison cutoff and comparisonCutoff immediately after authentic a.confirm. No new runtime export, altered proof, getter replacement, callback scheduling change or mutation of classification.

Recorded first observation (`runs/probes-first/observations.jsonl`):

| Quantity | Result |
| --- | --- |
| confirming preparer calls | 1 |
| order prefix | after-native-before-recipient, confirmed, after-recipient |
| native admission cutoff | 0 |
| confirmation serial immediately after a.confirm | 1 |
| actual comparator calls matching cutoff0 | 2 |
| a captured-pending protection | false in both |
| a before comparison filtering | owners/input/validation present; destination/possible absent |
| a after comparison filtering | exactly the same roles in both operands |
| predicate checks | pending destination roles preserved; flags unchanged |
| send before p confirms | [] |
| p inspection before confirmation | unchanged |
| final and after disposal | exactly [{x:7,y:0}] |
| historical receipt | started/surviving |
| fresh receipt | no-write, still no-write after disposal |

The comparison-observation assertions require nonzero matching calls and nonzero operands containing a in input/validation; both occur. Each asserts a is NOT in protectedOwners and retains all its before-role membership. Thus a's preservation is not a vacuous absent-cell or protected-input result. The observed confirmation is after the captured native cutoff. Public useful delivery, holds, unchanged owner inspection, frozen saved value and disposal checks pass as well.

Fresh no-write is valid: temporary old/new views already match while both retain the post-cutoff cell. It is not evidence that later confirmation was ignored. This explicitly avoids the earlier incorrect open-at-admission-forever-unprojected comparator requirement. Source-transport closure and comparator eligibility remain distinct.

## Limits

This is a private callback-capable preparer timing seam surrounding real public transactions/declarations/Link delivery, not an ordinary public preparation API. It tests one late confirmed I/V cell while actual p remains pending. Flags are observed unchanged in this workload; it does not newly create every invalid/rejected/D/W counterexample or replace the existing safety controls. Exact comparison ordering/proof storage was not modified. No retention/performance/general release claim.

The earlier unresolved-aggregate attempt at `/private/tmp/st-c28-r3-boundary-controls` had all occurrence counts0/projection flagsfalse. Its original coverage failure, R2 results and typing correction remain untouched. No source-grounded path establishing unrelated unresolved aggregate support at attempted reduction was identified in this bounded task. That limitation remains explicit; this passing late-confirmation test is not substitute coverage.
