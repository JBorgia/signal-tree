# C21 test-only recipient progress counterparts

Frozen manifest: `4f828914a214bf556e16af6d44047a7f8b39ec1fa47eb231ca9981e564aec94d`.
Patch: COUNTERPARTS.patch, SHA-256 `9e011c68223cc16402cf84e2f36bea874f767cca5f4caa62b0298491bdf4b10f`.
Exact baseline C21: `73e4ecfde64ee05a1eed1eb1362e8ca6f18755b1192a3583454440ef4ad68c27`.

Runtime/config/tooling unchanged. 3064 baseline paths remain byte-identical; only two original spec paths are routed/modified and one counterpart file added. This is test maintenance against the approved enrollment/source-evidence distinction, not a runtime repair or policy change. No root or other frozen candidate edits.

## Preserved first evidence and routing

Before routing, byte-exact originals of aggregate-independent-input.spec.ts (four cases) and recipient-cause-classification.spec.ts (all six cases) were copied to originals/. ORIGINAL-FAILURE-STACKS.txt, ORIGINAL-COMMAND.json, ORIGINAL-RESULT.json and ORIGINAL-OUTPUT.txt preserve the partition's six first failures and raw aggregate observations. Originals match the baseline hashes at freeze.

Only four obsolete aggregate cases and two domain-only classifier cases leave active discovery. The aggregate old file is deleted from this candidate and represented by stronger separate counterparts. The classifier retains its four external-origin / unknown-declaration cases and their assertions. Its domain-only conditional branch is removed after narrowing its parameter list; the retained cases' formerly-else assertions are unchanged. No skip/xfail, runtime patch or whole-classifier removal. ROUTING.json records the mapping.

The nine recipient-source-permission controls remain byte-identical, including no borrowed permission for a later unscoped write, actual untouched destination owner and failed parent horizon. Together with the four retained classifier cases, all 13 valid guards pass. The original 16 enrollment/disposal controls and nine actual native-window controls remain byte-identical and pass too.

## New tests and nonvacuous claims

recipient-progress-positive-counterparts.spec.ts adds 12 cases:

- Eight aggregate cases: the four branch/root x before/during-pending enrollment combinations, each under confirm and rollback. Both endpoints must receive the exact complete branch/root payload once while unrelated p remains pending; primary receipt and start are declared, secondary start is surviving and hasDeclaration=false. The updater runs once, physical source matches, p.inspect and owner value remain unchanged before settlement, and p's chosen terminal value is checked. Both settled() calls complete, and settlement produces neither duplicate values nor starts.
- Two domain-only root-input/branch-output cases (confirm/rollback): both endpoints publish the exact payload through surviving admission. Secondary permission is captured at actual lifecycle.started entry and must remain false; primary matching declaration identity remains true, without forcing declared early admission. Recipient-domain evidence is present; unobserved origin, invalid attribution and uncaptured input remain absent. The original proof-unknown diagnostic is retained and passes. A later pending owner remains unchanged, both settled() calls complete, and neither original-owner nor later-owner settlement duplicates output.
- Two genuine native-window counterweights: an unscoped root x write under p supplies actual native possible support to the same root updater/branch recipient route. Both endpoints and all starts remain absent until p settles; pending possible support is positively observed and settled() remains unresolved. Either p terminal outcome releases exactly one latest `{x:8,y:0}` payload with surviving basis; a later pending owner cannot extend the old window and remains untouched. Later settlement does not duplicate delivery.

Spies delegate to actual lifecycle functions and observe channel/permission before operation retirement; no fake facade, admission, completion or native proof implementation. All trees/Links and spies are cleaned up. The counterweight changes source inputs deliberately rather than manufacturing a recipient-only hold.

## Results

Each invocation preserves command/env/cwd, first log and child exit JSON. Pinned Node24.15.0 / pnpm10.17.0, Nx test kernel, own exact C21 copy, root dependency symlink, daemon/cloud disabled, maxWorkers=1. No full suite, build, timing or cost claim.

| Invocation | Result |
| --- | --- |
| counterparts-first | 12/12 new runtime cases passed on first execution |
| spec-types-first | **Failed**: witness basis typed string although observed parameter permits undefined; first fixture and raw compiler output retained |
| source-types (`pnpm run typecheck`) | Pass; generated typing check and both source type projects |
| spec-types-final | Pass after widening only the witness's observation type; no assertion change |
| affected-final before routing | 46/46 across new + unchanged enrollment/permission/native-window files |
| valid-unknown-controls before routing | Original classifier 4 passed / 2 domain-only filtered; not counted as six passes |
| affected-lint | New fixture passes |
| routed-final | **50/50 across all five affected/control files**, no filtered cases |
| routed-spec-types | Pass, ratchet unchanged |

The initial compiler failure was not a runtime failure. FIRST-FIXTURE.spec.ts preserves it. Widening the local observation type to `string | undefined` keeps an omitted basis observable and still fails the exact start assertions; it does not default missing data to the desired result. Formatting was applied only to the new file. Source types passed before test-only routing; runtime/source hash identity remains unchanged afterward.

Cold Nx graph discovery emitted existing archived tsconfig resolution warnings on the first invocation; it subsequently executed and passed the actual 12 tests. This is not a no-tests-found result. Python run.py records the child exit separately and does not propagate it through its own exit code; use *-exit.json.

## Independent review

McClintock was requested to independently inspect exact originals, first failures, counterpart premises, channel permission, actual native-window lifecycle, preservation/routing and the 13 retained guards. Final frozen identity is supplied separately. Composition is gated on that review; no preferred acceptance verdict or broad suite is requested. No independent approval is claimed by this author report.
