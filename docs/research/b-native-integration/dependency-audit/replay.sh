#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/../../../.."
test "$(node --version)" = v24.15.0 || exit 2
test "$(pnpm --version)" = 10.17.0 || exit 2
export NX_DAEMON=false
out=$(mktemp -d /private/tmp/b-dependency-audit-replay.XXXXXX)
pnpm nx test kernel --testFile=src/lib/b-dependency-lifecycle-audit.spec.ts --testFile=src/lib/b-authored-topology-repair.spec.ts --testFile=src/lib/b-topology-dependencies.spec.ts --reporter=json --outputFile="$out/results.json" --skip-nx-cache > "$out/tests.log" 2>&1
result=$?
printf 'test exit: %s; evidence: %s\n' "$result" "$out"
# Expected exit1: 18 pass, 7 fail, including one explicitly unresolved premise.
# A successful script launch is not qualification. Inspect JSON and README.
exit "$result"
