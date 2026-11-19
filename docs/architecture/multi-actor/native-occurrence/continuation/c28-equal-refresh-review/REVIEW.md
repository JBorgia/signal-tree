# Protected equal-value refresh inventory for C28

Scope: independent C27 source/test review against approved C28 authority. No C28 candidate or author conclusions inspected. No runtime changes, root writes, tests, typechecks or broad qualification. No blocker demonstrated against an implementation not reviewed. Four proposed tests are unexecuted and require fixture validation before promotion.

Exact C27: `/private/tmp/st-c27-public-composition/candidate`; manifest SHA256 `bc4c2447f4deeec12bc4ef05ed61392da3ceabb087e55e01d543adae82376ebd`. All 3086 manifest files verified unchanged. Root HEAD observed `628d302dadb082a48c58528651c9088234d0a777`; existing dirty controller/docs/tooling left untouched. `SOURCE-IDENTITY.json` records source/authority hashes; `inputs/` preserves cited raw sources and authority. Read review/contributor contracts and independent review protocol. This is not release verification.

## Approved boundary and source consequence

C28-AUTHORITY.md: “Preserve meaningful equal-value evidence refresh when current publication obligations actually change. Value equality alone does not establish no-write.” Also: “Input captured pending does not become obsolete history merely because it confirms during the current operation.” These are the premises; no new receipt policy is proposed here.

C27 `packages/kernel/src/lib/experimental-publication/private.ts:71` compares proof roles and unknown/invalid/unavailable/history/rejection flags. Completion at :337–354 projects current support before deciding no-write. That decision either keeps the predecessor or selects a new projection, so incorrectly collapsing an evidence refresh can lose useful admission even with equal values. This identifies a review boundary, not a demonstrated C28 defect.

Separately, :148–153 handles physical inspection return to ordinary truth by replacing the current view while preserving old snapshot certificates. At :158–178, fresh consumed inputs are captured, retaining selected ownership is distinct from consumption, and only a retaining literal avoids newly consumed input. Prospective no-write must not bypass those jobs. Equal physical values can also represent changed ordinary values, which must still publish.

## Finite existing inventory

Paths below are relative to `packages/kernel/src/lib/` in exact C27. Preserve bodies and assertions.

| Protected behavior / cheapest existing falsifier | Evidence | Failure meaning |
| --- | --- | --- |
| Unowned possible-window equal refresh makes useful progress while unrelated owner is still pending; confirm/rollback produces no extra send. Leaf and whole. | `equal-owner-admission.spec.ts`, unowned cases | Equality incorrectly treated as sufficient no-write, leaving old possible-only hold. |
| Actual pending ownership survives equal independent leaf/whole; exact 7 on confirm or 0 on rollback, never early send. | same file, owned cases | Current ownership or inverse selection discarded. Do not require held receipt for a true no-write. |
| After destination p confirms, foreign q is only possible; new equal literal releases held `{x:7,y:0}`, settles, no equal notification, q rollback cannot alter destination or resend. | `terminal-owner-possible-refresh.spec.ts:11` (2 routes) | Obsolete p history must not hide a meaningful change to current possible-only support. |
| Contrast: after p confirms, q remains an actual validation/input contributor; new equal literal still waits for q, then exactly one payload. | `terminal-owner-actual-contributor.spec.ts:5` (2 routes × 2 roles) | Filtering confirmed history accidentally removes live input/shared-validation responsibility. |
| Fresh independent equal literal replaces failed scalar support and sends `{x:7,y:8}` while unrelated foreign owner remains pending; derived successor cannot cleanse failed shared validation. | `scalar-native-support.spec.ts:77–110` | Losing valid repair progress, or conversely treating consumed failed support as an independent literal. |
| Authoritative adoption of same physical inspection value establishes ordinary truth; later local write includes adopted value. | `inspection-egress-conformance.spec.ts:424–472` I4; frame rollback contrast `scalar-frame-publication.spec.ts:646–683` | Physical equality confused with ordinary equality; inspection leaks or adoption is dropped. I4 uses public inbound Link, frame contrast uses private frame ingress. |
| Existing q input remains enforceable through p confirmation and subsequent updater; no independent laundering. | `equal-owner-current-input.spec.ts` | Actual current input confused with obsolete historical input. |
| Saved inspection certificate remains distinct from fresh ordinary snapshot through direct/frame return. | `saved-inspection-snapshot-isolation.spec.ts` | Current-view refresh mutates old supplied snapshot evidence. |

Current C27 evidence inspected: `runs/focused-first/first.log` and `RESULT.json` report 54 pass in 8 files, exit 0, no timeout, source unchanged. This includes equal-owner-admission/current-input/saved-inspection but does NOT establish C27 execution of the terminal-owner pair, scalar-native-support, inspection-egress, or scalar-frame files. Their inventory above is source evidence, not a new pass claim. Stale preregistration comments are not execution evidence.

## Four small additional proposed public probes

`TESTS.patch` adds only `equal-refresh-protected-paths.spec.ts` (also under `packet/`). No runtime or config edits. Public typed Link/declarations/tree operations; no proof injection or comparator/map assertions.

1. Input confirmed before consumption: already delivered target 7; a real source `updateAndReport` callback supplies its current 7 to an equal target setter under independent declaration. No contradiction, no duplicate 7; later independent 8 progresses while unrelated owner remains pending. Prior started receipt stays frozen/sticky.
2. Same input captured pending, confirmed inside callback before equal target setter: contradiction after callback remains mandatory, despite equal target and newly terminal owner. Existing delivered 7 is not resent; later unrelated independent 8 remains useful. Callback executes once. Returning `{}` prevents the source's own second write admission from accidentally supplying the expected contradiction. Existing `publication-role-overlap-audit.spec.ts:24` uses this no-output public updater idiom; `entity-obligation-matrix.spec.ts:45–72` grounds confirmed-before versus confirmed-inside timing, but uses changed scalar output rather than this equal-target seam.
3–4. Leaf and whole declared adoption: ordinary pair 0/0 is privately displayed as inspection 7/0; an independent public equal-physical write must establish ordinary 7/0 and deliver it while unrelated q remains pending. No equal leaf notification, exact payload once, q rollback does not undo it; later y=2 delivers 7/2. Private inspection ingress is separately classified, not presented as a public inspection API. Grounded in existing I4/frame adoption controls. These test ordinary authoring, not whether a no-write receipt uses any particular state.

Assumptions/limits: the new four are derived contract probes, not measured passing controls. No new equal receipt state is asserted. Input-timing errors may reveal fixture/source-domain limitations and must retain first failures for adjudication; do not silently relax them. No exhaustive framework/retirement/unknown matrix claimed. The original C27 A/B observations and ROW23 remain untouched.

## Cheapest execution plan after candidate freeze

In separate source-verified copies, first run the four new probes on C27 and C28 and preserve first failures, then unchanged spec types. Use pinned Node24.15.0 / pnpm10.17.0 and Nx, positional space-separated file filters (never comma-joined `--testFile`). Suggested commands, not run:

```sh
pnpm nx test kernel equal-refresh-protected-paths --skip-nx-cache --maxWorkers=1
node tools/check-spec-types.mjs
pnpm nx test kernel equal-owner-admission terminal-owner-possible-refresh terminal-owner-actual-contributor --skip-nx-cache --maxWorkers=1
```

For the changed-source review, add only the affected failed-support, input/snapshot, and inspection cases above if not already covered by the author's exact frozen run. This is a finite fallback inventory, not a request to duplicate their suites. Validate fresh authentic confirmed handles separately through existing declaration validation controls; these probes do not substitute for handle authenticity checks.

No execution or typecheck performed in this task. No acceptance, retention bound, API change, or policy reopening implied.
