#!/usr/bin/env bash
set -eu
# From repository root, using .nvmrc Node and manifest-pinned pnpm.
probe=packages/kernel/src/lib/__ordering-adjudication.spec.ts
if [ -e "$probe" ]; then
  printf 'Refusing to overwrite existing probe: %s\n' "$probe" >&2
  exit 2
fi
mkdir -p /private/tmp/st-ordering-adjudication
cp docs/research/b-native-integration/ordering-adjudication/public-sequence.spec.ts "$probe"
trap 'rm -f "$probe"' EXIT
NX_DAEMON=false pnpm nx test kernel --testFile=src/lib/__ordering-adjudication.spec.ts --skip-nx-cache
cat /private/tmp/st-ordering-adjudication/public-incumbent.json
cat /private/tmp/st-ordering-adjudication/public-B.json
