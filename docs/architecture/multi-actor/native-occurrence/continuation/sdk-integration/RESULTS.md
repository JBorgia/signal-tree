# Approved SDK capability combined with native corrections

Candidate manifest `f3bb2ef22fce1d0890cd791e599ac9284288f58e28c6406167547a870c9f0e79` identifies 2,955 source/test/configuration files. Parent native manifest is `45f6d1d91c7a51bd51a1d715d2fe7514b5b2158e846bf7a97439c265ba9b4574`.

The exact previously reviewed, owner-approved source-current capability patch applies to the native candidate without altered hunks. Nine runtime files and twelve added tests are identified by `APPROVED-SOURCE.json` and `TEST-PORT.json`. Approval requires native custom-adapter migration; neutral behavior remains as specified. This does not approve any further SDK surface.

Fresh execution through Nx: 74 focused tests pass across kernel (37), Angular (13), React (5), Vue (13), and Solid (6). Source typecheck passes. Commands, pinned tool environment, first logs and exits are under `runs/`. Counts are this run only, not sums with earlier overlapping controls. The full combined command completed with kernel exit1 and all four framework projects passing. Reported kernel totals are 6,439 passed, 84 failed, five expected failures, twelve skipped and ten unexecuted; framework totals are Angular259, React88, Vue194 and Solid119 passed, with three Angular skips. These are runner totals, not an independent per-assertion semantic census.

BROAD-FAILURES.json separates 32 missing-diagnostic-output failures and two specialized-GC-runner requirements from 50 runtime/oracle failures requiring disposition. On unchanged source, supplying the required output environment makes all 32 diagnostic cases pass (runs/diagnostic-harness-correction, JSON report). Some diagnostic cases record observations rather than asserting a complete semantic oracle. Specialized GC proofs remain separately qualified; neither a missing GC function nor a corrected harness is a runtime safety pass.

The broad log explicitly records V8 heap exhaustion and an unexpected worker exit. Ten assertions did not execute; their exact association and cause need isolated adjudication. No timeout or heap limit was increased. This is failed/incomplete qualification, not a green suite. POST-BROAD-SOURCE.json verifies all 2,955 source entries unchanged.

Private semantic admission, source retirement and collection membership egress corrections are being qualified separately and are NOT included in this frozen source. No cost, budget, package-consumer or release acceptance follows.
