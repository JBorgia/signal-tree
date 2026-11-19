# Exact gate commands

CWD `/private/tmp/st-current-read-capability-proof` unless stated.
Environment: Node `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin` first on PATH;
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false`; builds also used `NX_NATIVE_COMMAND_RUNNER=false`.
`corepack pnpm` resolves pinned pnpm 10.17.0.

```sh
# Original bytes copied to each framework lib/original-public-current.spec.ts,
# then moved back to evidence after these filtered executions.
corepack pnpm nx test angular --skip-nx-cache -- original-public-current -t 'public callback discriminator' --maxWorkers=2
corepack pnpm nx test vue --skip-nx-cache -- original-public-current -t 'public callback discriminator' --maxWorkers=2
node proof-evidence/independent-controls.mjs /private/tmp/st-current-read-capability-proof
node proof-evidence/marker-error-controls.mjs /private/tmp/st-current-read-capability-proof
corepack pnpm nx run-many -t test --projects=kernel,angular,vue,solid,react --parallel=1 --skip-nx-cache -- selected-callback-facade current-read-capability --maxWorkers=2
corepack pnpm run typecheck
node tools/check-spec-types.mjs
corepack pnpm nx run-many -t test --projects=kernel,angular,vue,solid,react --parallel=1 --skip-nx-cache -- --maxWorkers=2
corepack pnpm nx run-many -t build --projects=kernel,angular,vue,solid --parallel=1 --skip-nx-cache --outputStyle=stream
python3 proof-evidence/prepare-packed-consumer.py
node node_modules/typescript/bin/tsc -p proof-evidence/consumer/tsconfig.bundler.json
node node_modules/typescript/bin/tsc -p proof-evidence/consumer/tsconfig.node16.json
node --conditions=browser proof-evidence/consumer/src/runtime.mjs
node proof-evidence/vue-readonly-baseline.mjs
node --experimental-strip-types proof-evidence/observer-counts.ts
python3 proof-evidence/run-mutants.py
# Same focused Nx command again after mutation restoration.
```

Every recorded command has adjacent raw `.log` and `.exit` files; MUTATION-REPORT.md
and mutations/results.json contain each exact mutant argv and expected failing exit.
`prepare-packed-consumer.py` ran npm pack in each canonical dist directory and
extracted the four tarballs into the isolated consumer. It is a recorded one-shot
preparation command, not an idempotent installer; do not rerun into frozen artifacts.
All peer dependencies came from the installed candidate dependency tree. No registry
installation or external source review was performed for this consumer proof.

Patch verification: `git apply --check ../candidate.patch`, cwd `proof-evidence/patch-base`.
Source extraction: `git archive 87f6831fa60cafe87508f0ace84b7638698ca3b0 | tar -x -C /private/tmp/st-current-read-capability-proof`, cwd main repo (read only).
Dependencies: cloned with `cp -cR` from the rejected scratch; launcher paths retargeted
inside the new scratch. Setup race is preserved in setup-first-failure.log.
