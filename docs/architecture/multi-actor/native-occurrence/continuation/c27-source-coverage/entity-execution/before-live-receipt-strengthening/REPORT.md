# C27 independent entity lifecycle packet

Exact C27 manifest: `bc4c2447f4deeec12bc4ef05ed61392da3ceabb087e55e01d543adae82376ebd`. All 3,086 manifest files verified into own c27-copy; all remained unchanged after each recorded invocation. Node24.15.0/pnpm10.17.0, working root dependencies symlinked. No runtime/config/ratchet edits or broad suites.

## Results and preserved first evidence

- Original ROW23 `direct-row-declaration-qualification.spec.ts`, byte-identical SHA `b8c6ec372e915a1b1fbec181dcffb072e6c02607274d499177045e834ba1c841`: **5 pass / 1 fail**, exit1. Same actual-owner rollback receipt mismatch: expected started, observed superseded. Exact restored row0 payload and settlement pass before that assertion. Original file/body and raw first log remain untouched under originals/ and runs/original-row/.
- New `entity-declaration-useful-lifecycle.spec.ts`: **3 pass**, exit0 on first invocation. Direct-row restored truth/lifetime/disposal, collection unknown-window useful release, and entity-field endpoint reentry all reached their assertions.
- Unchanged `tools/check-spec-types.mjs`: first gate exit0 with original ROW23 and all three new tests present; no allowlist or ratchet changes.
- Console observation attempt with `--silent=false`: same three cases pass, but observations still absent from log. This result and command remain under runs/packet-observations; no receipt observation is fabricated from that run.
- Output-only JSONL counterpart: same assertions and operations, three cases pass; exact observations now preserved under runs/packet-jsonl/observations.jsonl. OUTPUT-ONLY.patch records only a node:fs sink helper/import and replacement of three console logging statements. First fixture/patch/identity are retained under originals/. The sink path is run-owned ST_ENTITY_DECLARATION_OUTPUT, never another agent's file. This observability replay is not three additional distinct cases.

The output-only fixture's subsequent spec-type result is recorded separately under runs/spec-types-output-only; see final verification below.

## Exact observations, not substituted receipt oracles

Row receipt immediately after declare: `{state:'eligible',basis:'declared'}`. After rollback and settlement: `{state:'superseded'}`. After disposal and same-key lifetime replacement: unchanged superseded. Exact sent payload stays `[{id:'a',n:0}]` throughout. The timing of the initial observation differs from the original file's later status check and is not itself an early-send claim.

Collection unknown receipt after foreign rollback and useful delivery: `{state:'started',basis:'surviving'}`. Exact delivery is `[[{id:'a',n:1}]]`; source remains n1 after the unrelated owner rolls back. Subsequent disposal and new lifetime n9 produce no extra old-endpoint send.

Entity-field endpoint receives exactly `[1,2]`: its first delivery authors the second through a real public independent declaration. Callback count is one, final field2, foreign owner inspection unchanged; owner rollback does not duplicate, disposal plus field3 remains local.

The row counterpart checks the pre-existing terminal/sticky category (`started`, `superseded`, `no-write`, `disposed`) from lifecycle.ts's terminal state guard, together with public frozen receipt/status and sticky behavior. It does NOT assert that all four states are normatively interchangeable for this rollback, or replace the original exact started expectation with a convenient started/superseded union. Useful payload, settlement, no early send, unchanged ownership/no equal notification, old-row dormancy and fresh lifetime assertions are independent of that category check. Exact normative rollback receipt disposition remains a separate adjudication if required for promotion. The observed superseded value is evidence, not authority by itself.

## Reproducibility and limits

Commands and raw output are under runs/*/COMMAND.json and first.log; every RESULT.json records exit, timeout=false, frozen manifest mismatches and overlay integrity. Nx filters are positional, one bounded file per invocation. Original is replayed separately from the new packet. First assertion failures were not overwritten or weakened.

The artifact is test-only: TESTS.patch adds only the three-case fixture. It does not include the original comparison file or production changes. Console-only first version is preserved separately. This is neutral public-kernel coverage; no native framework timing, general declaration safety, entity-normalization, retention-bound, performance or release claim follows. Independent review remains required before composition.

## Final verification

The output-only final fixture also passed the unchanged spec-type gate on its first check, exit0. All 3,086 frozen files and both overlays remained unchanged. No type correction, ratchet update, allowlist addition or runtime change was required. First gate and final gate raw outputs are both preserved.
