#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/../../../.."
test "$(node --version)" = v24.15.0 || exit 2
test "$(pnpm --version)" = 10.17.0 || exit 2
export NX_DAEMON=false
out=$(mktemp -d /private/tmp/b-qualification-replay.XXXXXX)
printf 'Evidence directory: %s\n' "$out"
# Deliberately continue after failed qualification gates. Every exit is recorded.
run() { label=$1; shift; "$@" > "$out/$label.log" 2>&1; code=$?; printf '%s %s\n' "$label" "$code" >> "$out/exits.txt"; }
run default-kernel pnpm nx test kernel --maxWorkers=4 --reporter=json --outputFile="$out/default-kernel.json" --skip-nx-cache
run B-kernel pnpm nx test kernel --command="pnpm exec vitest run --config docs/research/b-native-integration/qualification/harness/kernel.config.ts --maxWorkers=4 --reporter=json --outputFile=$out/B-kernel.json" --skip-nx-cache
run default-framework pnpm nx run-many -t test -p angular react vue solid --parallel=2 --maxWorkers=3 --skip-nx-cache
for project in angular react vue solid; do
  suffix=ts; extra=; test "$project" = react && suffix=mts
  test "$project" = angular && extra=NODE_OPTIONS=--expose-gc
  run "B-$project" pnpm nx test "$project" --command="$extra pnpm exec vitest run --config docs/research/b-native-integration/qualification/harness/$project.config.$suffix --maxWorkers=3 --reporter=json --outputFile=$out/B-$project.json" --skip-nx-cache
done
run typecheck pnpm run typecheck
run spec-types node tools/check-spec-types.mjs
run lint pnpm nx run-many -t lint -p kernel angular react vue solid --parallel=2 --skip-nx-cache
printf 'Qualification records failures; inspect exits and JSON, not script completion alone.\n'
cat "$out/exits.txt"
