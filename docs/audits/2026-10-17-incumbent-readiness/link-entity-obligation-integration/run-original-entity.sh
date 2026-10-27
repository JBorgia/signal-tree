#!/bin/sh
set -eu
export PATH=/private/tmp/link-membership-pinned-bin:$PATH
export COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false
corepack pnpm nx test kernel --skip-nx-cache -- src/lib/link-native-address.spec.ts src/lib/link-address-lifecycle.spec.ts src/lib/separate-boundary-contract.spec.ts src/lib/internals/causal-runtime/heterogeneous-reentry-publication.spec.ts src/lib/internals/causal-runtime/heterogeneous-independent-invalidation.spec.ts src/lib/internals/causal-runtime/heterogeneous-invalidation-containment.spec.ts src/lib/entity-obligation-matrix.spec.ts src/lib/entity-native-input-independent.spec.ts
