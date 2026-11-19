# Independent commands

Working directory: `/private/tmp/st-retirement-cancellation-independent/candidate`.
Node 24.15.0; pnpm 10.17.0. PATH prefix `/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin`; NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_TUI=false.

```sh
corepack pnpm nx test kernel --skip-nx-cache fixed-window-independent.spec.ts --testNamePattern='repeated cancellation|stale cancellation' --maxWorkers=1
corepack pnpm nx test kernel --skip-nx-cache fixed-window-independent.spec.ts owner-transition-cancellation.spec.ts --maxWorkers=1
```

Logs: original-two.log (2 pass, 8 intentionally filtered); all-controls.log (15 pass). The two filtered tests are included again in the full ten: these runs represent 15 unique controls, not 17. No author output-producing retirement suite was executed. No source edits in either copy; no external reviewer transmission.
