#!/usr/bin/env bash
set -u
# Run from repository root using .nvmrc Node and package.json-pinned pnpm.
export NX_DAEMON=false
pnpm nx test kernel --testFile=src/lib/b-dependency-lifecycle-audit.spec.ts --testFile=src/lib/b-authored-topology-repair.spec.ts --testFile=src/lib/b-topology-dependencies.spec.ts --testFile=src/lib/b-operation-admission.spec.ts --testFile=src/lib/b-operation-admission-review.spec.ts --testFile=src/lib/b-operation-admission-terminal.spec.ts --skip-nx-cache
focused=$?
bash docs/research/b-native-integration/qualification/replay-counterexample.sh
original=$?
node docs/research/b-native-integration/operation-admission/count-admission.mjs
counts=$?
printf 'focused=%s original=%s counts=%s\n' "$focused" "$original" "$counts"
# Focused expected nonzero: unresolved payload plus terminal-order counterexample.
exit "$focused"
