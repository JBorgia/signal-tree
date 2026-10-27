#!/bin/sh
set -eu
export PATH=/private/tmp/link-membership-pinned-bin:$PATH
export COREPACK_ENABLE_NETWORK=0 NX_DAEMON=false NX_ISOLATE_PLUGINS=false
corepack pnpm nx test kernel --skip-nx-cache -- src/lib/entity-egress-footprint.spec.ts src/lib/entity-semantic-topology.spec.ts src/lib/entity-semantic-transition.spec.ts src/lib/entity-semantic-point-recurrence.spec.ts src/lib/entity-realization-handoff.spec.ts src/lib/entity-semantic-structure-slice.spec.ts src/lib/entity-semantic-structural-inverses.spec.ts src/lib/entity-semantic-composition-slice.spec.ts src/lib/entity-semantic-structure-faults.spec.ts src/lib/entity-semantic-structure-interceptors.spec.ts src/lib/entity-order-carrier.spec.ts src/lib/entity-projection-seed.spec.ts src/lib/entity-update-one-equivalence.spec.ts src/lib/occupancy-successor-point-work.spec.ts src/lib/ordinary-order-indexed-work.spec.ts src/lib/ordinary-order-source-boundaries.spec.ts src/lib/ordinary-order-owner-preparation.spec.ts
