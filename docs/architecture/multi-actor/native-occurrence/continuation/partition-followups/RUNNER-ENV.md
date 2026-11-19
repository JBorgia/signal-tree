# C21 ordinary kernel output requirements

Scope: all 620 `kernel:test-ci--` file targets from the cached C21 graph, not only the 343-file partition. ENV-INVENTORY.json lists every direct process.env use with source line; ENV-AND-OUTPUT-SEARCH.json additionally checks env aliases/imports and absolute scratch paths. No test changes or new runs from this inventory.

| Setting | Required use / shape |
| --- | --- |
| ST_PREPARED_REVIEW_OUTPUT | Fresh existing directory. Mandatory unconditional writes in independent-dynamic-enrollment, independent-occurrence-terminal, independent-prepared-boundary, independent-prepared-unit. Also enables optional outputs in independent-scalar-publication, ordinary-restoration-placement, parent-freshness-focused, parent-snapshot-currentness. |
| ST_PUBLIC_DIAGNOSTIC_OUTPUT | Fresh existing directory; public-selected-unit writes xy/yx × retry/confirm JSON files. |
| TMPDIR | Own existing directory; whole-bounded-qualification and whole-getter-controls unconditionally write fixed JSON basenames. |
| ST_GC_ARM | For held-continuation-probe only: hold-proceed, drop-proceed, or hold-row. One arm per fresh process, not a blanket ordinary-suite setting. |
| ST_GC_OUTPUT | Unique file path with existing parent for held-continuation-probe. |
| NODE_OPTIONS / exposed GC | Held-continuation-probe asserts globalThis.gc before any setup. Historical mechanism is --expose-gc propagated to workers. Preserve any required diagnostic preload; do not replace it accidentally. The probe records NODE_OPTIONS in its output: use only explicit nonsecret flags. |

Optional outputs: SEMANTICS_REPORT (file), ST_PACKET_PAIR_OUTPUT (directory; tests mkdir recursively), ST_POINT_ALLOCATION_OUTPUT (JSONL file), ST_SINGLETON_ALLOCATION_OUTPUT (JSONL file), ST_MEMBERSHIP_REPLAY_OUTPUT (JSONL file), ST_PERF_OUTPUT_FILE (file, parent mkdir by writer). All other file parents must exist. ST_PERF=1 enables timing workloads: leave unset for this ordinary scope. ST_RETIREMENT_FAULT is a fault-injection selector, not an output requirement; leave unset. No new benchmark run.

## Env is insufficient for complete output isolation

Hard-coded writes in the included universe:
- fixed-window-retirement: /private/tmp/st-fixed-window-retirement-cancellation-successor/provenance-${cause}.json
- rich-source-completion-boundary: /private/tmp/st-joint-phase-successor-r4/runs/completion.jsonl
- recipient-window-review: same runs directory /recipient-traces.jsonl
- rich-capture-getter-boundary: same runs directory /getter.jsonl
- rich-capture-participant-boundary: same runs directory /participant.jsonl
- rich-source-preparation-boundary: same runs directory /preparation-scalar.jsonl
- internals/diagnostics: /tmp/flush-0.txt, /tmp/flush-probe.txt, /tmp/leaf-support-0.txt, /tmp/owner-evidence-0.txt, /tmp/owner-scope-leak.json, /tmp/owner-scope-0.txt.

The inherited preload redirected only recipient-traces.jsonl. The earlier partition therefore did NOT guarantee all diagnostic outputs were local. Several other hard-coded-writing specs were in that partition. Do not erase or rewrite those external artifacts; source inspection identifies the exposure, but no filesystem syscall trace establishes every actual write. First logs and results remain valid raw run records with this containment limitation. This follow-up runs only public-selected-unit and writes its four outputs to its own directory.

Reusable runner preflight: create fresh mandatory directories; enumerate requested file requirements; supply fresh per-arm GC configuration only for a separately scoped GC run; unset optional stale output/fault/timing settings; map every applicable hard-coded output to own paths in an output-only preload (appendFileSync AND writeFileSync, preserving arguments/errors and syncing builtin ESM exports). This is a proposed runner correction, not implemented here. Do not silently exclude specs or declare the current full ordinary invocation self-contained.
