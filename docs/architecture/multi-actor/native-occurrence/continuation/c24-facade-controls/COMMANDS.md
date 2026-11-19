# Deferred commands — do not run until Main freezes runtime candidate

Apply TESTS.patch only in Main's intended disposable composition. Record the runtime manifest and these four test hashes before/after. Use pinned Node24.15.0 and pnpm10.17.0. No config changes or automatic retries.

From that candidate root, serially:

```sh
pnpm nx test angular equal-owner-facade-controls --skip-nx-cache --maxWorkers=1
pnpm nx test vue equal-owner-facade-controls --skip-nx-cache --maxWorkers=1
pnpm nx test solid equal-owner-facade-controls --skip-nx-cache --maxWorkers=1
pnpm nx test react equal-owner-facade-controls --skip-nx-cache --maxWorkers=1
```

Each must discover exactly its one new file/eight cases. These are positional filters, not comma-joined testFile arguments. Vue/Solid/React C23 project targets already invoke their spec tsc before Vitest; preserve this. Angular target does not provide the same explicit precheck: include its ordinary spec-type coverage via the existing Main spec-types gate (`pnpm exec node tools/check-spec-types.mjs`) when authorized. No independent gate or baseline configuration is introduced.

The existing Angular target sets NODE_OPTIONS=--expose-gc; tests do not call GC. Retain target semantics and report environment rather than changing config. Use Main-owned isolated output/cache/TMPDIR and its authorized watchdog if needed; these files write no diagnostic sinks. Preserve raw first output and do not infer runtime failure from no-files/typecheck/tooling failure.

Stop and report a failure before broadening or rerunning. All commands above are UNEXECUTED instructions, not verification evidence.
