# Unapplied test composition review

No assertion weakening demonstrated in `/private/tmp/st-c28-r3-reader-test-composition/composition.patch`. Independently checked both before/after hashes against IDENTITY.json and verified the proposed files are exactly the stated substitutions; see COMPOSITION-CHECK.json. Frozen812 sources were read, not changed.

Optional sinks suppress only file logging. All behavior assertions still execute; supplied sink write failures still propagate. The read helper now unconditionally requires the private capability, so it cannot silently qualify the facade fallback on a production collection. The former candidate-only case always executes, retaining sentinel propagation and undefined-without-fallback assertions. The separate genuinely capability-absent double remains intact. Neither expected values nor clone/lifetime/recovery assertions change.

Limits: without sinks, ordinary Nx passes will not produce the cold-facade inventory, stack or publication receipts used in the comparative packet. Some of those observations are recorded rather than asserted; an ordinary pass must not be described as a repeated memory/facade-avoidance comparison. The unconditional capability assertion also makes this successor spec unsuitable as an unchanged baseline comparator. Preserve the original frozen baseline fixtures for that purpose, as proposed.

Qualification pending: after the memory campaign ends, use Main's separate composed copy, unset ST_COLD_OUTPUT, ST_SNAPSHOT_OUTPUT and ST_READER_CANDIDATE, and run both files through Nx. Require exactly 11 passing tests and zero skips; preserve the first log/exit and bind the composed identity. No ordinary Nx run was started by this reviewer while memory work was being prepared. No source, frozen packet or runtime changes.

## Main no-env qualification receipts reviewed

Read COMMAND.json, first.log, repeat.log, FIRST-FAILURE.md and EXIT in the composition packet. The first attempt failed before Vitest with `spawnSync pnpm ENOENT`; it is a preserved PATH/setup failure, not a test assertion. The repeat uses pinned Node plus inherited PATH, no ST_* settings in its recorded environment, and reports exactly two files/11 tests passed, zero skips, exit0, cache skipped. Main records unchanged source. This qualifies the proposed optional-sink/permanent-capability composition under the recorded no-env command; it does not add comparative inventory receipts or a broad-suite claim. No reviewer rerun.
