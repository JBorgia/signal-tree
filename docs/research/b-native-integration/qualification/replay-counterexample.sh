#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../../.."
test "$(node --version)" = v24.15.0
test "$(pnpm --version)" = 10.17.0
probe=packages/kernel/src/lib/b-qualification-minimal-counterexample.spec.ts
if test -e "$probe"; then printf 'Refusing to overwrite existing %s\n' "$probe" >&2; exit 2; fi
trap 'rm -f "$probe"' EXIT
cp docs/research/b-native-integration/qualification/counterexamples/minimal-public.spec.ts "$probe"
NX_DAEMON=false pnpm nx test kernel --testFile=src/lib/b-qualification-minimal-counterexample.spec.ts --skip-nx-cache
# Expected exit1: two incumbent passes and two B failures. Assertions unchanged.
