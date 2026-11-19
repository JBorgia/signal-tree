# Current experimental workflow verification

October 29, 2026. Node 24.15.0. Commands below run from the repository root.
This is not a production or release verification report. Historical files named
`test-output-final` predate this checkpoint and remain preserved unchanged.

| Executed boundary | Result | Evidence |
| --- | --- | --- |
| Coordinator, AG-UI, review grant, four comparison arms | 84 passed | `verification/node-controls.log` |
| Loopback HTTP, exact review grants and independent falsifiers | 15 passed | `http/INDEPENDENT-REVIEW.md`; separate main replay |
| Disposed coordinator transport closure | Sampled collectibility passes | `lifecycle/README.md`; independently reproduced original failure and corrected result |
| Installed kernel source probes/workflows/settlement | 6 + 3 + 2 pass | `installed/evidence/5727cd8f/`; main separately replayed workflows/settlement/typed operation consumer |
| Installed Angular full AOT DOM reference | 15 passed | `installed/browser/convergence-review/identities.json`; prior 12 unchanged |
| Independent browser convergence/security scenarios | 19 passed, including the current 15 | `installed/browser/independent-review/CONVERGENCE-FINAL.md` |

Do not sum overlapping controls into a unique-proof count. Source probes include
explicit assertions of unsupported stronger behavior. The browser backend and
review authority are in-memory host fixtures, not production identity or durable
storage. Actual HTTP tests and browser tests exercise separate fixture compositions.
The browser's static server is not its persistence API.

```sh
node --test tools/experiments/multi-actor-operations/*.test.mjs tools/experiments/multi-actor-operations/protocol/*.test.mjs tools/experiments/multi-actor-operations/authority/*.test.mjs tools/experiments/multi-actor-operations/comparison/*.test.mjs
node --test tools/experiments/multi-actor-operations/http/*.test.mjs
node --expose-gc tools/experiments/multi-actor-operations/lifecycle/gc.mjs
node tools/experiments/multi-actor-operations/installed/browser/run.mjs
```

The browser command reuses verified archived library tarballs, installs offline,
compiles strict AOT, then runs a loopback server/Chromium. Host permissions may be
needed; refused listener starts are preserved separately from runtime failures.
The comparison requires its pinned npm installation and identified installed
SignalTree artifact; see `comparison/README.md` for setup and strict consumer types.

Library identity: active source `5727cd8f`, retained-runtime controller `87f6831f`.
The root checkout's older runtime is not substituted. Native publication and
framework-current-reader candidates live in separate frozen scratch archives;
these application passes neither repair nor qualify them. Their remaining gates
are tracked in the governing product coverage ledger.
