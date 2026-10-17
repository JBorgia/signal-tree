#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/../../../.."
test "$(node --version)" = v24.15.0 || exit 2
test "$(pnpm --version)" = 10.17.0 || exit 2
export NX_DAEMON=false
out=$(mktemp -d /private/tmp/b-topology-replay.XXXXXX)
run() { label=$1; shift; "$@" > "$out/$label.log" 2>&1; result=$?; printf '%s %s\n' "$label" "$result" >> "$out/exits.txt"; }
run original-minimal bash docs/research/b-native-integration/qualification/replay-counterexample.sh
run preserved-controls pnpm nx test kernel --testFile=src/lib/b-authored-topology-repair.spec.ts --testFile=src/lib/b-topology-dependencies.spec.ts --testFile=src/enhancers/transactions/b-public-entity-experiment.spec.ts --skip-nx-cache
run relevant-groups pnpm nx test kernel --command="pnpm exec vitest run --config docs/research/b-native-integration/qualification/harness/kernel.config.ts packages/kernel/src/enhancers/transactions/rekey-occupancy-0.spec.ts packages/kernel/src/enhancers/transactions/rekey-supersession-0.spec.ts packages/kernel/src/enhancers/transactions/reentrant-order-bookkeeping.spec.ts packages/kernel/src/enhancers/transactions/reentrant-order-v16-controls.spec.ts --reporter=json --outputFile=$out/relevant.json" --skip-nx-cache
printf 'Evidence: %s; candidate remains rejected.\n' "$out"
cat "$out/exits.txt"
