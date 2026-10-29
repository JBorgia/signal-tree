# Archive verification

October 29, 2026. Point-in-time documentation and preservation checks only.

Runtime preservation commit87ddcfdedcb5d91e700d812bd6cbee2f77038510 is clean; staged diff checks passed before commit. It changes13files,676insertions/76deletions relative to75416029, including original failing fixtures. This is a rejected experiment, not release acceptance.

Final core independent pre/post manifests are byte-identical; all matching current file hashes agree. Terminal helper manifests are also byte-identical to each other, but final entity-signal.ts and collection-contributor-core.spec.ts changed afterward. The report therefore retains27passes as scoped intermediate evidence only. Native retirement is not integrated.

Production87 and predecessor754 tracked runtime diffs remain empty. Only the documented test-only framework files are untracked in those checkouts. Readiness AGENTS.md and measurement-contract.md hashes remain exactly the preexisting values in IDENTITY.json.

## Documentation command

```sh
cd /Users/jonathanborgia/.codex/worktrees/v16-incumbent-readiness/signaltree
/Users/jonathanborgia/.nvm/versions/node/v24.15.0/bin/node --import /private/tmp/collection-doc-deps.mjs tools/check-doc-links.mjs
```

Result:937/937 relative links across208 live surfaces resolve; install-name checks pass. Resolver bytes and complete output are archived in evidence/. The resolver supplies only semver from the already installed experiment dependencies; checker source, package manifests and lockfile are unchanged. No dependency download occurred. This is documentation validation, not package-build evidence.

Infrastructure attempts are preserved separately: first command named a node binary absent from the pnpm-wrapper directory (exit127); corrected Node24 invocation found semver absent in this readiness checkout; initial resolver recursed; corrected pre-resolved dependency ran the unchanged checker successfully. None is a runtime test failure. Replay instructions now name the actual Node24 directory explicitly.

The first request to write this archive was not executed because automatic approval review reported selected-model capacity. The same scoped operation succeeded on one retry. No approval check was bypassed and the service did not classify the action unsafe. Local staging remains at /private/tmp/link-collection-rejection-archive-stage; committed archive supersedes its earlier replay text.

No runtime edit, full-suite run, source/spec typecheck, production demo build, installed package gate, budget measurement, CPU/heap campaign or release action was performed during archival.
