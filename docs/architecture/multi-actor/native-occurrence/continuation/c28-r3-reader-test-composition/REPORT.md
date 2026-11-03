# Ordinary test composition

Private reader runtime unchanged from manifest `812a3ad5`. Composed manifest `0af649ba10c55e784d95ae323dcde8322ba018e465110c2a70a36ea2d4cb3949` changes only two diagnostic specs: file logging becomes optional, capability presence is unconditionally asserted, and the candidate-only case always runs. Independent review found no assertion weakening; original baseline comparison fixtures remain unchanged.

Fresh ordinary Nx execution with ST_COLD_OUTPUT, ST_SNAPSHOT_OUTPUT and ST_READER_CANDIDATE unset passes **11 tests / 2 files / zero skips**, exit0. See COMMAND.json and repeat.log. These are the same 11 tests, not an additional independent set. A pre-test PATH failure is preserved in first.log and FIRST-FAILURE.md. The corrected runner prepends pinned Node to inherited PATH.

Without sinks this run does not recreate comparative facade/allocation observations. No runtime, API, cost, bundle or broad-suite acceptance follows. Memory measurement uses the separately frozen 812 source, excluding the packet diagnostics; no composition test edits enter that comparison.
