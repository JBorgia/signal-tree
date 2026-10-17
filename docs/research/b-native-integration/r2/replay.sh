#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../../.."
test "$(node --version)" = v24.15.0
test "$(pnpm --version)" = 10.17.0
export NX_DAEMON=false
out=$(mktemp -d /private/tmp/b-public-r2-replay.XXXXXX)
printf 'Evidence: %s\n' "$out"
pnpm nx test kernel --testFile=src/lib/native-ownership-public.spec.ts --testFile=src/enhancers/transactions/b-public-entity-experiment.spec.ts --testFile=src/enhancers/transactions/b-public-entity-retention.spec.ts --testFile=src/lib/native-ownership-experiment.spec.ts --testFile=src/lib/native-ownership-r1.spec.ts --testFile=src/lib/internals/subject-restoration-claims.spec.ts --skip-nx-cache > "$out/focused.log" 2>&1
pnpm nx run-many -t test -p angular react vue solid --parallel=2 --skip-nx-cache --testNamePattern='B selected public transaction observers' > "$out/framework.log" 2>&1
pnpm nx test kernel --testFile=src/lib/prepend-publication-boundary.spec.ts --testFile=src/lib/entity-active-prepend-changeid.spec.ts --testFile=src/lib/entity-update-one-equivalence.spec.ts --testFile=src/lib/internals/intrinsic-mutation-pay-for-use.spec.ts --skip-nx-cache > "$out/affected.log" 2>&1
pnpm run typecheck > "$out/typecheck.log" 2>&1
node tools/check-spec-types.mjs > "$out/spec-types.log" 2>&1
pnpm nx run-many -t lint -p kernel angular react vue solid --parallel=2 --skip-nx-cache > "$out/lint.log" 2>&1
if pnpm nx test kernel --testFile=src/lib/native-ownership-r1-baseline-counterexample.spec.ts --skip-nx-cache > "$out/preserved-red.log" 2>&1; then
  printf 'Unexpected pass: inspect preserved baseline probe verdict.\n' >&2
  exit 1
fi
(
  cd docs/research/b-native-integration/recovery
  node tests.mjs "$PWD/arm-b.mjs" "$out/model41.json" > "$out/model41.log" 2>&1
  node adversarial.mjs > "$out/model14.log" 2>&1
  node destroy-review.mjs > "$out/model-destroy.log" 2>&1
)
printf 'Focused verification completed; preserved baseline probes remain separately red. Logs: %s\n' "$out"
